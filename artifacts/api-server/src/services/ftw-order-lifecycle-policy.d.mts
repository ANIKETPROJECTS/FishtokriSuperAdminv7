export const FTW_PAYMENT_TIMEOUT_MINUTES: number;
export const FTW_ORDER_ID_FILTER: { $regex: string; $options: string };
export const FTW_PENDING_FILTER: { $regex: string; $options: string };
export const FTW_FAILED_FILTER: { $regex: string; $options: string };
export const FTW_UNSETTLED_PAYMENT_FILTER: {
  $in: Array<{ $regex: string; $options: string }>;
};
export function buildFtwPaymentExpiryBackfillFilter(): Record<string, unknown>;
export function buildExpiredFtwPaymentFilter(
  paymentStatusFilter: Record<string, unknown>,
): Record<string, unknown>;
export function isWithinFtwPaymentWindow(
  order: { paymentExpiresAt?: Date | string | null } | null | undefined,
  now?: number,
): boolean;
export function canAcceptFtwSettlement(
  order: { orderId?: unknown; paymentStatus?: unknown; paymentExpiresAt?: Date | string | null } | null | undefined,
  incomingPaymentStatus: unknown,
  now?: number,
): boolean;
