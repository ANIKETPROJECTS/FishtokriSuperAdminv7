import app from "./app.js";
import { logger } from "./lib/logger.js";
import { connectDB } from "./db/index.js";
import { runInventoryBackgroundDeduction } from "./routes/inventory.js";
import { getSubHubDbConnection } from "./db/sub-hub-connections.js";

/**
 * Background job: auto-set paymentMode="upi" and upiVariant="RZPAY" on any
 * pending storefront order (orderId starts with "FT" but NOT "FTS") that
 * doesn't yet have them. Runs at startup and every 30 s thereafter so it
 * doesn't depend on which tab the admin currently has open.
 */
async function autoFixStorefrontPaymentMode() {
  try {
    const conn = await getSubHubDbConnection("orders");
    const col = conn.db.collection("orders");

    // Fetch all active (non-terminal, non-paid) orders and filter in JS
    // to avoid relying on MongoDB regex lookahead support.
    const candidates: any[] = await col
      .find({
        status: { $nin: ["delivered", "cancelled", "rejected"] },
        paymentStatus: { $ne: "paid" },
      })
      .project({ _id: 1, orderId: 1, paymentMode: 1, upiVariant: 1 })
      .toArray();

    // Keep only storefront orders: orderId starts with FT but NOT FTS
    const toFix = candidates.filter((o: any) => {
      const oid = String(o.orderId ?? "").replace(/^#+/, "");
      if (!oid.startsWith("FT") || oid.startsWith("FTS")) return false;
      const alreadyUpi = String(o.paymentMode ?? "").toLowerCase() === "upi";
      const alreadyRzpay = String(o.upiVariant ?? "") === "RZPAY";
      return !alreadyUpi || !alreadyRzpay;
    });

    logger.info(
      {
        candidateCount: candidates.length,
        toFixCount: toFix.length,
        sampleOrderIds: toFix.slice(0, 5).map((o: any) => o.orderId),
      },
      "autoFixStorefrontPaymentMode: scan complete"
    );

    if (toFix.length === 0) return;

    const ids = toFix.map((o: any) => o._id);
    const result = await col.updateMany(
      { _id: { $in: ids } },
      { $set: { paymentMode: "upi", upiVariant: "RZPAY" } }
    );

    logger.info(
      { matched: result.matchedCount, modified: result.modifiedCount },
      "autoFixStorefrontPaymentMode: applied UPI+RZPAY"
    );
  } catch (err) {
    logger.error({ err }, "autoFixStorefrontPaymentMode failed (non-fatal)");
  }
}

/**
 * Idempotent migration that runs on every startup and fixes two classes of
 * payment inconsistency in the orders collection:
 *
 * 1. Takeaway orders that are still "unpaid" — these are always collected at
 *    pickup, so mark them paid: paidAmount = total, dueAmount = 0.
 *
 * 2. Any order already marked "paid" but still carrying a dueAmount > 0 —
 *    just zero out the due.
 */
async function fixPaidOrdersDueAmount() {
  try {
    const conn = await getSubHubDbConnection("orders");
    const col = conn.db.collection("orders");

    // Fix 1: takeaway orders that are not yet marked as paid.
    const takeawayFix = await col.updateMany(
      { deliveryType: "takeaway", paymentStatus: { $ne: "paid" } },
      [
        {
          $set: {
            paymentStatus: "paid",
            paidAmount: { $ifNull: ["$total", 0] },
            dueAmount: 0,
          },
        },
      ]
    );
    if (takeawayFix.modifiedCount > 0) {
      logger.info(
        { count: takeawayFix.modifiedCount },
        "Migration: marked unpaid takeaway orders as fully paid"
      );
    }

    // Fix 2: any order already "paid" but with a stale dueAmount > 0.
    const dueFix = await col.updateMany(
      { paymentStatus: "paid", dueAmount: { $gt: 0 } },
      { $set: { dueAmount: 0 } }
    );
    if (dueFix.modifiedCount > 0) {
      logger.info(
        { count: dueFix.modifiedCount },
        "Migration: reset dueAmount=0 for paid orders"
      );
    }
  } catch (err) {
    logger.error({ err }, "Migration: fixPaidOrdersDueAmount failed (non-fatal)");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

connectDB()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");

      // Migration: fix paid orders that still have dueAmount > 0 (old takeaway bug).
      fixPaidOrdersDueAmount().catch(() => {});

      // Auto-fix storefront (FT*) orders: set UPI+RZPAY immediately, then every 30s.
      autoFixStorefrontPaymentMode().catch(() => {});
      setInterval(() => {
        autoFixStorefrontPaymentMode().catch((e) =>
          logger.error({ err: e }, "autoFixStorefrontPaymentMode (poll) failed")
        );
      }, 30_000);

      // Run once at startup (after 15s) to catch any orders that missed deduction
      // while the server was down, then keep polling every 60s.
      setTimeout(() => {
        runInventoryBackgroundDeduction().catch((e) =>
          logger.error({ err: e }, "bg inventory deduction (startup) failed")
        );
      }, 15_000);

      setInterval(() => {
        runInventoryBackgroundDeduction().catch((e) =>
          logger.error({ err: e }, "bg inventory deduction (poll) failed")
        );
      }, 60_000);
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to connect to MongoDB");
    process.exit(1);
  });
