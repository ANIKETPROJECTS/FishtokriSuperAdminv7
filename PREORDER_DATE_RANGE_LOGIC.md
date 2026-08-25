# Preorder Date-Range and Timeslot Logic

This document describes how preorder availability is configured in the FishTokri
Admin product editor, how each scenario is stored in MongoDB, and how the
customer-facing digital menu should interpret the same data.

## Product mode

Only products with:

```json
{
  "preorderMode": "preorder_only"
}
```

are shown in the preorder flow. Products with `preorderMode: "normal"` (or
without a mode, which is treated as normal) are shown in the normal ordering
flow instead.

## Weekday numbers

Weekdays are stored as numbers:

| Number | Day |
| ---: | --- |
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

Dates are stored as ISO calendar dates in `YYYY-MM-DD` format. Date ranges are
inclusive: both `startDate` and `endDate` are orderable dates.

The admin UI prevents selecting today or an earlier date. The API also validates
that a configured range has valid dates and that `startDate <= endDate`.

## MongoDB storage

The configuration is saved inside the product document as
`preorderAvailability`. It is not expanded into one MongoDB record per date.
The API normalizes the object before saving it.

The common shape is:

```json
{
  "preorderAvailability": {
    "type": "all | weekdays | date_range | date_range_and_weekdays",
    "weekdays": [0, 1, 2, 3, 4, 5, 6],
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "timeslotIdsByWeekday": {
      "0": ["timeslot-id-1", "timeslot-id-2"],
      "1": ["timeslot-id-1"]
    }
  }
}
```

`timeslotIdsByWeekday` is optional. A missing weekday key means that all active
sub-hub timeslots are allowed for that weekday. An explicitly saved empty array
means that no timeslots are allowed for that weekday.

## Availability scenarios

### 1. All dates

The product can be ordered for every future date.

```json
{
  "preorderAvailability": {
    "type": "all",
    "weekdays": [0, 1, 2, 3, 4, 5, 6],
    "startDate": "",
    "endDate": ""
  }
}
```

The weekday list is normalized to all seven days. The date fields are cleared
because this scenario has no date-range restriction.

If timeslots are configured, the customer can select only the slots allowed for
the selected weekday. If no timeslot rules are saved, all active timeslots are
allowed.

### 2. Selected weekdays

The product can be ordered on the selected weekdays, with no start or end date.

Example: Monday, Wednesday, and Friday:

```json
{
  "preorderAvailability": {
    "type": "weekdays",
    "weekdays": [1, 3, 5],
    "startDate": "",
    "endDate": ""
  }
}
```

The API requires at least one weekday for this scenario. A date is eligible
when its weekday number is included in `weekdays`.

### 3. Date range only

The product can be ordered on every weekday within one inclusive date range.
This is the third option in the admin UI.

Example: 2026-09-01 through 2026-09-15:

```json
{
  "preorderAvailability": {
    "type": "date_range",
    "weekdays": [0, 1, 2, 3, 4, 5, 6],
    "startDate": "2026-09-01",
    "endDate": "2026-09-15"
  }
}
```

There is no user-selected weekday restriction in this scenario. The
normalized `weekdays` array still contains all seven days for compatibility;
it must not be interpreted as an additional restriction when `type` is
`date_range`.

Using the same start and end date represents one specific future date:

```json
{
  "type": "date_range",
  "weekdays": [0, 1, 2, 3, 4, 5, 6],
  "startDate": "2026-09-10",
  "endDate": "2026-09-10"
}
```

### 4. Date range + selected weekdays

The product can be ordered only when both conditions are true:

1. The selected date is between `startDate` and `endDate`, inclusive.
2. The selected date's weekday number is included in `weekdays`.

Example: Mondays and Fridays from 2026-09-01 through 2026-09-30:

```json
{
  "preorderAvailability": {
    "type": "date_range_and_weekdays",
    "weekdays": [1, 5],
    "startDate": "2026-09-01",
    "endDate": "2026-09-30"
  }
}
```

The API requires at least one weekday and a valid date range for this scenario.

## Per-day timeslot rules

Timeslot restrictions are stored independently for each weekday under
`timeslotIdsByWeekday`. The values are the IDs of the configured sub-hub
timeslots, not timeslot labels.

Example:

```json
{
  "type": "date_range",
  "weekdays": [0, 1, 2, 3, 4, 5, 6],
  "startDate": "2026-09-01",
  "endDate": "2026-09-15",
  "timeslotIdsByWeekday": {
    "1": ["665aaa111111111111111111"],
    "3": [],
    "5": ["665aaa111111111111111111", "665bbb222222222222222222"]
  }
}
```

In this example:

- Monday allows only the first slot.
- Wednesday allows no slots.
- Friday allows the first and second slots.
- Any weekday not present in the object allows all active slots.

The selected date determines the weekday key. For example, a Monday date uses
key `"1"`. The date restriction and weekday restriction must be evaluated before
the timeslot rule.

## Digital-menu filtering

The digital menu's preorder behavior must use the same product availability
interpretation as the admin preorder POS:

1. Show only `preorder_only` products.
2. For each product, filter the selected date using `preorderAvailability.type`.
3. For the selected date, determine its weekday number.
4. Filter the available timeslots using that product's
   `timeslotIdsByWeekday` entry.
5. If multiple preorder products are in the cart, offer only timeslots allowed
   by every selected product.
6. Reject checkout if the selected date or selected timeslot is no longer valid.

The date/weekday filtering in the digital menu is already working correctly.
The remaining issue is specifically the per-product timeslot filtering in the
digital menu: product-level `timeslotIdsByWeekday` restrictions are currently
not being applied correctly there. The digital menu should be updated to apply
the per-day product timeslot rules described above; this document records the
gap and does not claim that issue is fixed.

## Multiple preorder products: common dates and timeslots

When the customer selects multiple preorder products, the digital menu must
show only dates that are valid for **every** selected product. This is an
intersection, not a union.

For each candidate date:

1. Check the date against every product's `preorderAvailability`.
2. Remove the date if any product is outside its date range.
3. Remove the date if any product uses weekday restrictions and the date's
   weekday is not selected.
4. Keep the date only when all selected preorder products are available.

After the customer selects one of those common dates, the timeslot list must
also be the intersection of every selected product's allowed slots for that
date's weekday:

1. Start with the active sub-hub timeslots.
2. Apply each product's `timeslotIdsByWeekday` rule for the selected weekday.
3. Keep only timeslots allowed by every selected product.
4. Prevent checkout when no common timeslot remains.

Example:

- Product A is available Monday through Friday and allows Monday slots A and B.
- Product B is available only Monday and Wednesday and allows Monday slots B
  and C.
- The only common date is a Monday within both products' date rules.
- The only common Monday timeslot is slot B.

If the products have no common eligible date, the customer must not be able to
complete the preorder until the cart is changed. If they have a common date but
no common timeslot for that date, the timeslot picker must show no selectable
slot and checkout must be blocked.

## Order storage

The product availability configuration controls eligibility, but the submitted
order stores the customer's selected schedule as a snapshot. A preorder order
must contain:

```json
{
  "orderType": "preorder",
  "deliveryType": "delivery",
  "scheduleType": "slot",
  "deliveryDate": "2026-09-10",
  "timeslotId": "selected-slot-id",
  "timeslotLabel": "12:00 PM – 01:00 PM",
  "timeslotStart": "12:00 PM",
  "timeslotEnd": "01:00 PM"
}
```

The order does not store the product's full availability configuration as its
schedule. It stores the future date and the exact slot selected by the
customer. The backend validates that preorder dates are valid future dates and
that preorders use delivery rather than takeaway.

## Compatibility rules

- Missing `preorderAvailability` means `type: "all"`.
- Missing `timeslotIdsByWeekday` means all active timeslots are allowed.
- Missing one weekday key means all active timeslots are allowed for that day.
- An explicit empty weekday array means no timeslots are allowed for that day.
- `date_range` uses the date range only; its normalized all-days list is not an
  extra weekday filter.
- `date_range_and_weekdays` requires both the date range and weekday match.