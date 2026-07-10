---
name: Wallet deduction must be threaded per order-type payment path
description: FishTokri admin new-order form builds the payments[] payload differently per deliveryType; wallet toggle only works if every branch reads the wallet-aware paymentEntries.
---

The new-order form (`artifacts/fishtokri-admin/src/pages/orders.tsx`) has a `paymentEntries` state that already
correctly reflects the "Use FishTokri Wallet" toggle (computed in a `useEffect` keyed on `useWallet`/`mainPaymentMode`/`newOrderTotal`).

**Bug pattern:** the final payload construction (`handleCreateOrder`) had a special-cased branch per `orderDeliveryType`
(e.g. takeaway forces "paid" and collects everything at pickup). That branch rebuilt the `payments` array from scratch
using only `mainPaymentMode`, silently ignoring `paymentEntries` — so the wallet portion was dropped even though the UI
showed it applied.

**Why:** any order-type-specific payment override must still derive from the wallet-aware `paymentEntries`, not
reconstruct payments from `mainPaymentMode` alone.

**How to apply:** when adding a new order type or delivery mode with its own payment-forcing logic, always pull the
wallet amount out of `paymentEntries` first (e.g. `paymentEntries.find(p => p.mode === "wallet")`) and layer the
type-specific override (forced "paid" status, immediate collection, etc.) on top of it, never instead of it.

Related hardening: the backend wallet-deduction step on order create (`artifacts/api-server/src/routes/orders.ts`)
previously deducted whatever `walletUsed` the client sent with no live-balance check (`$inc` unconditionally). It now
uses a conditional `updateOne` filter (`walletBalance: { $gte: walletUsed }`) so a stale client-computed amount can
never drive the balance negative under a race.
