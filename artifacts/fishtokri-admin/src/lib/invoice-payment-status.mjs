export function normalizePaymentStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "completed" ? "paid" : normalized;
}

export function isPaymentStatusPaid(status) {
  return normalizePaymentStatus(status) === "paid";
}

export function paymentStatusDisplayLabel(status) {
  return isPaymentStatusPaid(status) ? "Paid" : String(status ?? "");
}

export function isInvoicePaid(order) {
  return isPaymentStatusPaid(order?.paymentStatus);
}

export function getInvoicePaymentAmounts(order, grandTotal) {
  const total = Math.max(0, Number(grandTotal) || 0);
  if (total === 0) return { paidAmount: 0, dueAmount: 0 };

  // A settled status is authoritative when legacy amount fields are stale or missing.
  if (isInvoicePaid(order)) return { paidAmount: total, dueAmount: 0 };

  const paidAmount = Number(order?.paidAmount) || 0;
  const dueAmount = Number(order?.dueAmount) || Math.max(0, total - paidAmount);
  return { paidAmount, dueAmount };
}
