/**
 * Classifies status-update inventory work before any database mutation.
 * Baseline protection blocks backfills and item reconciliation, but it must
 * never block the inverse of a deduction when an active order is cancelled.
 */
export function getInventoryUpdateAction({
  baselineProtected,
  wasDeducted,
  wasActive,
  wantsDeducted,
}) {
  if (wasDeducted && wasActive && !wantsDeducted) {
    return "restore";
  }
  if (baselineProtected) {
    return "skip";
  }
  if (!wasDeducted && wantsDeducted) {
    return "deduct";
  }
  if (wasDeducted && wantsDeducted) {
    return "reconcile";
  }
  return "unchanged";
}