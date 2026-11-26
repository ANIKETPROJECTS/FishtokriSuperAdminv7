export function isWalletPayment(payment: any): boolean;
export function hasNonWalletPayment(payments: any[] | undefined): boolean;
export function getMissingWalletDebit(walletAmount: number | string, transactions: any[], orderRef: string): number;
export function getWalletPaymentAmount(
  payments: any[] | undefined,
  fallbackAmount?: number | string,
  preferFallback?: boolean,
): number;
