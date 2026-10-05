---
name: Batch deduction priority
description: Product rule for which unexpired inventory batch an order consumes first.
---

Order deductions must skip expired or empty batches, then consume available batches by earliest expiry date and time. Receipt, creation, and stock-edit timestamps must not influence priority. Batches with identical expiry timestamps are tied and retain their existing array order.

**Why:** The user specified expiry and availability as the only factors; changing when or where stock is adjusted must not reorder eligible batches.

**How to apply:** Use the same expiry-only ordering for order creation, recovery, re-deduction, and reconciliation. Do not add `createdAt` or `receivedDate` as a tie-breaker.
