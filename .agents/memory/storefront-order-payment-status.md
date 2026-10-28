---
name: Storefront payment lifecycle differs by source
description: Preserve FTN's legacy payment lifecycle and FTW pending, completed, and failed payment handling while showing completed as Paid in Admin.
---

## Rule
Treat FTN and FTW payment states separately. Keep FTN's existing paid-on-arrival behavior unchanged. FTW orders begin pending and must remain on hold until payment is completed; accept a completed settlement after a provisional failed signal while the seven-minute payment window is open. A completed payment displays as Paid across Admin payment-status views without changing its stored status. If an FTW update says unpaid while a positive total is fully covered by paidAmount and dueAmount is zero, normalize it to paid. In invoices, a paid status is authoritative over stale or missing paid/due amount fields: display the invoice total as paid and zero due. Keep failed FTW orders intact through the payment window, then allow cleanup and inventory restoration if they remain failed. Payment auto-fixes must not overwrite pending or failed FTW records.

**Why:** A provisional failure can arrive before a delayed successful capture update; immediate cleanup can delete a legitimately paid FTW order.

**How to apply:** When changing FT* payment callbacks, migrations, Admin payment logic, or invoice display, branch by order source instead of applying one payment lifecycle rule to all storefront orders. FTW checkout must write `completed` on successful settlement; a prior `failed` state may be superseded only within the seven-minute payment window. Normalize `completed` to Paid at the display/filter layer; normalize `unpaid` to `paid` only when the recorded paid amount covers the positive total and due is zero. When status is paid, derive invoice paid/due amounts from the displayed total rather than stale amount fields. Do not overwrite pending or failed states or hard-delete failed orders before expiry.
