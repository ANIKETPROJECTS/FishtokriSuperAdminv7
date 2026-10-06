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
