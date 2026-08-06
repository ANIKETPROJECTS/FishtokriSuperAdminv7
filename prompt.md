# Digital Menu Preorder Feature

## Goal

Add preorder checkout support to the FishTokri digital menu website, which is the customer-facing frontend where users browse products and place orders.

The digital menu already supports:

- Today orders
- Next Day orders

Preorder is the remaining order mode. Customers must be able to select a future delivery date, choose an available delivery timeslot for that date, and place the order. The order must then appear in the existing FishTokri Admin **Preorders** section as a preorder order.

The existing admin panel and API already support:

- Product preorder modes
- `orderType: "normal"` and `orderType: "preorder"`
- Future delivery dates
- Delivery timeslots
- Date-specific timeslot capacity
- The Admin Preorders tab and filtering

Do not break the existing Today or Next Day checkout flows.

## Customer-facing checkout changes

### 1. Add a Preorder option beside Today and Next Day

In the checkout drawer shown in the existing digital menu, keep the current Today and Next Day options and add:

- `Today`
- `Next Day`
- `Preorder`

Use the existing FishTokri checkout visual style. Preorder should look like a deliberate third scheduling option, not like an error or disabled state.

When `Preorder` is selected:

- Show a future delivery date picker.
- Set the minimum selectable date to tomorrow in India Standard Time.
- Do not allow today or any past date.
- Keep the delivery address section visible.
- Keep payment selection visible.
- Hide or disable takeaway for preorder.
- Do not show an Express option for preorder.

### 2. Select a future date

The date picker must use the format `YYYY-MM-DD` for API values.

The customer should be able to select any valid future date supported by the business. Do not assume that every non-today date is tomorrow.

When the selected date changes:

- Reload the timeslot availability for that exact date.
- Recalculate the selected date’s weekday.
- Clear the selected timeslot if it is no longer available.
- Clear the selected timeslot if it is disabled for that weekday.
- Clear the selected timeslot if it has reached its capacity for that date.

### 3. Show date-specific delivery timeslots

After a preorder date is selected, show the same timeslot picker style used by Today and Next Day orders.

A slot is selectable only when all of the following are true:

- The slot is active.
- The slot is enabled for the selected date’s weekday using `activeDays`.
- The slot has not reached its order limit for the selected date.
- The slot is otherwise valid according to the existing normal-order rules.

For future preorder dates, do not apply the “slot starts more than 30 minutes from now” restriction. That restriction is only relevant to same-day orders.

If no slot is available:

- Show a clear message such as `No delivery slots available for this date`.
- Do not allow checkout to continue.

If one or more slots are available:

- Require the customer to select one.
- Display the slot label/start/end using the existing menu format.
- Include any existing slot charge in the order total.

The timeslot API request must include the selected date, for example:

```text
GET /api/sub-hubs/{subHubId}/menu/timeslots?deliveryDate=YYYY-MM-DD
```

The response should provide the configured slot data plus the count for the requested date. Use the exact-date count for capacity checks rather than treating every future date as tomorrow.

### 4. Filter products correctly

Use the existing product preorder mode values:

- `normal`
- `preorder_only`

For the normal Today and Next Day flows:

- Show products whose mode is `normal`.
- Treat products without a mode as `normal`.
- Do not show `preorder_only` products.

For the Preorder flow:

- Show `preorder_only` products.
- Do not show products that are `normal`.
- Respect each product's optional `preorderAvailability` schedule:
  - `type: "all"` means the product is available for every future date.
  - `type: "weekdays"` means only dates whose weekday number is included in `weekdays` are eligible (`0` = Sunday through `6` = Saturday).
  - `type: "date_range"` means only dates from `startDate` through `endDate`, inclusive, are eligible.
  - `type: "date_range_and_weekdays"` means the date must be within `startDate` through `endDate`, inclusive, and its weekday number must be included in `weekdays`.
- When the customer changes the preorder date, immediately hide products that are unavailable for the newly selected date.
- A product with the same `startDate` and `endDate` is available on one specific date only.

If the digital menu has a product mode filter already, reuse it instead of creating a second incompatible product classification.

## Preorder order payload

When a customer submits a preorder, send the existing customer, address, item, pricing, coupon, and payment fields used by the digital menu, plus these required order fields:

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

Use the actual selected slot values. Do not send `orderType: "normal"` for a preorder.

The order creation path may be the digital menu’s existing storefront order endpoint. If it forwards directly to the FishTokri order API, it must preserve the same field names and values above.

The backend must store the order with:

- `orderType: "preorder"`
- `deliveryType: "delivery"`
- The selected future `deliveryDate`
- `scheduleType: "slot"`
- The selected `timeslotId`
- The selected `timeslotLabel`
- The selected `timeslotStart`
- The selected `timeslotEnd`

Do not use:

- `deliveryType: "takeaway"`
- `scheduleType: "instant"`
- `orderType: "normal"`
- An empty or missing future delivery date
- An empty timeslot when active slots are available

## Validation

Validate on the client for a fast user experience and on the server for correctness.

Before submission, reject the preorder if:

- No delivery address is selected.
- The delivery date is missing.
- The delivery date is today or in the past.
- The date is not a valid `YYYY-MM-DD` date.
- Takeaway is selected.
- No timeslot is selected while active slots are available.
- The selected timeslot is no longer available for the selected date.
- The selected timeslot has reached its date-specific capacity.
- The cart is empty.
- Payment details are invalid according to the existing checkout rules.

The server must repeat the important checks because the date, slot, and capacity may change after the checkout page loads.

## Admin-panel handoff

The admin already has a Preorders section that filters orders by:

```text
orderType=preorder
```

After a successful digital-menu preorder:

1. The order must be saved in the shared orders database through the existing storefront order flow.
2. It must contain `orderType: "preorder"`.
3. It must retain the future delivery date and timeslot fields.
4. It must be visible in the Admin Preorders tab after refresh/polling.
5. It must remain visible in the existing Current, Next Day, History, and All Orders views wherever the existing order rules include it.
6. It must trigger the existing new-order alert behavior. Preorder alerts should use the separate blue preorder alert styling already implemented in Admin.

Do not create a second preorder collection or a frontend-only preorder list. The admin must receive the same persisted order record used by the other storefront orders.

## Checkout state behavior

When switching between Today, Next Day, and Preorder:

- Keep the customer, address, cart, coupon, and payment state unless the existing checkout intentionally resets it.
- Update only scheduling-related state.
- Clear the selected timeslot when changing to a date where it is invalid.
- Do not leave a stale preorder date when returning to Today or Next Day.
- Do not leave `orderType: "preorder"` on a normal Today or Next Day order.
- Do not leave `orderType: "normal"` on a preorder order.

If the checkout is reopened or restored from a saved cart, restore the order mode, date, and timeslot together.

## Suggested implementation sequence

1. Identify the existing checkout drawer and Today/Next Day scheduling state.
2. Add a third Preorder scheduling mode.
3. Add the future date picker with tomorrow as the minimum date.
4. Add exact-date timeslot fetching and filtering.
5. Apply preorder product eligibility.
6. Add the preorder payload fields to the existing order submission request.
7. Add client and server validation.
8. Confirm the successful response closes or resets the checkout using the existing behavior.
9. Verify the created order appears in Admin under Preorders with the correct date and timeslot.
10. Test normal, next-day, takeaway, and preorder orders separately so their payloads do not overlap.

## Acceptance criteria

- A customer can select Preorder in the digital menu checkout.
- A customer cannot select today or a past date for preorder.
- A customer can select a future date other than tomorrow.
- Timeslots are filtered by the selected date’s weekday.
- Timeslot capacity is checked for the exact selected date.
- A valid future preorder can be submitted.
- The submitted order contains `orderType: "preorder"`.
- The submitted order contains delivery and slot scheduling fields.
- Takeaway and Express are unavailable for preorder.
- Normal Today and Next Day ordering continues to work unchanged.
- The order appears in the Admin Preorders section after it is created.
- Editing the order in Admin does not change it back to a normal order.
- No duplicate frontend-only preorder storage is introduced.