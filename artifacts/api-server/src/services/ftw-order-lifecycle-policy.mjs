export const FTW_PAYMENT_TIMEOUT_MINUTES = 7;

export const FTW_ORDER_ID_FILTER = { $regex: "^#*FTW", $options: "i" };
export const FTW_PENDING_FILTER = /^pending$/i;
export const FTW_FAILED_FILTER = /^failed$/i;
export const FTW_UNSETTLED_PAYMENT_FILTER = {
  $in: [FTW_PENDING_FILTER, FTW_FAILED_FILTER],
};

export function buildFtwPaymentExpiryBackfillFilter() {
  return {
    orderId: FTW_ORDER_ID_FILTER,
    isDeleted: { $ne: true },
    paymentStatus: FTW_UNSETTLED_PAYMENT_FILTER,
    $or: [
      { paymentExpiresAt: { $exists: false } },
      { paymentExpiresAt: null },
    ],
  };
}

export function buildFtwPaymentExpiryExtensionFilter() {
  return {
    orderId: FTW_ORDER_ID_FILTER,
    isDeleted: { $ne: true },
    paymentStatus: FTW_UNSETTLED_PAYMENT_FILTER,
    createdAt: { $type: "date" },
    $expr: {
      $lt: [
        "$paymentExpiresAt",
        {
          $dateAdd: {
            startDate: "$createdAt",
            unit: "minute",
            amount: FTW_PAYMENT_TIMEOUT_MINUTES,
          },
        },
      ],
    },
  };
}

export function buildFtwPaymentExpiryPipeline() {
  return [
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
  ];
}

export function buildExpiredFtwPaymentFilter(paymentStatusFilter) {
  return {
    orderId: FTW_ORDER_ID_FILTER,
    isDeleted: { $ne: true },
    paymentStatus: paymentStatusFilter,
    paymentExpiresAt: { $type: "date" },
    $expr: { $lte: ["$paymentExpiresAt", "$$NOW"] },
  };
}

export function isWithinFtwPaymentWindow(order, now = Date.now()) {
  const expiry = order?.paymentExpiresAt
    ? new Date(order.paymentExpiresAt).getTime()
    : Number.NaN;
  return !Number.isFinite(expiry) || expiry > now;
}

export function canAcceptFtwSettlement(order, incomingPaymentStatus, now = Date.now()) {
  const orderId = String(order?.orderId ?? "").trim().replace(/^#+/, "").toUpperCase();
  const currentStatus = String(order?.paymentStatus ?? "").trim().toLowerCase();
  const incomingStatus = String(incomingPaymentStatus ?? "").trim().toLowerCase();
  return (
    orderId.startsWith("FTW") &&
    ["pending", "failed"].includes(currentStatus) &&
    incomingStatus === "completed" &&
    isWithinFtwPaymentWindow(order, now)
  );
}
