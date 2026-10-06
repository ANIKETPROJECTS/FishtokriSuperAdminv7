export function isInvoicePaid(order) {
  const paymentStatus = String(order?.paymentStatus ?? "").trim().toLowerCase();
  if (paymentStatus === "paid") return true;
  if (paymentStatus !== "completed") return false;

  const orderIdentifier = String(order?.orderId || order?.invoiceNo || "")
    .trim()
    .replace(/^#+/, "")
    .toUpperCase();
  return orderIdentifier.startsWith("FTW");
}
