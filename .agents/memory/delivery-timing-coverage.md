---
name: Delivery timing coverage
description: Rules for aggregating delivery lifecycle durations when timestamp coverage is incomplete.
---

Delivery timing reports must calculate each metric only from orders that have both timestamps for that metric. Missing assignment, pickup, or delivered timestamps reduce the metric's coverage count; they must not be replaced with order creation time, report date, or another estimate.

The report uses one minute as its smallest displayed duration. Same-timestamp or sub-minute lifecycle pairs are reported as one minute rather than zero.

**Why:** Legacy orders and orders still in progress can have only part of the lifecycle recorded. Showing coverage alongside averages keeps the report honest while still making partial timing data useful.

**How to apply:** Keep assignment-to-pickup, pickup-to-delivered, and assignment-to-delivered as separate pairwise aggregates. Exclude unassigned and takeaway rows from delivery-person timing averages, while retaining Porter Delivery as an assigned delivery person.