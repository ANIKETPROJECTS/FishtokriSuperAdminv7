export interface ExpiryBatch {
  expiryDate?: Date | string | null;
}

export declare function sortBatchesByExpiry<T extends ExpiryBatch>(
  batches: T[],
): T[];
