---
name: Storefront payment lifecycle differs by source
description: Preserve FTN's legacy paid-on-arrival behavior while keeping FTW pending, completed, and failed payments on their own lifecycle.
---

## Rule
Treat FTN and FTW payment states separately. Keep FTN's existing paid-on-arrival behavior unchanged. FTW orders begin pending and must remain on hold until payment is completed; treat `completed` as fully paid, including in invoices. A failed FTW payment must remain recorded until Admin soft-deletes the order and restores inventory. Payment auto-fixes must not overwrite pending or failed FTW records.

**Why:** A blanket assumption that all storefront orders are already paid can unlock FTW fulfillment too early or erase the failure signal needed for inventory recovery.

**How to apply:** When changing FT* payment callbacks, migrations, Admin payment logic, or invoice display, branch by order source instead of applying one payment rule to all storefront orders. FTW checkout must write `completed` on successful settlement and retain `failed` until Admin cleanup; invoices should display `completed` as Paid only for FTW orders; it must not hard-delete failed orders first.
