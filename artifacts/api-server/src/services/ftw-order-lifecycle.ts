import { getSubHubDbConnection } from "../db/sub-hub-connections.js";
import { logger } from "../lib/logger.js";
import { applyOrderInventoryOnDelete } from "../routes/inventory.js";
import {
  buildExpiredFtwPaymentFilter,
  buildFtwPaymentExpiryBackfillFilter,
  buildFtwPaymentExpiryExtensionFilter,
  buildFtwPaymentExpiryPipeline,
  FTW_FAILED_FILTER,
  FTW_PAYMENT_TIMEOUT_MINUTES,
  FTW_PENDING_FILTER,
} from "./ftw-order-lifecycle-policy.mjs";

export function isFtwOrder(order: any): boolean {
  const orderId = String(order?.orderId ?? "").trim().replace(/^#+/, "").toUpperCase();
  return orderId.startsWith("FTW");
}

export function isFtwPaymentOnHold(order: any): boolean {
  if (!isFtwOrder(order)) return false;
  const paymentStatus = String(order?.paymentStatus ?? "").trim().toLowerCase();
  return paymentStatus === "pending" || paymentStatus === "failed";
}

/**
 * Persist one absolute seven-minute payment window for pending and failed FTW
 * statuses. A failed signal is provisional while the gateway may still report
 * a successful capture, so it must not trigger immediate cleanup.
 */
export async function ensureFtwPaymentExpiryDates(ordersCollection: any): Promise<void> {
  const expiryPipeline = buildFtwPaymentExpiryPipeline();
  await ordersCollection.updateMany(
    buildFtwPaymentExpiryBackfillFilter(),
    expiryPipeline,
  );
  await ordersCollection.updateMany(
    buildFtwPaymentExpiryExtensionFilter(),
    expiryPipeline,
  );
}

async function softDeleteFtwPaymentOrder(
  ordersCollection: any,
  candidate: any,
  reason: "payment_failed" | "payment_timeout",
): Promise<boolean> {
  const paymentStatusFilter =
    reason === "payment_failed" ? FTW_FAILED_FILTER : FTW_PENDING_FILTER;
  const filter = {
    ...buildExpiredFtwPaymentFilter(paymentStatusFilter),
    _id: candidate._id,
  };

  // The state check and soft-delete are one atomic operation. If payment
  // completion wins the race, this no longer matches and inventory is untouched.
  const deleted = await ordersCollection.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          isDeleted: true,
          deletedAt: "$$NOW",
          inventoryDeducted: false,
          ftwPaymentCleanupReason: reason,
        },
      },
    ],
    { returnDocument: "before" },
  );

  if (!deleted) return false;

  try {
    await applyOrderInventoryOnDelete(deleted, deleted.inventoryDeducted === true);
  } catch (err) {
    logger.error(
      { err, orderId: deleted.orderId, reason },
      "FTW payment cleanup could not restore inventory",
    );
  }

  logger.info(
    {
      orderId: deleted.orderId,
      reason,
      inventoryWasDeducted: deleted.inventoryDeducted === true,
    },
    "FTW payment order moved to Deleted",
  );
  return true;
}

/**
 * Server-side lifecycle sweep. Expiry is evaluated against MongoDB's clock,
 * not a browser timer. Pending and failed states are both provisional until
 * the shared seven-minute payment window expires.
 */
export async function runFtwPaymentLifecycleSweep(): Promise<void> {
  try {
    const conn = await getSubHubDbConnection("orders");
    if (!conn.db) throw new Error("Orders database connection is unavailable");
    const orders = conn.db.collection("orders");

    await ensureFtwPaymentExpiryDates(orders);

    const projection = {
      _id: 1,
      orderId: 1,
      status: 1,
      paymentStatus: 1,
      paymentExpiresAt: 1,
      isDeleted: 1,
      inventoryDeducted: 1,
      subHubId: 1,
      subHubName: 1,
      items: 1,
    };

    const failedOrders = await orders
      .find(buildExpiredFtwPaymentFilter(FTW_FAILED_FILTER))
      .project(projection)
      .limit(100)
      .toArray();

    for (const order of failedOrders) {
      try {
        await softDeleteFtwPaymentOrder(orders, order, "payment_failed");
      } catch (err) {
        logger.error({ err, orderId: order.orderId }, "Failed to clean up FTW failed-payment order");
      }
    }

    const expiredOrders = await orders
      .find(buildExpiredFtwPaymentFilter(FTW_PENDING_FILTER))
      .project(projection)
      .limit(100)
      .toArray();

    for (const order of expiredOrders) {
      try {
        await softDeleteFtwPaymentOrder(orders, order, "payment_timeout");
      } catch (err) {
        logger.error({ err, orderId: order.orderId }, "Failed to expire FTW pending-payment order");
      }
    }
  } catch (err) {
    logger.error({ err }, "FTW payment lifecycle sweep failed");
  }
}
