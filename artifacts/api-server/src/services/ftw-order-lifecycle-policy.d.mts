export const FTW_PAYMENT_TIMEOUT_MINUTES: number;
export const FTW_ORDER_ID_FILTER: { $regex: string; $options: string };
export const FTW_PENDING_FILTER: RegExp;
export const FTW_FAILED_FILTER: RegExp;
export const FTW_UNSETTLED_PAYMENT_FILTER: {
  $in: RegExp[];
};
export function buildFtwPaymentExpiryBackfillFilter(): Record<string, unknown>;
export function buildFtwPaymentExpiryExtensionFilter(): Record<string, unknown>;
export function buildFtwPaymentExpiryPipeline(): unknown[];
export function buildExpiredFtwPaymentFilter(
  paymentStatusFilter: unknown,
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
