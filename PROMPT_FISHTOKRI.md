# Bug report: Delivery charge missing on some digital-menu orders (#FTW...)

## Summary

Orders placed through the digital menu (order IDs prefixed `#FTW...`) sometimes save with
**zero delivery charge** even though the customer's pincode has a valid, non-zero delivery
charge configured for that sub-hub. This is intermittent — the same pincode is charged
correctly on some orders and not on others, so it is **not** a missing/misconfigured pincode
issue. It looks like a timing/race-condition bug in the checkout flow that computes the
delivery charge.

## Evidence

I checked the live orders in MongoDB (`orders` database, `orders` collection) and the sub-hub's
pincode-charge config (`fishtokri_admin.sub_hubs.pincodes`, sub-hub "Thane"). Every pincode below
has a correctly configured, non-zero charge in the config:

| Pincode | Configured charge |
|---|---|
| 400601 | ₹49 |
| 400607 | ₹49 |
| 400610 | ₹49 |
| 400615 | ₹49 |
| 400078 | ₹49 |
| 400081 | ₹49 |

But real `#FTW` orders delivering to these exact pincodes show inconsistent charges:

| Order ID | Created | Pincode | slotCharge saved | deliveryCharge saved | Expected charge |
|---|---|---|---|---|---|
| #FTW202607055 | 2026-07-05 | 400607 | 49 | — | 49 ✅ |
| #FTW202607056 | 2026-07-05 | 400601 | 49 | — | 49 ✅ |
| #FTW202607081 | 2026-07-08 | 400078 | 49 | — | 49 ✅ |
| #FTW202607082 | 2026-07-08 | 400610 | 49 | — | 49 ✅ |
| #FTW202607121 | 2026-07-12 | 400610 | 49 | — | 49 ✅ |
| #FTW202607123 | 2026-07-12 | 400081 | 49 | — | 49 ✅ |
| #FTW202607071 | 2026-07-07 | 400601 | 0 | 0 | 49 ❌ |
| #FTW202607111 | 2026-07-11 | 400078 | 0 | 0 | 49 ❌ |
| #FTW202607112 | 2026-07-11 | 400615 | 0 | 0 | 49 ❌ |
| #FTW202607113 | 2026-07-11 | 400610 | 0 | 0 | 49 ❌ |
| #FTW202607114 | 2026-07-11 | 400610 | 0 | 0 | 49 ❌ |
| #FTW202607051 | 2026-07-05 | 400081 | 0 | 49 | 49 ✅ (via deliveryCharge field instead of slotCharge) |

Key observations:
- **Same pincode, different outcome**: `400610` and `400601` each appear both correctly charged
  (₹49) and incorrectly charged (₹0) on different orders. This rules out a stale/missing pincode
  config as the cause — the config was correct the whole time.
- **Two different fields get used**: most "correct" orders save the charge into `slotCharge`.
  A few orders (`#FTW202607051`, and all the broken ones) instead have an explicit `deliveryCharge`
  field on the order (sometimes 0, once correctly 49). This suggests there are two different code
  paths in the checkout flow that can end up writing the delivery fee, and one of them is
  unreliable.
- All affected orders have `deliveryType: "delivery"` and a fully-populated
  `deliveryAddressDetail.pincode` — the address/pincode data itself is fine and present at order
  save time.
- This is not a one-time incident — it has recurred on at least 5 different dates between
  2026-07-05 and 2026-07-11, so it's a live, ongoing bug, not a one-off fluke.

## What this looks like from the code

The admin backend (a separate Replit project) does **not** compute the delivery charge itself —
it trusts whatever `slotCharge` / `deliveryCharge` value the order-creation request already
contains. So the bug is not on the admin/API side; it has to be in the digital menu's own
checkout code that looks up the pincode's delivery charge and attaches it to the order before
submitting.

## What to look for and fix (in the digital menu project)

1. **Race condition on submit.** Find wherever the checkout screen fetches/looks up the delivery
   charge for the entered/selected pincode (likely an async call or a value derived from address
   state). Check whether the "Place Order" submit handler can fire *before* that async lookup has
   resolved and been written into the order-creation payload. If the user selects an address and
   immediately taps "Place order," the charge might still be at its initial default (`0`) when the
   payload is built.
2. **Stale state after address change.** Check whether changing/selecting a delivery address (or
   re-selecting a saved address) after the delivery charge was already computed can leave a stale
   `0` in state if the recompute isn't triggered again, or is triggered but not awaited.
3. **Two code paths writing the charge.** There appear to be two different mechanisms that end up
   setting the order's delivery fee — one that writes to `slotCharge` (usually correct) and one
   that writes to `deliveryCharge` (mostly broken, returning 0). Find both and check why the
   second one so often computes 0 despite a valid, non-zero pincode charge existing. Consider
   consolidating to a single, reliable code path.
4. **Add a guard/log.** Before submitting the order, log (or assert) the computed delivery charge
   next to the pincode it was computed for, so future occurrences are easy to catch from logs
   instead of by noticing missing revenue days later.
5. **Recommended structural fix:** if possible, don't let the checkout screen submit until the
   delivery-charge lookup for the current address has definitively resolved (show a loading state
   on the "Place order" button until then), rather than allowing a submit with a charge value that
   might still be the unresolved default.

## Why this matters

Every order that slips through with `slotCharge`/`deliveryCharge` = 0 is a real, delivered order
where FishTokri is not collecting the ₹49 (or configured) delivery fee it should be — this is a
recurring revenue leak, not just a display issue.
