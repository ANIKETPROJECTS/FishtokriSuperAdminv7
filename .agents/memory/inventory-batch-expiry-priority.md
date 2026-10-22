---
name: Batch deduction priority
description: Product rule for which unexpired inventory batch an order consumes first.
---

Order deductions must skip expired or empty batches, then consume eligible quantities globally by FIFO using each quantity lot's added timestamp, regardless of batch or expiry order. A batch can contain multiple dated quantity lots. Older stock without lot history is represented by one legacy lot using its recorded received date, then created date, then the current time.

**Why:** The user changed the inventory rule: FIFO is based on when each quantity was added, while expiry remains an eligibility gate. Batch receipt date and expiry only seed history for old stock that has no per-add record.

**How to apply:** Keep quantity-lot history synchronized on receipts, manual additions/removals, order deductions, and restores. Order restores must return stock to its original batch and quantity lot. Display each batch's dated additions in the inventory UI.
