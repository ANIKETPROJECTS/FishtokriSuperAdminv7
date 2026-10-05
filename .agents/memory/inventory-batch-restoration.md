---
name: Batch restoration provenance
description: Product rule for returning inventory when an order is reversed.
---

When an order is cancelled, rejected, deleted, or otherwise restored, each quantity must return to the exact batch from which that order deducted it; do not put it into whichever batch is currently newest or active.

**Why:** The user explicitly requires restores to preserve the source-batch allocation across all order restore paths.

**How to apply:** Keep the same source-batch rule for every restoration entry point. Historical multi-batch deductions made before per-batch quantities were recorded cannot be reconstructed exactly; surface that limitation rather than claiming precision.
