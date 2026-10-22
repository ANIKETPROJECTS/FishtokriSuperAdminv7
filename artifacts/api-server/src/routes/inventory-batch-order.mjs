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

/**
 * Plan FIFO deduction across batches and their dated quantity lots.
 * Batches passed to this function must already be filtered for expiry.
 */
export function planBatchConsumption(batches, quantity) {
  let remaining = Math.max(0, Number(quantity) || 0);
  const allocations = [];
  const lots = batches.flatMap((batch, batchIndex) => {
    const quantityLots = Array.isArray(batch.quantityLots) && batch.quantityLots.length > 0
      ? batch.quantityLots
      : Number(batch.quantity) > 0
        ? [{
            _id: `legacy-${String(batch._id ?? batch.batchNumber ?? batchIndex)}`,
            quantity: Number(batch.quantity) || 0,
            addedQuantity: Number(batch.quantity) || 0,
            addedAt: batch.receivedDate ?? batch.createdAt ?? new Date(0),
          }]
        : [];
    return quantityLots.map((lot, lotIndex) => ({
      batch,
      lot,
      batchIndex,
      lotIndex,
      addedAt: eventTime({ createdAt: lot.addedAt }),
    }));
  }).sort((a, b) => a.addedAt - b.addedAt || a.batchIndex - b.batchIndex || a.lotIndex - b.lotIndex);

  for (const { batch, lot } of lots) {
    if (remaining <= 0) break;
    const take = Math.min(Math.max(0, Number(lot.quantity) || 0), remaining);
    if (take <= 0) continue;
    allocations.push({
      batchId: batch._id,
      batchNumber: batch.batchNumber || undefined,
      lotId: lot._id,
      lotAddedAt: lot.addedAt,
      quantity: take,
    });
    remaining -= take;
  }

  return { allocations, remaining };
}

/**
 * Return deductions that have not yet been reversed. New restore movements
 * explicitly reference their deduction movement IDs. Older movements did not
 * have references, so pair those in chronological order for compatibility.
 */
export function getOutstandingDeductionMovements(deductions, restores) {
  const restoredIds = new Set();
  const legacyRestores = [];

  for (const restore of restores) {
    const refs = Array.isArray(restore.reversesMovementIds)
      ? restore.reversesMovementIds
      : restore.reversesMovementId != null
        ? [restore.reversesMovementId]
        : [];
    if (refs.length > 0) {
      for (const id of refs) restoredIds.add(String(id));
    } else {
      legacyRestores.push(restore);
    }
  }

  const legacyDeductions = deductions
    .filter((movement) => !Array.isArray(movement.batchAllocations))
    .sort((a, b) => eventTime(a) - eventTime(b));
  const pendingLegacyIds = legacyDeductions
    .filter((movement) => !restoredIds.has(String(movement._id)))
    .map((movement) => String(movement._id));

  const legacyEvents = [
    ...legacyDeductions
      .filter((movement) => pendingLegacyIds.includes(String(movement._id)))
      .map((movement) => ({ kind: "deduct", movement })),
    ...legacyRestores.map((movement) => ({ kind: "restore", movement })),
  ].sort((a, b) => {
    const timeDifference = eventTime(a.movement) - eventTime(b.movement);
    if (timeDifference !== 0) return timeDifference;
    if (a.kind === b.kind) return 0;
    return a.kind === "deduct" ? -1 : 1;
  });

  const unmatchedLegacyDeductions = [];
  for (const event of legacyEvents) {
    if (event.kind === "deduct") unmatchedLegacyDeductions.push(String(event.movement._id));
    else if (unmatchedLegacyDeductions.length > 0) {
      restoredIds.add(unmatchedLegacyDeductions.shift());
    }
  }

  return deductions.filter((movement) => !restoredIds.has(String(movement._id)));
}

/**
 * Restore each allocation to its original batch ID. If that batch was removed,
 * recreate it from the metadata captured at deduction time. Legacy allocations
 * without IDs can target a unique batch number.
 */
export function restoreBatchAllocations(batches, allocations) {
  const restoredBatches = batches.map((batch) => ({
    ...batch,
    quantityLots: Array.isArray(batch.quantityLots) ? batch.quantityLots.map((lot) => ({ ...lot })) : [],
  }));
  const restoredAllocations = [];
  const unmatchedAllocations = [];

  for (const allocation of allocations) {
    const quantity = Math.max(0, Number(allocation.quantity) || 0);
    if (quantity === 0) continue;

    let index = -1;
    if (allocation.batchId != null) {
      index = restoredBatches.findIndex(
        (batch) => batch._id != null && String(batch._id) === String(allocation.batchId),
      );
    } else if (allocation.batchNumber) {
      index = restoredBatches.findIndex(
        (batch) => String(batch.batchNumber ?? "") === String(allocation.batchNumber),
      );
    }

    if (index >= 0) {
      const batch = restoredBatches[index];
      const lotId = allocation.lotId ?? `restored-${String(allocation.deductionMovementId ?? Date.now())}`;
      let lot = batch.quantityLots.find((entry) => String(entry._id) === String(lotId));
      if (!lot) {
        lot = {
          _id: lotId,
          quantity: 0,
          addedQuantity: quantity,
          addedAt: allocation.lotAddedAt ?? allocation.batchSnapshot?.receivedDate ?? new Date(),
          source: "legacy-restored",
        };
        batch.quantityLots.push(lot);
      }
      lot.quantity = (Number(lot.quantity) || 0) + quantity;
      lot.addedQuantity = Math.max(Number(lot.addedQuantity) || 0, Number(lot.quantity) || 0);
      batch.quantity = (Number(batch.quantity) || 0) + quantity;
      restoredAllocations.push(allocation);
      continue;
    }

    if (allocation.batchId != null && allocation.batchSnapshot) {
      const lotId = allocation.lotId ?? `restored-${String(allocation.deductionMovementId ?? Date.now())}`;
      restoredBatches.push({
        ...allocation.batchSnapshot,
        _id: allocation.batchId,
        quantity,
        quantityLots: [{
          _id: lotId,
          quantity,
          addedQuantity: quantity,
          addedAt: allocation.lotAddedAt ?? allocation.batchSnapshot.receivedDate ?? new Date(),
          source: "legacy-restored",
        }],
      });
      restoredAllocations.push(allocation);
      continue;
    }

    unmatchedAllocations.push(allocation);
  }

  return { batches: restoredBatches, restoredAllocations, unmatchedAllocations };
}

function expiryTimestamp(expiryDate) {
  if (expiryDate == null) return Infinity;
  const timestamp = new Date(expiryDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : Infinity;
}

function eventTime(movement) {
  const timestamp = new Date(movement.createdAt ?? 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
