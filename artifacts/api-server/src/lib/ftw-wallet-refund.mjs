import { getWalletPaymentAmount } from "./wallet-payment-amount.mjs";

export function getUnrefundedFtwWalletAmount(order, transactions) {
  const walletAmount = getWalletPaymentAmount(order?.payments, order?.walletUsed);
  const orderRef = String(order?._id ?? order?.id ?? "");
  if (walletAmount <= 0 || !orderRef) return 0;

  const refundedAmount = (Array.isArray(transactions) ? transactions : [])
    .filter((transaction) =>
      String(transaction?.orderRef ?? "") === orderRef &&
      String(transaction?.type ?? "").trim().toLowerCase() === "credit" &&
      /refund/i.test(String(transaction?.reason ?? "")),
    )
    .reduce((sum, transaction) => sum + Math.max(0, Number(transaction?.amount) || 0), 0);

  return Math.max(0, walletAmount - refundedAmount);
}
