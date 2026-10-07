# Prompt: Hide soft-deleted orders from customer My Orders

Update the customer-facing frontend so an order is not shown in the customer’s My Orders section whenever its order document has `isDeleted: true`.

Before making changes, inspect the My Orders screen, its API/data source, and existing tests so the fix follows the project’s current patterns.

## Requirements
- Exclude orders with `isDeleted === true` from the authenticated customer’s My Orders results. Apply the exclusion in the customer-facing API/database query before sorting, pagination, and total-count calculation; also add a defensive frontend filter if the API response can contain deleted orders.
- Treat `isDeleted: false` or a missing `isDeleted` field as not deleted, so existing active and historical orders continue to appear under the current rules.
- Ensure deleted orders do not remain visible from stale cached My Orders data after the list is refreshed or invalidated.
- Preserve customer/account scoping. Do not expose or return another customer’s orders.
- Do not change order status or payment status to hide an order. Do not hard-delete the order or alter its data.
- Keep the admin Orders page, its Deleted section, and its restore/permanent-delete behavior unchanged.
- Keep the change limited to the customer-facing My Orders flow and any API/query code required to make that flow correct.

## Verification
- A customer order with `isDeleted: true` is absent from My Orders and is excluded from its pagination and count.
- Orders with `isDeleted: false` or no `isDeleted` field remain visible when they otherwise match the existing My Orders rules.
- Restoring an order by setting `isDeleted: false` makes it eligible to appear again after the normal refresh, subject to existing customer visibility rules.
- Confirm the admin Deleted section still lists and restores soft-deleted orders.
- Run the relevant tests or checks and report the files changed and verification results.