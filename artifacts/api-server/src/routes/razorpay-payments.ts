import { Router } from "express";
import { requireAuth, requireMasterAdmin, type AuthenticatedRequest } from "../middlewares/auth.js";
import { RazorpayAlertSuppression } from "../db/models/razorpay-alert-suppression.js";
import { getSubHubDbConnection } from "../db/sub-hub-connections.js";
import { listPayments, RazorpayApiError } from "../services/razorpay.js";

const router = Router();

router.use(requireAuth as any);
router.use(requireMasterAdmin as any);

function parseInteger(value: unknown, fallback: number): number | null {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function isSuccessfulPayment(payment: { status?: string; captured?: boolean }): boolean {
  const status = String(payment.status ?? "").toLowerCase();
  return status === "captured" || status === "refunded" || payment.captured === true;
}

async function addFtwOrderVerification<T extends {
  id: string;
  status?: string;
  captured?: boolean;
}>(items: T[]) {
  const paymentIds = [...new Set(items.filter(isSuccessfulPayment).map((payment) => payment.id))];
  if (paymentIds.length === 0) {
    return items.map((payment) => ({
      ...payment,
      ftwOrderVerification: { status: "not_applicable", orderIds: [] as string[] },
    }));
  }

  const ordersConnection = await getSubHubDbConnection("orders");
  const ordersDb = ordersConnection.db;
  if (!ordersDb) throw new Error("The orders database is unavailable.");
  const [orders, suppressions] = await Promise.all([
    ordersDb.collection("orders")
      .find(
        {
          orderId: { $regex: "^#?FTW", $options: "i" },
          isDeleted: { $ne: true },
          $or: [
            { upiTransactionId: { $in: paymentIds } },
            { "payments.reference": { $in: paymentIds } },
          ],
        },
        { projection: { orderId: 1, upiTransactionId: 1, payments: 1 } },
      )
      .toArray(),
    RazorpayAlertSuppression.find({ _id: { $in: paymentIds } })
      .select("_id suppressedAt")
      .lean(),
  ]);

  const matchedOrderIds = new Map<string, Set<string>>();
  const paymentIdSet = new Set(paymentIds);
  for (const order of orders) {
    const orderId = String(order.orderId ?? "").replace(/^#+/, "").trim() || String(order._id);
    const transactionIds = [
      order.upiTransactionId,
      ...(Array.isArray(order.payments)
        ? order.payments.map((payment: { reference?: unknown }) => payment?.reference)
        : []),
    ];
    for (const value of transactionIds) {
      const transactionId = String(value ?? "").trim();
      if (!paymentIdSet.has(transactionId)) continue;
      const orderIds = matchedOrderIds.get(transactionId) ?? new Set<string>();
      orderIds.add(orderId);
      matchedOrderIds.set(transactionId, orderIds);
    }
  }

  const suppressedAtByPaymentId = new Map<string, string>();
  for (const suppression of suppressions) {
    suppressedAtByPaymentId.set(
      String(suppression._id),
      suppression.suppressedAt instanceof Date
        ? suppression.suppressedAt.toISOString()
        : new Date(suppression.suppressedAt).toISOString(),
    );
  }

  return items.map((payment) => {
    if (!isSuccessfulPayment(payment)) {
      return {
        ...payment,
        ftwOrderVerification: { status: "not_applicable", orderIds: [] as string[] },
      };
    }
    const orderIds = [...(matchedOrderIds.get(payment.id) ?? [])];
    if (orderIds.length > 0) {
      return { ...payment, ftwOrderVerification: { status: "matched", orderIds } };
    }
    const suppressedAt = suppressedAtByPaymentId.get(payment.id);
    return {
      ...payment,
      ftwOrderVerification: {
        status: suppressedAt ? "suppressed" : "missing",
        orderIds: [] as string[],
        ...(suppressedAt ? { suppressedAt } : {}),
      },
    };
  });
}

function validPaymentId(value: string): boolean {
  return /^pay_[A-Za-z0-9]+$/.test(value);
}

// GET /api/razorpay-payments?count=25&skip=0&from=<epoch>&to=<epoch>
router.get("/razorpay-payments", async (req, res) => {
  const count = parseInteger(req.query.count, 25);
  const skip = parseInteger(req.query.skip, 0);
  const from = parseInteger(req.query.from, -1);
  const to = parseInteger(req.query.to, -1);

  if (count === null || count < 1 || count > 100) {
    res.status(400).json({ message: "count must be between 1 and 100." });
    return;
  }
  if (skip === null) {
    res.status(400).json({ message: "skip must be a non-negative integer." });
    return;
  }
  if (from === null || to === null) {
    res.status(400).json({ message: "Date filters must be valid Unix timestamps." });
    return;
  }
  if (from !== -1 && to !== -1 && from > to) {
    res.status(400).json({ message: "The start date must be before the end date." });
    return;
  }

  try {
    const result = await listPayments({
      count,
      skip,
      ...(from === -1 ? {} : { from }),
      ...(to === -1 ? {} : { to }),
    });
    const items = await addFtwOrderVerification(result.items);
    res.json({
      items,
      count: result.count,
      skip,
      pageSize: count,
      hasMore: result.items.length === count,
    });
  } catch (error) {
    if (!(error instanceof RazorpayApiError)) {
      req.log?.error({ err: error }, "Could not reconcile Razorpay payments with FTW orders");
    }
    if (error instanceof RazorpayApiError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(502).json({ message: "Could not load Razorpay transactions and verify FTW orders." });
  }
});

router.post("/razorpay-payments/:paymentId/suppression", async (req, res) => {
  const paymentId = String(req.params.paymentId ?? "");
  if (!validPaymentId(paymentId)) {
    res.status(400).json({ message: "A valid Razorpay payment ID is required." });
    return;
  }

  try {
    const admin = (req as AuthenticatedRequest).admin;
    await RazorpayAlertSuppression.findByIdAndUpdate(
      paymentId,
      {
        $set: {
          suppressedAt: new Date(),
          suppressedBy: admin?.email || admin?.adminId || "master_admin",
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    res.json({ status: "suppressed" });
  } catch {
    res.status(500).json({ message: "Could not suppress the FTW order alert." });
  }
});

router.delete("/razorpay-payments/:paymentId/suppression", async (req, res) => {
  const paymentId = String(req.params.paymentId ?? "");
  if (!validPaymentId(paymentId)) {
    res.status(400).json({ message: "A valid Razorpay payment ID is required." });
    return;
  }

  try {
    await RazorpayAlertSuppression.findByIdAndDelete(paymentId);
    res.json({ status: "active" });
  } catch {
    res.status(500).json({ message: "Could not restore the FTW order alert." });
  }
});

export default router;