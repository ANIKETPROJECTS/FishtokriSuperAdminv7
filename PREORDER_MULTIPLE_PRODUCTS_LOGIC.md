# Multiple Preorder Products: Common Dates and Timeslots

This document describes how the digital menu must filter preorder dates and
timeslots when the customer selects more than one preorder product.

## Core rule: use an intersection

The customer may select only dates and timeslots supported by **every**
preorder product in the cart. The result must be an intersection, not a union.

If Product A is available on a date but Product B is not, that date cannot be
selected for the cart.

If both products are available on a date but allow different timeslots, only
the timeslots allowed by both products can be selected.

## Common-date filtering

For every candidate future date:

1. Check the date against every selected product's `preorderAvailability`.
2. Remove the date if any product is outside its configured date range.
3. Remove the date if any product uses weekday restrictions and the date's
   weekday is not included in that product's `weekdays` array.
4. Keep the date only when all selected preorder products are available.

The date rules are:

- `all`: the product is available for every future date.
- `weekdays`: the date's weekday must be in `weekdays`.
- `date_range`: the date must be between `startDate` and `endDate`,
  inclusive.
- `date_range_and_weekdays`: both the date range and weekday must match.

The digital menu's existing weekday/date filtering is already working
correctly. This document focuses on ensuring the same intersection behavior is
preserved when multiple products are selected.

## Common-timeslot filtering

After a common date is selected:

1. Determine the selected date's weekday number (`0` = Sunday through `6` =
   Saturday).
2. Start with the active sub-hub timeslots.
3. For each selected product, read its
   `timeslotIdsByWeekday[String(weekday)]` rule.
4. Remove any timeslot that is not allowed by one or more products.
5. Show only the remaining common timeslots.
6. Block checkout if no common timeslot remains.

Timeslot rule semantics:

- A missing `timeslotIdsByWeekday` object means all active slots are allowed.
- A missing weekday key means all active slots are allowed for that weekday.
- An explicit empty array means no slots are allowed for that weekday.
- A populated array allows only the listed timeslot IDs.

## Example

Assume the customer selects Product A and Product B:

- Product A is available Monday through Friday.
- Product A allows Monday slots A and B.
- Product B is available only Monday and Wednesday.
- Product B allows Monday slots B and C.

The common date must be a Monday that satisfies both products' availability
rules. On that Monday:

- Product A allows: A, B
- Product B allows: B, C
- Cart-level allowed slots: B

Slot A cannot be selected because Product B does not allow it. Slot C cannot
be selected because Product A does not allow it.

## Empty intersection behavior

### No common date

If the selected products have no common eligible future date:

- The date picker must not offer a valid date.
- The customer must not be able to complete the preorder.
- The customer should change the cart or remove the conflicting product.

### No common timeslot

If the products share a valid date but have no common timeslot for that date:

- The timeslot picker must show no selectable slot.
- Checkout must be blocked.
- The customer should change the date or change the cart.

## Digital-menu implementation gap

The digital menu already filters dates and weekdays correctly. Its remaining
issue is per-product timeslot filtering: the menu is not currently applying
each product's `timeslotIdsByWeekday` restrictions correctly.

The implementation must apply the per-product rules first and then intersect
the results across all selected preorder products. It must not use only the
first product's rules and must not combine product slot lists as a union.

## Order validation

The selected date and timeslot should be revalidated before submitting the
order. The order must not be created if either value is no longer valid for
all selected preorder products.

When valid, the order stores the customer's selected schedule:

```json
{
  "orderType": "preorder",
  "deliveryType": "delivery",
  "scheduleType": "slot",
  "deliveryDate": "2026-09-10",
  "timeslotId": "common-slot-id",
  "timeslotLabel": "12:00 PM – 01:00 PM",
  "timeslotStart": "12:00 PM",
  "timeslotEnd": "01:00 PM"
}
```