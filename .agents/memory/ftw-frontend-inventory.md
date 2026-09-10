---
name: FTW frontend-owned inventory
description: FTW payment inventory ownership and the coordination required with the admin API.
---

FTW inventory has two ownership phases: the trusted FTW application owns the initial UPI reservation and payment-outcome restoration; explicit authenticated admin order mutations own subsequent FTW edits, cancellations, rejections, deletes, and restores through the normal admin inventory flow. The unattended admin scanner still excludes FTW orders.

**Why:** The admin background scanner can see an undeducted FTW order after it is inserted, causing a race with frontend-owned processing. Explicit admin actions are different: once an administrator changes the order, inventory must follow that deliberate admin lifecycle change.

**How to apply:** Keep the background scanner excluded from FTW orders, but pass an explicit admin-only override for authenticated order update/delete/restore flows. Preserve batch/FIFO, movement history, locking, and idempotency. See the root `prompt.md` for the full contract.