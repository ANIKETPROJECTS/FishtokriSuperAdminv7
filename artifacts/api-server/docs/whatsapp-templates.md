# WhatsApp Templates — FishTokri

All templates are sent via the Admark Verified WhatsApp API and must be
submitted through the Admark dashboard for Meta approval before they can
be used.

---

## Template 1a — `fishtokri_confirmed`
**Used for:** Order confirmed, **no wallet payment applied**
**Variables:** 14

### Body
```
Hello {{1}},

Your FishTokri order has been *confirmed and accepted!*

*Order ID:* #{{2}}

*ORDER SUMMARY*
{{3}}
{{4}}
{{5}}
{{6}}
{{7}}

Subtotal:      ₹{{8}}
Discount:     -₹{{9}}
Delivery:      ₹{{10}}
*TOTAL:        ₹{{11}}*

*Payment:* {{12}}
*Deliver to:* {{13}}
⏰ *Delivery Time:* {{14}}

Your fresh seafood is being prepared. We'll notify you when it's out for delivery!

— Team FishTokri
```

### Variable mapping
| # | Value |
|---|-------|
| 1 | Customer first name |
| 2 | Order ID (e.g. FTS202607051) |
| 3–7 | Item lines (e.g. `1. Baby Rawas - Small x1 - Rs.475`). Unused slots filled with a single space. |
| 8 | Subtotal (number only, e.g. `1770`) |
| 9 | Discount amount (number only, e.g. `416`) |
| 10 | Delivery charge (number only, e.g. `56`) |
| 11 | Grand total (number only, e.g. `1410`) |
| 12 | Payment mode (e.g. `Cash on Delivery`, `UPI`, `Wallet`) |
| 13 | Delivery address |
| 14 | Delivery time (e.g. `05 Jul 2026, 12:30 PM - 01:00 PM`) |

---

## Template 1b — `fishtokri_confirmed_wallet`  ← **NEW — submit for approval**
**Used for:** Order confirmed, **wallet balance was applied**
**Variables:** 16

### Body
```
Hello {{1}},

Your FishTokri order has been *confirmed and accepted!*

*Order ID:* #{{2}}

*ORDER SUMMARY*
{{3}}
{{4}}
{{5}}
{{6}}
{{7}}

Subtotal:      ₹{{8}}
Discount:     -₹{{9}}
Delivery:      ₹{{10}}
*TOTAL:        ₹{{11}}*
Wallet:       -₹{{12}}
*Due:          ₹{{13}}*

*Payment:* {{14}}
*Deliver to:* {{15}}
⏰ *Delivery Time:* {{16}}

Your fresh seafood is being prepared. We'll notify you when it's out for delivery!

— Team FishTokri
```

### Variable mapping
| # | Value |
|---|-------|
| 1 | Customer first name |
| 2 | Order ID (e.g. FTS202607051) |
| 3–7 | Item lines (same as Template 1a) |
| 8 | Subtotal |
| 9 | Discount amount |
| 10 | Delivery charge |
| 11 | Grand total |
| **12** | **Wallet amount applied (e.g. `152`)** |
| **13** | **Amount due in cash/UPI after wallet (e.g. `1258`)** |
| 14 | Payment mode |
| 15 | Delivery address |
| 16 | Delivery time |

---

## Template 2 — `fishtokri_out_for_delivery`
**Used for:** Order out for delivery (all payment modes)
**Variables:** 4 — name, orderId, delivery person name, delivery person phone

---

## Template 3 — `fishtokri_order_cancelled`
**Used for:** Order cancelled
**Variables:** 3 — name, orderId, cancellation reason

---

## Notes
- Template variables **cannot** contain literal `\n`, `\r`, `\t`, or 4+ consecutive spaces — the whole send fails.
- Item slots beyond the order's actual item count are sent as a single space `" "` (Meta rejects empty strings).
- Orders with more than 5 items: items 5 onward are packed into slot {{7}}, joined with ` | `.
- The code automatically chooses between `fishtokri_confirmed` and `fishtokri_confirmed_wallet` based on whether any `payments[]` entry has `mode === "wallet"` and `amount > 0`.
