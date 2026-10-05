import { getSubHubDbConnection } from "../db/sub-hub-connections.js";
import { logger } from "../lib/logger.js";
import { applyOrderInventoryOnDelete } from "../routes/inventory.js";

export const FTW_PAYMENT_TIMEOUT_MINUTES = 5;

const FTW_ORDER_ID_FILTER = { $regex: "^#*FTW", $options: "i" };
const FTW_PENDING_FILTER = { $regex: "^pending$", $options: "i" };
const FTW_FAILED_FILTER = { $regex: "^failed$", $options: "i" };

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
 * Persist an absolute expiry in MongoDB so the timer survives browser closure,
 * refreshes, and API restarts. MongoDB's $$NOW is used only when an order has
 * no usable createdAt timestamp.
 */
export async function ensureFtwPendingPaymentExpiryDates(ordersCollection: any): Promise<void> {
  await ordersCollection.updateMany(
    {
      orderId: FTW_ORDER_ID_FILTER,
      isDeleted: { $ne: true },
      paymentStatus: FTW_PENDING_FILTER,
      $or: [
        { paymentExpiresAt: { $exists: false } },
        { paymentExpiresAt: null },
      ],
    },
    [
      {
        $set: {
          paymentExpiresAt: {
            $dateAdd: {
              startDate: {
                $ifNull: [
                  {
                    $convert: {
                      input: "$createdAt",
                      to: "date",
                      onError: null,
                      onNull: null,
                    },
                  },
                  "$$NOW",
                ],
              },
              unit: "minute",
              amount: FTW_PAYMENT_TIMEOUT_MINUTES,
            },
          },
        },
      },
    ],
  );
}

async function softDeleteFtwPaymentOrder(
  ordersCollection: any,
  candidate: any,
  reason: "payment_failed" | "payment_timeout",
): Promise<boolean> {
  const paymentStatusFilter =
    reason === "payment_failed" ? FTW_FAILED_FILTER : FTW_PENDING_FILTER;
  const filter: Record<string, any> = {
    _id: candidate._id,
    orderId: FTW_ORDER_ID_FILTER,
    isDeleted: { $ne: true },
    paymentStatus: paymentStatusFilter,
  };

  if (reason === "payment_timeout") {
    filter.paymentExpiresAt = { $type: "date" };
    filter.$expr = { $lte: ["$paymentExpiresAt", "$$NOW"] };
  }

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
 * not a browser timer, and failed-payment records are soft-deleted as soon as
 * FTW marks paymentStatus="failed".
 */
export async function runFtwPaymentLifecycleSweep(): Promise<void> {
  try {
    const conn = await getSubHubDbConnection("orders");
    if (!conn.db) throw new Error("Orders database connection is unavailable");
    const orders = conn.db.collection("orders");

    await ensureFtwPendingPaymentExpiryDates(orders);

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
      .find({
        orderId: FTW_ORDER_ID_FILTER,
        isDeleted: { $ne: true },
        paymentStatus: FTW_FAILED_FILTER,
      })
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
      .find({
        orderId: FTW_ORDER_ID_FILTER,
        isDeleted: { $ne: true },
        paymentStatus: FTW_PENDING_FILTER,
        paymentExpiresAt: { $type: "date" },
        $expr: { $lte: ["$paymentExpiresAt", "$$NOW"] },
      })
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
