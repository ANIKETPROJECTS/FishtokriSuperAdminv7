# FishTokri — WhatsApp Business Templates

Templates to submit to **Meta Business Manager → WhatsApp Manager → Message Templates** for approval.

---

## Step 0 — Delete the existing template

In Meta Business Manager → WhatsApp Manager → Message Templates, find `welcome_to_fishtokri` and click **Delete**.
(Only possible if it is not actively used by a running campaign.)

---

## Template 1 — Order Confirmed (Bill)

| Field             | Value                          |
|-------------------|--------------------------------|
| **Template Name** | `fishtokri_order_confirmed`    |
| **Category**      | **Utility**                    |
| **Language**      | English                        |

**Header (Text):**
```
Order Confirmed ✅
```

**Body:**
```
Hello {{1}},

Your FishTokri order has been *confirmed and accepted!*

*Order ID:* #{{2}}

*ORDER SUMMARY*
{{3}}

Subtotal:      ₹{{4}}
Discount:     -₹{{5}}
Delivery:      ₹{{6}}
*TOTAL:        ₹{{7}}*

*Payment:* {{8}}
*Deliver to:* {{9}}

Your fresh seafood is being prepared. We'll notify you when it's out for delivery!

— Team FishTokri
```

**Footer:**
```
FishTokri – Fresh from the sea to your door
```

**Sample variable values (required by Meta):**

| Variable | Sample Value |
|----------|-------------|
| `{{1}}` | Rahul Sharma |
| `{{2}}` | ORD-2847 |
| `{{3}}` | • Rohu Fish 1kg × 2 — ₹480\n• Tiger Prawns 500g × 1 — ₹350\n• Surmai Steak 500g × 1 — ₹280 |
| `{{4}}` | 1110 |
| `{{5}}` | 50 |
| `{{6}}` | 30 |
| `{{7}}` | 1090 |
| `{{8}}` | Cash on Delivery |
| `{{9}}` | 12, Sea View Apartments, Kochi – 682001 |

> **Why Utility gets approved:** The body is purely transactional — it is a bill summary triggered by a customer action (placing an order). No promotional language, no offers, no CTAs to buy more.

---

## Template 1b — Order Confirmed v2 (fixed item lines, replaces Template 1)

> **Why a new template:** WhatsApp's Cloud API hard-rejects any template
> parameter value containing a literal newline (`\n`) — the whole send fails
> with `(#100) Invalid parameter`. A Unicode line-separator workaround
> (`U+2028`) was also tried and confirmed broken — it arrives as a garbled
> `�` character on the customer's phone. The only reliable way to get a
> genuine one-item-per-line layout is to make each item line **static
> template text** with its own variable, instead of packing a whole list
> into a single free-text variable. This template supports **up to 10
> items**; orders with more collapse the extra into a single
> "+N more items" line (see `buildOrderConfirmedItemSlots()` in
> `artifacts/api-server/src/services/whatsapp.ts`, already implemented and
> ready to wire in once this template is approved).
>
> This also moves the delivery time onto its own dedicated line below the
> address (its own variable, not appended to the address text).
>
> Once approved, tell the agent the exact template name Meta/Admark assigns
> and it will switch the backend over to use it.

| Field             | Value                            |
|-------------------|-----------------------------------|
| **Template Name** | `fishtokri_order_confirmed_v2`    |
| **Category**      | **Utility**                       |
| **Language**      | English                           |

**Header (Text):**
```
Order Confirmed ✅
```

**Body:**
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
{{8}}
{{9}}
{{10}}
{{11}}
{{12}}

Subtotal:      ₹{{13}}
Discount:     -₹{{14}}
Delivery:      ₹{{15}}
*TOTAL:        ₹{{16}}*

*Payment:* {{17}}
*Deliver to:* {{18}}
⏰ *Delivery Time:* {{19}}

Your fresh seafood is being prepared. We'll notify you when it's out for delivery!

— Team FishTokri
```

**Footer:**
```
FishTokri – Fresh from the sea to your door
```

**Sample variable values (required by Meta):**

| Variable | Sample Value |
|----------|-------------|
| `{{1}}`  | Rahul Sharma |
| `{{2}}`  | ORD-2847 |
| `{{3}}`  | 1. Rohu Fish 1kg x2 - Rs.480 |
| `{{4}}`  | 2. Tiger Prawns 500g x1 - Rs.350 |
| `{{5}}`  | 3. Surmai Steak 500g x1 - Rs.280 |
| `{{6}}`  | (single space) |
| `{{7}}`  | (single space) |
| `{{8}}`  | (single space) |
| `{{9}}`  | (single space) |
| `{{10}}` | (single space) |
| `{{11}}` | (single space) |
| `{{12}}` | (single space) |
| `{{13}}` | 1110 |
| `{{14}}` | 50 |
| `{{15}}` | 30 |
| `{{16}}` | 1090 |
| `{{17}}` | Cash on Delivery |
| `{{18}}` | 12, Sea View Apartments, Kochi – 682001 |
| `{{19}}` | 03 Jul 2026, 09:30 PM - 10:30 PM |

> **Note on unused item slots:** orders with fewer than 10 items pass a
> single space `" "` for the unused `{{n}}` variables — Meta does not allow
> an empty string as a variable value. This renders as a blank line at the
> bottom of the item list; it's a minor, accepted cosmetic trade-off for a
> fixed-structure template with a variable-length list.
>
> **Do not delete Template 1** (`fishtokri_order_confirmed`) until v2 is
> approved and the backend has been switched over and verified — it is the
> live fallback.

---

## Template 2 — Out for Delivery (Prepaid / UPI orders)

| Field             | Value                              |
|-------------------|------------------------------------|
| **Template Name** | `fishtokri_out_for_delivery`       |
| **Category**      | **Utility**                        |
| **Language**      | English                            |

**Header (Text):**
```
Out for Delivery 🚚
```

**Body:**
```
Hello {{1}},

Your FishTokri order *#{{2}}* is now *Out for Delivery!*

*Your Delivery Partner:*
👤 {{3}}
📞 {{4}}

Feel free to call your delivery partner for live updates.

Thank you for choosing FishTokri! 🐟

— Team FishTokri
```

**Sample variable values:**

| Variable | Sample Value |
|----------|-------------|
| `{{1}}` | Rahul Sharma |
| `{{2}}` | ORD-2847 |
| `{{3}}` | Mohammed Arif |
| `{{4}}` | +91 98765 43210 |

---

## Template 3 — Out for Delivery with Payment Link (COD orders only)

| Field             | Value                                  |
|-------------------|----------------------------------------|
| **Template Name** | `fishtokri_out_for_delivery_cod`       |
| **Category**      | **Utility**                            |
| **Language**      | English                                |

> ⚠️ **No dynamic button URL** — Admark's `/api/send/bytemplate` API cannot pass button URL
> variables separately from body variables. The payment link is included as `{{6}}` in the
> body text instead. Delete the old template (which had a dynamic "Pay Now" button) and
> recreate it exactly as shown below.

**Header (Text):**
```
Out for Delivery 🚚
```

**Body:**
```
Hello {{1}},

Your FishTokri order *#{{2}}* is now *Out for Delivery!*

*Amount Due:* ₹{{3}}

*Your Delivery Partner:*
👤 {{4}}
📞 {{5}}

⏱️ *Save time — pay online before delivery arrives!*
Pay securely via Razorpay (no cash needed at the door):
{{6}}

— Team FishTokri
```

**No button / Interactive Actions** — leave the Interactive Actions section empty. Do NOT add a URL button.

**Sample variable values:**

| Variable | Sample Value                    |
|----------|---------------------------------|
| `{{1}}`  | Rahul Sharma                    |
| `{{2}}`  | ORD-2847                        |
| `{{3}}`  | 1090                            |
| `{{4}}`  | Mohammed Arif                   |
| `{{5}}`  | +91 98765 43210                 |
| `{{6}}`  | https://rzp.io/l/AbCd1234       |

---

## Template 4 — Order Cancelled

| Field             | Value                        |
|-------------------|------------------------------|
| **Template Name** | `fishtokri_order_cancelled`  |
| **Category**      | **Utility**                  |
| **Language**      | English                      |

**Header (Text):**
```
Order Cancelled
```

**Body:**
```
Hello {{1}},

We're sorry — your FishTokri order *#{{2}}* has been *cancelled*.

*Reason:* {{3}}

If you paid online, your refund will be processed within *5–7 business days* to the original payment method.

We apologise for the inconvenience. Reach out to our support team if you have any questions.

We look forward to serving you again! 🐟

— Team FishTokri
```

**Sample variable values:**

| Variable | Sample Value                  |
|----------|-------------------------------|
| `{{1}}` | Rahul Sharma                   |
| `{{2}}` | ORD-2847                       |
| `{{3}}` | Item unavailable at hub        |

> **Tip for `{{3}}` — Cancellation reason:** Keep a small fixed list in the admin panel, for example:
> - Item unavailable at hub
> - Customer request
> - Hub closed
> - Delivery not possible to your area
>
> Meta reviewers check the sample value — keep it neutral and factual.

---

## Submission Checklist

- [ ] All 4 templates use **Utility** category — cheaper per conversation than Marketing, approved faster
- [ ] Template names are lowercase with underscores, no spaces
- [ ] Every `{{n}}` variable has a realistic sample value filled in (Meta rejects templates with `{{1}}` left blank)
- [ ] For Template 3, the Razorpay base domain matches your Razorpay account's configured domain
- [ ] `welcome_to_fishtokri` has been deleted from Meta dashboard
- [ ] Once approved (usually 24–48 hrs), backend integration can be implemented to fire these automatically on order status changes

---

## Approval Tips

- **Utility templates** are approved faster and cost less per conversation than Marketing. All four templates qualify as Utility because they are triggered by customer actions, not outbound promotions.
- **Template 3 (COD payment link):** If Meta asks for clarification, note that the payment link is generated per-order and sent only when the order is already confirmed and out for delivery — it is transactional, not solicited marketing.
- **Avoid edits after submission.** If a template is rejected, you must create a new one with a different name — you cannot edit a submitted template.
