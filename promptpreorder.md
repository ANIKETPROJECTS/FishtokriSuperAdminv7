# Customer-Facing Preorder Availability in the Cart

## Goal

Update the FishTokri customer-facing digital menu checkout so preorder products show their configured availability inside the cart/order-summary panel.

The admin product editor already supports two product sales modes:

- `normal`
- `preorder_only`

Preorder-only products can also have an optional `preorderAvailability` schedule. The customer must see that schedule while ordering and must only be able to select a delivery date that is valid for every preorder product currently in the cart.

Use the existing FishTokri checkout design and order-summary drawer. The attached reference image shows the target surface: a right-side **Order Summary** panel containing bill details, shipping address, delivery date, and delivery time slots.

Do not create a second cart, order collection, or preorder-specific checkout flow.

---

## Existing product availability contract

Product data may include:

```json
{
  "preorderMode": "preorder_only",
  "preorderAvailability": {
    "type": "all",
    "weekdays": [0, 1, 2, 3, 4, 5, 6],
    "startDate": "",
    "endDate": ""
  }
}
```

The supported availability types are:

### 1. All dates

```json
{
  "type": "all"
}
```

The product can be ordered for any valid future preorder date.

### 2. Selected weekdays

```json
{
  "type": "weekdays",
  "weekdays": [1, 3, 5]
}
```

Weekday numbers use:

- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

The product can be ordered only when the selected delivery date falls on one of those weekdays.

### 3. Specific date or date range

```json
{
  "type": "date_range",
  "startDate": "2026-08-07",
  "endDate": "2026-08-21"
}
```

Both dates are inclusive. If `startDate` and `endDate` are the same, the product is available on one specific date only.

### 4. Date range plus selected weekdays

```json
{
  "type": "date_range_and_weekdays",
  "weekdays": [1, 3, 5],
  "startDate": "2026-08-07",
  "endDate": "2026-08-31"
}
```

This combined condition requires both rules to pass:

1. The delivery date must be inside the inclusive date range.
2. The delivery date's weekday must be one of the selected weekdays.

For example, a product configured for Monday, Wednesday, and Friday from 07 Aug 2026 through 31 Aug 2026 is available only on those weekdays within that range. Dates in the range that fall on Tuesday, Thursday, Saturday, or Sunday are not valid.

Dates are always `YYYY-MM-DD` values and must be interpreted in India Standard Time without a timezone shift.

Products created before this feature may not have `preorderAvailability`. Treat missing availability as:

```json
{
  "type": "all"
}
```

Do not reintroduce the retired `normal_and_preorder` product mode.

---

## Cart/order-summary UI

When the customer is in preorder mode, keep the existing right-side **Order Summary** layout and add availability information without disrupting:

- Bill details
- Shipping address
- Delivery date
- Delivery timeslot selection
- Total amount
- Payment button

### Product line items

Each preorder product line in the cart should show a concise availability label below or beside the product name.

Examples:

- `Available on all future dates`
- `Available on Mon, Wed, Fri`
- `Available from 07 Aug 2026 to 21 Aug 2026`
- `Available on 14 Aug 2026`

Use customer-friendly labels. Do not expose raw JSON or internal field names.

If the cart contains multiple preorder products, show the availability for each product individually so the customer can understand why a date is or is not selectable.

### Availability details

If space allows, provide a small `View availability` or calendar control for each product. It may open a popover, inline detail area, or compact modal, but it must remain usable on mobile.

The details should show:

- Product name
- Availability type
- Selected weekdays, if applicable
- Start and end dates, if applicable
- When both are configured, explain that both the date range and weekday must match.
- A clear note that the final delivery date must be valid for all products in the cart

Do not make availability details the only way to discover a product’s restriction. The compact summary must remain visible in the cart.

---

## Delivery-date selection

The preorder delivery-date control remains in the **Select Time Slot** section shown in the reference image.

When preorder products are in the cart:

1. Set the minimum selectable date to tomorrow in India Standard Time.
2. Allow the customer to choose any future date that is valid for every product in the cart.
3. Disable dates that are unavailable for one or more cart products.
4. Keep the selected date in `YYYY-MM-DD` format for API calls.
5. Show the selected date in a friendly display format such as `07 Aug 2026, Fri`.
6. Make it clear that the date applies to the entire cart/order.

### Important: use the intersection of product availability

A single order has one delivery date. Therefore, the valid preorder dates are the intersection of all cart-product schedules, not the union.

For example:

- Product A: Mondays and Wednesdays
- Product B: Wednesdays and Fridays
- Valid cart dates: Wednesdays only

Another example:

- Product A: 07 Aug 2026 through 21 Aug 2026
- Product B: 14 Aug 2026 through 28 Aug 2026
- Valid cart dates: 14 Aug 2026 through 21 Aug 2026

Products with `type: "all"` do not narrow the cart’s valid dates.

For `type: "date_range_and_weekdays"`, apply both restrictions before calculating the cart-wide intersection.

If the cart has no common valid date:

- Show a clear warning in the order summary.
- Do not allow checkout.
- Explain that the products have different preorder availability.
- Offer a useful action such as `Review products`, `Remove unavailable item`, or `Return to cart`.

Do not silently change, split, or move products between orders.

### Date picker behavior

The date picker must:

- Disable today and all past dates.
- Disable dates that do not match every product’s availability.
- Mark the currently selected date.
- Show a loading state while product or slot availability is being recalculated.
- Preserve the selected date when cart changes only if it remains valid.
- Clear the selected date and selected slot if the date becomes invalid.
- Show an empty-state message when no valid date exists.

For long date ranges, do not render thousands of individual buttons. Use the existing date-picker component with disabled-date logic.

---

## Product/cart state changes

Recalculate the valid preorder dates whenever any of these changes:

- A preorder product is added.
- A preorder product is removed.
- Product quantity changes from zero to a positive quantity or back to zero.
- The customer changes the preorder mode.
- Product data is refreshed from the API.
- The selected delivery date changes.

When a product is removed, recalculate the intersection and retain the selected date if it is still valid.

When a product is added:

- Recalculate immediately.
- If the selected date is not valid for the new product, clear the date and timeslot.
- Show which product caused the conflict.

When a product becomes unavailable for the selected date:

- Do not leave it in a state that can be submitted accidentally.
- Either remove it from the cart with a clear confirmation, or keep it visible but block checkout until the customer changes the date or removes the product.
- Prefer keeping the item visible and explaining the conflict so the customer does not lose cart work unexpectedly.

---

## Delivery timeslots

After the customer selects a valid date:

1. Fetch timeslots for that exact date.
2. Recalculate the date weekday.
3. Filter slots using the existing `activeDays` and `isActive` rules.
4. Apply exact-date capacity counts.
5. Clear the selected slot if it is no longer available.

Use the existing endpoint shape:

```text
GET /api/sub-hubs/{subHubId}/menu/timeslots?deliveryDate=YYYY-MM-DD
```

For a future preorder date, do not apply same-day-only time restrictions such as “starts more than 30 minutes from now”.

If no timeslot is available for a valid product date:

- Show `No delivery slots available for this date`.
- Do not allow checkout.
- Allow the customer to choose another valid date.

The product availability date rules and timeslot availability rules are separate filters. A date is selectable only when:

1. It is in the intersection of all product availability schedules, and
2. At least one delivery timeslot is available for that date.

---

## Checkout summary messaging

Use concise, friendly messaging in the order summary.

Suggested messages:

- `Delivery date applies to all preorder items`
- `Some items are available only on selected days`
- `Choose a date that works for every item in your cart`
- `This item is not available on the selected date`
- `No common preorder date is available for these items`
- `No delivery slots available for this date`

When there is a conflict, visually distinguish the warning from payment and bill totals. Use the existing FishTokri warning/error styling rather than browser alerts.

Do not show a generic “preorder unavailable” message when the specific product, weekday, or date range can be identified.

---

## Order payload

Once the customer selects a date valid for every cart product and a valid slot, submit the existing preorder order payload:

```json
{
  "orderType": "preorder",
  "deliveryType": "delivery",
  "scheduleType": "slot",
  "isExpress": false,
  "deliveryDate": "YYYY-MM-DD",
  "timeslotId": "selected-slot-id",
  "timeslotLabel": "12:00 PM – 01:00 PM",
  "timeslotStart": "12:00 PM",
  "timeslotEnd": "01:00 PM"
}
```

Do not send product availability as a replacement for the order delivery date. `preorderAvailability` is product eligibility metadata; `deliveryDate` is the date chosen for the order.

The order must continue through the existing shared storefront order flow and appear in the Admin Preorders section.

---

## Validation

Validate on the client for immediate feedback and on the server for correctness.

Before submission, reject the preorder if:

- The cart is empty.
- The cart contains a normal product in a preorder-only flow.
- No common future date exists for all preorder products.
- No delivery date is selected.
- The selected date does not satisfy every product’s `preorderAvailability`.
- The selected date is today or in the past.
- The selected date is not a valid `YYYY-MM-DD` date.
- The selected date has no available delivery slot.
- The selected timeslot is missing, disabled, or full for that date.
- No delivery address is selected.
- Takeaway or Express is selected.
- Payment details are invalid under the existing checkout rules.

The server must re-check product availability using the current product data. Never trust only the client-side disabled-date state because product schedules, inventory, and timeslot capacity can change while the checkout drawer is open.

If the server rejects the date because a product schedule changed:

- Keep the cart visible.
- Explain which item or date is no longer valid when the response provides that information.
- Clear the invalid date and slot.
- Ask the customer to choose another valid date.

---

## Checkout state and navigation

When switching between Today, Next Day, and Preorder:

- Keep the existing customer, address, cart, coupon, and payment behavior.
- Update scheduling state without leaving stale preorder values in normal orders.
- Recalculate product availability when entering preorder mode.
- Clear an invalid selected date and timeslot.
- Do not send `orderType: "preorder"` for Today or Next Day.
- Do not send `orderType: "normal"` for preorder.

When the order-summary drawer is reopened or restored from a saved cart, restore:

- Preorder mode
- Product availability labels
- The valid delivery-date set
- The selected delivery date
- The selected timeslot

Do not persist a date that is no longer valid for the current cart.

---

## Accessibility and responsive behavior

The cart/order-summary panel must remain usable at mobile widths like the reference image.

- Availability labels must be readable without hover.
- Disabled dates must have a non-color indicator or accessible explanation.
- Date-picker controls require visible labels.
- Product conflict messages must be announced or associated with the relevant cart item.
- Buttons must have clear text and adequate touch targets.
- Keyboard users must be able to reach product availability details, the date picker, slots, and checkout.
- Do not rely only on color to communicate available, unavailable, or conflicting states.

---

## Acceptance criteria

- A preorder product with `type: "all"` shows that it is available on all future dates.
- A weekday-limited product shows its selected weekday names in the cart.
- A date-range product shows its inclusive start and end dates in the cart.
- A combined date-range-and-weekdays product shows both restrictions in the cart.
- A single-date product shows the one date clearly.
- The cart displays availability for every preorder product.
- The delivery-date picker disables dates unavailable for any product in the cart.
- The valid dates are the intersection of all cart-product schedules.
- A combined schedule accepts only dates that satisfy both its range and weekday restrictions.
- Adding or removing a product recalculates valid dates immediately.
- A conflicting product/date combination cannot be submitted.
- A valid date still requires a valid delivery timeslot.
- Changing the date clears an invalid selected timeslot.
- The order payload retains `orderType: "preorder"` and the selected future `deliveryDate`.
- Existing Today and Next Day checkout behavior remains unchanged.
- The created order remains visible in Admin Preorders.