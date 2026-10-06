---
name: Storefront payment lifecycle differs by source
description: Preserve FTN's legacy payment lifecycle and FTW pending, completed, and failed payment handling while showing completed as Paid in Admin.
---

## Rule
Treat FTN and FTW payment states separately. Keep FTN's existing paid-on-arrival behavior unchanged. FTW orders begin pending and must remain on hold until payment is completed; a completed payment displays as Paid across Admin payment-status views without changing its stored status. In invoices, a paid status is authoritative over stale or missing paid/due amount fields: display the invoice total as paid and zero due. A failed FTW payment must remain recorded until Admin soft-deletes the order and restores inventory. Payment auto-fixes must not overwrite pending or failed FTW records.

**Why:** A blanket assumption that all storefront orders are already paid can unlock FTW fulfillment too early or erase the failure signal needed for inventory recovery.

**How to apply:** When changing FT* payment callbacks, migrations, Admin payment logic, or invoice display, branch by order source instead of applying one payment lifecycle rule to all storefront orders. FTW checkout must write `completed` on successful settlement and retain `failed` until Admin cleanup. Normalize `completed` to Paid only at the display/filter layer; when status is paid, derive invoice paid/due amounts from the displayed total rather than stale amount fields. Do not rewrite stored payment statuses or hard-delete failed orders first.
