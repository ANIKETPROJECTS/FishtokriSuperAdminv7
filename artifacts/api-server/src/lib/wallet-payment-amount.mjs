export function isWalletPayment(payment) {
  return String(payment?.mode ?? "").trim().toLowerCase() === "wallet";
}

export function hasNonWalletPayment(payments) {
  return Array.isArray(payments) && payments.some(
    (payment) =>
      !isWalletPayment(payment) &&
      String(payment?.mode ?? "").trim() !== "" &&
      Math.max(0, Number(payment?.amount) || 0) > 0,
  );
}

export function getWalletPaymentAmount(payments, fallbackAmount = 0, preferFallback = false) {
  const fallback = Math.max(0, Number(fallbackAmount) || 0);
  if (preferFallback) return fallback;

  const paymentTotal = Array.isArray(payments)
    ? payments
        .filter(isWalletPayment)
        .reduce((sum, payment) => sum + Math.max(0, Number(payment?.amount) || 0), 0)
    : 0;

  return paymentTotal > 0 ? paymentTotal : fallback;
}
