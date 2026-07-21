# Bug Fix: Inventory Not Deducted for FTW Orders Without Sub Hub

## Affected Order
- **Order ID:** #FTW202607211
- **Customer:** Deepak Deshpande
- **Date:** 21 Jul 2026
- **Status at discovery:** Delivered — inventory never deducted
- **Resolution:** Manually adjusted by admin

---

## Root Cause

The order was pushed from the **FishTokri storefront website** (separate project) **without a `subHubId` or `subHubName`** in the order payload.

The admin API's inventory deduction logic (`orderShouldDeduct` in `artifacts/api-server/src/routes/inventory.ts`) has an explicit guard:

```ts
function orderShouldDeduct(order: OrderForSync) {
  if (!order || !order.subHubId) return false;   // ← skips silently if no sub hub
  ...
}
```

Because the storefront did not include a sub hub when creating the order, `subHubId` was empty (`—` in the Sub Hub column on the orders page). Every deduction attempt — on order creation, on status change to `confirmed`, and by the background deduction job — saw no `subHubId` and silently skipped. The order was eventually delivered with zero inventory deducted.

**Why another FTW order (Gauri Sawant, #FTW2026072212) worked fine:** Her order was pushed from the storefront *after* the storefront was fixed to include the sub hub, so `subHubId` was present and deduction ran correctly.

---

## Fix Applied (This Project — Admin Panel)

To prevent this from silently happening again if an order ever arrives without a sub hub, the **Accept button** in the admin orders page now intercepts the confirm action when `subHubId` is missing.

**Before:** Clicking Accept sent `{ status: "confirmed" }` only — no sub hub — allowing the order to be confirmed and delivered without any inventory deduction.

**After:** If the order has no `subHubId`, a dialog appears requiring the admin to assign a sub hub before confirming. The payload then includes `subHubId` + `subHubName`, so the backend's deduction guard passes and stock is deducted correctly.

**File changed:** `artifacts/fishtokri-admin/src/pages/orders.tsx`
- `acceptOrder()` — checks for `subHubId`; opens sub-hub picker dialog if missing
- New dialog: "Assign Sub Hub to Accept Order" with a warning about missing inventory deduction

---

## Fix Required (Storefront Website — Separate Project)

The **primary fix** must be applied to the storefront website that creates FTW orders. When a customer places an order, the storefront must include the correct `subHubId` and `subHubName` in the order creation payload sent to `POST /api/orders`.

Without this, orders arrive in the admin panel with no sub hub and inventory cannot be deducted regardless of admin actions.

**What to check in the storefront project:**
1. The order creation payload — ensure `subHubId` and `subHubName` are populated before the API call.
2. The sub hub selection / slot selection flow — the selected sub hub must be carried through to the final order submission.
3. Any cases where the slot or area selector resolves a delivery zone but does not set a `subHubId` — those orders will arrive without one.

---

## Summary

| Layer | Issue | Status |
|---|---|---|
| Storefront website | Order pushed without `subHubId` | ⚠️ Needs fix in storefront project |
| Admin panel (this project) | Accept button allowed confirm with no sub hub, inventory silently skipped | ✅ Fixed — dialog now blocks accept without sub hub |
| Affected order | #FTW202607211 Deepak Deshpande — inventory not deducted | ✅ Manually adjusted by admin |
