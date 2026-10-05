/**
 * Sort by expiry only. Equal-expiry batches stay in their existing array order;
 * creation, receipt, and stock-edit timestamps do not affect order deductions.
 */
export function sortBatchesByExpiry(batches) {
  return [...batches].sort((a, b) => {
    const aExpiry = expiryTimestamp(a.expiryDate);
    const bExpiry = expiryTimestamp(b.expiryDate);
    if (aExpiry === bExpiry) return 0;
    return aExpiry < bExpiry ? -1 : 1;
  });
}

function expiryTimestamp(expiryDate) {
  if (expiryDate == null) return Infinity;
  const timestamp = new Date(expiryDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : Infinity;
}
