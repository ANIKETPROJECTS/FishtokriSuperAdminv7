function normalizeOrderId(value) {
  return String(value ?? "").trim().replace(/^#+/, "").toLowerCase();
}

function walletAmount(order) {
  const walletPayments = Array.isArray(order?.payments)
    ? order.payments.filter((payment) => String(payment?.mode ?? "").trim().toLowerCase() === "wallet")
    : [];
  const fromPayments = walletPayments.reduce((sum, payment) => sum + (Number(payment?.amount) || 0), 0);
  return fromPayments > 0 ? fromPayments : Math.max(0, Number(order?.walletUsed) || 0);
}

function matchesLoggedDebit(transaction, order, amount) {
  if (String(transaction?.type ?? "").toLowerCase() !== "debit") return false;
  if (Math.abs(Math.abs(Number(transaction?.amount) || 0) - amount) > 0.01) return false;

  const orderRef = String(order?._id ?? order?.id ?? "");
  if (orderRef && String(transaction?.orderRef ?? "") === orderRef) return true;

  const orderId = normalizeOrderId(order?.orderId ?? order?.orderNumber);
  if (!orderId || normalizeOrderId(transaction?.orderId) !== orderId) return false;

  // Legacy debit rows may not have orderRef. Match only near the order's creation
  // time so a reused public order number cannot hide a missing debit.
  const orderTime = new Date(order?.createdAt ?? 0).getTime();
  const transactionTime = new Date(transaction?.createdAt ?? 0).getTime();
  return Number.isFinite(orderTime) &&
    Number.isFinite(transactionTime) &&
    Math.abs(orderTime - transactionTime) <= 5 * 60 * 1000;
}

export function addMissingWalletOrderDeductions(transactions, orders) {
  const result = Array.isArray(transactions) ? [...transactions] : [];

  for (const order of Array.isArray(orders) ? orders : []) {
    const amount = walletAmount(order);
    if (amount <= 0 || result.some((transaction) => matchesLoggedDebit(transaction, order, amount))) {
      continue;
    }

    const orderId = String(order?.orderId ?? order?.orderNumber ?? "");
    result.push({
      amount: -amount,
      type: "debit",
      reason: "Order placed — wallet deducted",
      createdAt: order?.createdAt ?? order?.updatedAt ?? new Date(0),
      ...(orderId ? { orderId } : {}),
      ...(order?._id ?? order?.id ? { orderRef: String(order._id ?? order.id) } : {}),
      recoveredFromOrder: true,
    });
  }

  return result;
}
