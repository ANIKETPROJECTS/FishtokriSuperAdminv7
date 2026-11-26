import { getSubHubDbConnection } from "../db/sub-hub-connections.js";
import { getCustomersConnection } from "../db/customers-connection.js";
import { logger } from "../lib/logger.js";
import mongoose from "mongoose";
import { applyOrderInventoryOnDelete } from "../routes/inventory.js";
import { getUnrefundedFtwWalletAmount } from "../lib/ftw-wallet-refund.mjs";
import {
  buildFailedFtwPaymentFilter,
  buildExpiredFtwPaymentFilter,
  buildFtwPaymentExpiryBackfillFilter,
  buildFtwPaymentExpiryExtensionFilter,
  buildFtwPaymentExpiryPipeline,
  FTW_PAYMENT_TIMEOUT_MINUTES,
  FTW_PENDING_FILTER,
} from "./ftw-order-lifecycle-policy.mjs";

const FTW_CLEANUP_REASONS = ["payment_failed", "payment_timeout"];
const WALLET_REFUND_PROCESSING_LEASE_MS = 5 * 60 * 1000;

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
 * Persist one absolute seven-minute payment window for pending FTW orders.
 * Explicit payment failures are cleaned up immediately and do not use this window.
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
  const filter = {
    ...(reason === "payment_failed"
      ? buildFailedFtwPaymentFilter()
      : buildExpiredFtwPaymentFilter(FTW_PENDING_FILTER)),
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
          ftwWalletRefundStatus: "pending",
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

  try {
    await refundDeletedFtwWalletOrder(ordersCollection, deleted);
  } catch (err) {
    logger.error(
      { err, orderId: deleted.orderId, reason },
      "FTW payment cleanup wallet refund failed and will retry",
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

export async function cleanupFailedFtwPaymentOrder(orderId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(orderId)) return false;
  const conn = await getSubHubDbConnection("orders");
  if (!conn.db) throw new Error("Orders database connection is unavailable");
  const orders = conn.db.collection("orders");
  const candidate = await orders.findOne(
    { ...buildFailedFtwPaymentFilter(), _id: new mongoose.Types.ObjectId(orderId) },
    {
      projection: {
        _id: 1,
        orderId: 1,
        customerId: 1,
        payments: 1,
        walletUsed: 1,
        inventoryDeducted: 1,
        subHubId: 1,
        subHubName: 1,
        items: 1,
      },
    },
  );
  if (!candidate) return false;
  return softDeleteFtwPaymentOrder(orders, candidate, "payment_failed");
}

async function refundDeletedFtwWalletOrder(
  ordersCollection: any,
  candidate: any,
): Promise<void> {
  const orderRef = String(candidate?._id ?? "");
  if (!orderRef) return;
  const now = new Date();
  const retryBefore = new Date(now.getTime() - WALLET_REFUND_PROCESSING_LEASE_MS);
  const claimed = await ordersCollection.findOneAndUpdate(
    {
      _id: candidate._id,
      isDeleted: true,
      ftwPaymentCleanupReason: { $in: FTW_CLEANUP_REASONS },
      $or: [
        { ftwWalletRefundStatus: "pending" },
        {
          ftwWalletRefundStatus: "processing",
          ftwWalletRefundAttemptedAt: { $lte: retryBefore },
        },
      ],
    },
    {
      $set: {
        ftwWalletRefundStatus: "processing",
        ftwWalletRefundAttemptedAt: now,
      },
    },
    { returnDocument: "before" },
  );
  if (!claimed) return;

  try {
    const walletAmount = getUnrefundedFtwWalletAmount(claimed, []);
    if (walletAmount <= 0) {
      await ordersCollection.updateOne(
        { _id: claimed._id, ftwWalletRefundStatus: "processing" },
        {
          $set: {
            ftwWalletRefundStatus: "not_required",
            ftwWalletRefundedAmount: 0,
          },
          $unset: { ftwWalletRefundAttemptedAt: "" },
        },
      );
      return;
    }

    const customerId = String(claimed.customerId ?? "");
    if (!mongoose.isValidObjectId(customerId)) {
      throw new Error("FTW order has no valid customer ID for wallet refund");
    }
    const customersConnection = await getCustomersConnection();
    const customers = customersConnection.db.collection("customers");
    const customerObjectId = new mongoose.Types.ObjectId(customerId);
    const customer = await customers.findOne(
      { _id: customerObjectId },
      { projection: { walletTransactions: 1 } },
    );
    if (!customer) throw new Error("Customer for failed FTW order was not found");

    const refundAmount = getUnrefundedFtwWalletAmount(
      claimed,
      customer.walletTransactions,
    );
    if (refundAmount > 0) {
      const refundResult = await customers.updateOne(
        { _id: customerObjectId },
        {
          $inc: { walletBalance: refundAmount },
          $push: {
            walletTransactions: {
              amount: refundAmount,
              type: "credit",
              reason: claimed.ftwPaymentCleanupReason === "payment_failed"
                ? "FTW payment failed — wallet refunded"
                : "FTW payment timed out — wallet refunded",
              createdAt: now,
              orderId: String(claimed.orderId ?? ""),
              orderRef,
            },
          },
        },
      );
      if (refundResult.matchedCount === 0) {
        throw new Error("Customer wallet was not updated for failed FTW order");
      }
    }

    await ordersCollection.updateOne(
      { _id: claimed._id, ftwWalletRefundStatus: "processing" },
      {
        $set: {
          ftwWalletRefundStatus: "refunded",
          ftwWalletRefundedAmount: walletAmount,
          ftwWalletRefundedAt: now,
        },
        $unset: { ftwWalletRefundAttemptedAt: "" },
      },
    );
    logger.info(
      { orderId: claimed.orderId, refunded: refundAmount },
      "FTW failed-payment wallet refunded",
    );
  } catch (err) {
    await ordersCollection.updateOne(
      { _id: claimed._id, ftwWalletRefundStatus: "processing" },
      {
        $set: { ftwWalletRefundStatus: "pending" },
        $unset: { ftwWalletRefundAttemptedAt: "" },
      },
    );
    throw err;
  }
}

/**
 * Server-side lifecycle sweep. Pending payment expiry is evaluated against
 * MongoDB's clock; explicit failed payments are deleted without waiting.
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
      customerId: 1,
      payments: 1,
      walletUsed: 1,
      subHubId: 1,
      subHubName: 1,
      items: 1,
    };

    const failedOrders = await orders
      .find(buildFailedFtwPaymentFilter())
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

    const retryBefore = new Date(Date.now() - WALLET_REFUND_PROCESSING_LEASE_MS);
    const pendingWalletRefunds = await orders
      .find({
        isDeleted: true,
        ftwPaymentCleanupReason: { $in: FTW_CLEANUP_REASONS },
        $or: [
          { ftwWalletRefundStatus: "pending" },
          {
            ftwWalletRefundStatus: "processing",
            ftwWalletRefundAttemptedAt: { $lte: retryBefore },
          },
        ],
      })
      .project({
        _id: 1,
        orderId: 1,
        customerId: 1,
        payments: 1,
        walletUsed: 1,
        ftwPaymentCleanupReason: 1,
      })
      .limit(100)
      .toArray();

    for (const order of pendingWalletRefunds) {
      try {
        await refundDeletedFtwWalletOrder(orders, order);
      } catch (err) {
        logger.error({ err, orderId: order.orderId }, "Failed to retry FTW payment wallet refund");
      }
    }
  } catch (err) {
    logger.error({ err }, "FTW payment lifecycle sweep failed");
  }
}
