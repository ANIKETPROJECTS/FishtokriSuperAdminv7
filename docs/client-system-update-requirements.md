# FishTokri System Update Requirements

**Status:** Draft for client review  
**Purpose:** Capture the requested inventory, procurement, recommendation, and analytics changes before implementation.

## 1. Executive summary

The proposed update adds a central raw-inventory and processing workflow at the Super Hub. Raw materials are purchased from vendors, received and tracked centrally, then converted into saleable products and transferred to Sub Hubs. Sub Hubs accept the transfer into their inventory and can report transport damage or other discrepancies without re-entering the product details.

The update also proposes customer-facing product recommendations and admin business analytics to help improve product discovery and give the business better visibility into sales and demand.

This document describes the requested scope; it does not represent functionality that has already been built. Items in **Open decisions** require client confirmation before detailed design and implementation.

## 2. Goals

- Track raw materials from purchase through processing and transfer.
- Maintain traceability between raw-material lots and the finished products made from them.
- Reduce manual inventory entry at Sub Hubs and prevent duplicate stock postings.
- Record, review, and resolve transport damage, shortages, and returns.
- Recommend relevant products to customers using approved shopping and sales signals.
- Give administrators clear daily, product-level, and customer-level business insights.

## 3. Proposed operating model

### Current-state context

In the current workflow, Sub Hubs are responsible for entering final, saleable product inventory. The requested model moves raw-material procurement and processing to a Super Hub while preserving Sub Hub inventory for saleable products received from the Super Hub.

### Proposed end-to-end flow

1. A purchasing user maintains vendor information and creates a purchase for raw materials.
2. The Super Hub records the receipt, quantity, unit, cost, supplier lot details, and any discrepancy.
3. The processing team records which raw-material quantities were consumed and which saleable product batches were produced.
4. The Super Hub creates a transfer for a Sub Hub, listing the finished products and quantities being sent.
5. The Sub Hub reviews the delivery and accepts the received quantities. Accepted quantities are posted to its inventory from the transfer; the Sub Hub does not recreate the product or batch details manually.
6. Any shortage, damage, or other discrepancy is recorded against the transfer and routed through the agreed resolution process.
7. Inventory, transfer, processing, and adjustment events remain traceable for reporting and audit.

## 4. Functional requirements

### 4.1 Vendor and purchasing

| ID | Requirement |
|---|---|
| PUR-01 | Authorized users can create, view, edit, and deactivate vendor records. |
| PUR-02 | A purchase record identifies the vendor, purchase date, raw-material items, quantities, units, unit costs, taxes or other charges where applicable, and reference documents. |
| PUR-03 | A purchase can be received in full or in part. Each receipt records the actual received quantity and any difference from the purchase. |
| PUR-04 | Receiving stock creates traceable raw-inventory lots at the designated Super Hub; a purchase draft alone must not increase available stock. |
| PUR-05 | Users can search and report on purchases and receipts by date, vendor, raw material, status, and Super Hub. |
| PUR-06 | Purchase returns, supplier credits, and invoice or tax handling follow the policy confirmed by the client. |

### 4.2 Raw inventory at the Super Hub

| ID | Requirement |
|---|---|
| RAW-01 | The system supports raw-material items separately from saleable product SKUs. |
| RAW-02 | Each raw-stock lot records its source purchase/receipt, quantity, unit, receipt date, location, cost where available, and expiry or use-by details where applicable. |
| RAW-03 | Authorized users can view current raw stock, reserved stock, consumed stock, and adjustments by material, lot, and Super Hub. |
| RAW-04 | Stock changes are recorded as attributable inventory transactions rather than silently overwriting a balance. |
| RAW-05 | The system prevents consumption, transfer, or adjustment beyond available stock unless an explicitly authorized exception process is approved. |

### 4.3 Processing raw materials into saleable products

| ID | Requirement |
|---|---|
| PROC-01 | Authorized users can define a processing recipe or bill of materials linking raw materials to one or more saleable product SKUs. |
| PROC-02 | A processing run records its date, location, input lots and quantities, output products and quantities, operator, and notes. |
| PROC-03 | Completing a processing run deducts the recorded input quantities from raw inventory and creates finished-product batches in the Super Hub inventory. |
| PROC-04 | The system records yield differences, trim, spoilage, and other processing loss separately from saleable output. |
| PROC-05 | A processing run retains lot-level traceability from each finished batch back to the raw-material lots used. |
| PROC-06 | Processing records can be reviewed and corrected only through an auditable adjustment or reversal process. |

### 4.4 Super Hub to Sub Hub transfers

| ID | Requirement |
|---|---|
| TRANS-01 | An authorized Super Hub user can create a transfer to a selected Sub Hub with product, batch, quantity, and dispatch details. |
| TRANS-02 | The system reserves or deducts stock according to the transfer lifecycle agreed by the client; it must not make the same stock available for multiple transfers. |
| TRANS-03 | Dispatch details include the sender, recipient, dispatch time, quantities, and relevant delivery or reference information. |
| TRANS-04 | A Sub Hub user can review a dispatched transfer and record quantities accepted, rejected, damaged, or missing. |
| TRANS-05 | Only quantities accepted by the Sub Hub are posted into its inventory, with the source transfer and batch traceability preserved. |
| TRANS-06 | The system prevents duplicate acceptance or duplicate inventory posting if a user retries an action or reloads the page. |
| TRANS-07 | Transfer status and quantities are visible to both hubs according to their permissions. |

**Suggested transfer statuses for discussion:** Draft, Dispatched, Partially received, Received, Discrepancy reported, Under review, Resolved, Cancelled.

### 4.5 Damage, wastage, and returns

| ID | Requirement |
|---|---|
| WASTE-01 | A Sub Hub can report damage, shortage, or other transport-related discrepancy against the specific transfer and product/batch. |
| WASTE-02 | A report records quantity, reason, report time, reporter, notes, and optional supporting photos or documents. |
| WASTE-03 | The system keeps reported stock separate from accepted, sellable stock until the disposition is decided. |
| WASTE-04 | An authorized user can resolve a report using an approved outcome, such as return to Super Hub, replacement, supplier/carrier claim, write-off, or correction to dispatch/receipt quantities. |
| WASTE-05 | Every resolution updates the relevant inventory records and retains an audit trail; it must not silently erase the original report. |

### 4.6 Customer-facing recommendations

| ID | Requirement |
|---|---|
| REC-01 | The website can show relevant product recommendations on agreed pages, such as product detail, cart, or checkout. |
| REC-02 | Recommendation signals may include current cart contents, prior purchases, popular products, and cart-value context, subject to client approval and applicable privacy requirements. |
| REC-03 | Recommendations must respect product availability, customer eligibility, and the active Sub Hub or delivery area. |
| REC-04 | The system provides a defined fallback, such as popular in-stock products, when personalized signals are unavailable. |
| REC-05 | Recommendation impressions and selections can be measured using privacy-appropriate analytics so the client can assess usefulness. |
| REC-06 | The client approves whether recommendations are rule-based, model-based, or a staged combination; the term “AI” alone does not define the implementation. |

### 4.7 Admin business analytics

| ID | Requirement |
|---|---|
| ANA-01 | Authorized administrators can view sales for a selected date or date range, including daily totals and order counts. |
| ANA-02 | Administrators can view top-selling products for a selected day or period using a clearly defined sales measure. |
| ANA-03 | Administrators can review product demand over time, including quantities ordered by day and product. |
| ANA-04 | Administrators can view customer-level purchasing summaries, such as order frequency, purchase history, and spend, subject to role permissions. |
| ANA-05 | Analytics can be filtered by date range, product, Sub Hub, order status, and other agreed dimensions. |
| ANA-06 | Reports clearly identify whether totals include cancelled, refunded, tax, discount, and delivery amounts. |
| ANA-07 | Where approved, reports can be exported in a client-selected format and access is limited to authorized roles. |

## 5. Roles and access

The following roles are proposed; the client should confirm whether these map to existing account types:

- **Purchasing user:** manages vendors, purchase orders, and receipt records.
- **Super Hub inventory manager:** manages raw stock, finished stock, processing, and transfers.
- **Processing operator:** records processing runs and output, with access limited to assigned operations.
- **Sub Hub manager:** reviews transfers, accepts quantities, and reports discrepancies.
- **Administrator:** manages configuration, permissions, and approved adjustments.
- **Business analyst:** views permitted reports and exports without inventory-editing access.

All material stock changes, processing completions, transfer acceptance, discrepancy resolutions, and report exports should be attributable to a user and timestamp.

## 6. Inventory and audit safeguards

- A transfer must not create stock at both hubs before receipt is confirmed.
- Retrying a purchase receipt, processing completion, transfer dispatch, or transfer acceptance must not post the same inventory movement twice.
- Raw input, processing loss, finished output, dispatched quantity, received quantity, and discrepancy quantity should reconcile.
- Corrections should create linked reversals or adjustments rather than remove transaction history.
- Lot and batch references should be retained through processing and inter-hub movement.
- The system should distinguish physical quantity, reserved quantity, sellable quantity, and damaged/quarantined quantity.
- Reports should use consistent definitions and identify the source and time range of the data.

## 7. Acceptance criteria

The proposed release is acceptable when:

1. A user can create a vendor purchase, record a partial or full receipt, and see the received quantity in the correct Super Hub raw inventory.
2. A processing run consumes the selected raw lots, creates finished-product batches, records yield or loss, and preserves traceability.
3. A Super Hub can dispatch finished products to a Sub Hub, and the Sub Hub can accept the delivery so accepted quantities appear once in its inventory.
4. A Sub Hub can report a discrepancy against a transfer and an authorized user can resolve it with a traceable inventory outcome.
5. Duplicate submissions and retries do not duplicate stock.
6. Approved recommendation placements show eligible, available products and provide the agreed fallback when personalization is unavailable.
7. Admins can retrieve daily sales, top products, demand by product and day, and permitted customer-level summaries using agreed calculation rules.
8. Users can access only the actions and customer data permitted for their role.

## 8. Open decisions for client approval

1. **Units and conversions:** What units are used for each raw material and finished product? Are fractional quantities allowed?
2. **Processing recipes and yields:** Who defines recipes, expected yields, and acceptable variance? Can a run produce multiple SKUs?
3. **Stock timing:** At what point is stock reserved or deducted—when a transfer is created, approved, or dispatched?
4. **Transfer direction:** Does the Super Hub push stock to Sub Hubs, do Sub Hubs request stock, or should both workflows be supported?
5. **Discrepancy outcomes:** Who approves damage, wastage, replacement, return, and write-off? Who bears the cost?
6. **Procurement rules:** Are purchase orders, goods-received notes, supplier returns, invoice matching, taxes, and landed costs required?
7. **Costing:** How should raw-material cost flow into finished-product batches and inventory valuation?
8. **Expiry and traceability:** Which materials require expiry dates, and what shelf-life or traceability rules apply?
9. **Recommendation behavior:** Which website placements, signals, personalization rules, and success measures are required? What customer-data/privacy policy applies?
10. **Analytics definitions:** Should sales mean gross or net sales? How are discounts, delivery charges, taxes, refunds, cancellations, and partial returns counted?
11. **Customer analytics access:** Which roles can see customer-level spend and purchase history? Are exports required?
12. **Reporting and alerts:** Which scheduled reports, low-stock alerts, expiry alerts, or discrepancy notifications are needed?

## 9. Suggested delivery phases

1. **Inventory foundation:** vendor records, purchasing, receiving, raw stock, and audit history.
2. **Processing:** recipes, processing runs, finished batches, yield/loss, and raw-to-finished traceability.
3. **Transfers and exceptions:** dispatch, Sub Hub acceptance, automatic inventory posting, damage/shortage reporting, and resolution.
4. **Business analytics:** agreed definitions, dashboards, filters, access controls, and exports.
5. **Recommendations:** agreed recommendation signals and placements, availability filtering, fallback behavior, and measurement.

These phases are a suggested sequence, not a committed delivery schedule. Detailed estimates should follow confirmation of the open decisions and a review of the existing inventory and order workflows.
