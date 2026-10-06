export declare function normalizePaymentStatus(status: unknown): string;
export declare function isPaymentStatusPaid(status: unknown): boolean;
export declare function paymentStatusDisplayLabel(status: unknown): string;
export declare function isInvoicePaid(order: {
  paymentStatus?: unknown;
  orderId?: unknown;
  invoiceNo?: unknown;
} | null | undefined): boolean;
export declare function getInvoicePaymentAmounts(
  order: {
    paymentStatus?: unknown;
    paidAmount?: unknown;
    dueAmount?: unknown;
  } | null | undefined,
  grandTotal: unknown,
): { paidAmount: number; dueAmount: number };
