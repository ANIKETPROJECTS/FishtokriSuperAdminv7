export function isWalletPayment(payment: any): boolean;
export function hasNonWalletPayment(payments: any[] | undefined): boolean;
export function getWalletPaymentAmount(
  payments: any[] | undefined,
  fallbackAmount?: number | string,
  preferFallback?: boolean,
): number;
