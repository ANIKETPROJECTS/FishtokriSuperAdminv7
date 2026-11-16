# New System Updates

This document describes the new features planned for the FishTokri system. The updates cover raw inventory and processing at the Super Hub, stock transfers to Sub Hubs, product recommendations on the website, and business reports in the admin panel.

## 1. Raw inventory at the Super Hub

A new Raw Inventory section will be added for the Super Hub. It will be used to manage materials that have not yet been converted into saleable products, such as whole chicken or other raw ingredients.

The Raw Inventory section will show:

- Raw material name and available quantity.
- Unit of measurement, such as kilograms, pieces, or boxes.
- The vendor and purchase record the stock came from.
- The date the stock was received.
- Batch or lot details, including expiry or use-by date when applicable.
- Stock received, used for processing, transferred, adjusted, or written off.

Raw inventory will be managed separately from finished products that are ready to sell. This will make it possible to see how much raw material is available and where it has been used.

## 2. Vendor and purchase management

A Vendor section will store supplier information, including vendor name, contact details, address, and other relevant notes.

Users will be able to create purchases for raw materials and track each purchase through receiving. Purchase records will include:

- Vendor and purchase date.
- Raw materials, quantities, units, and prices.
- Any additional charges or taxes recorded for the purchase.
- Received quantities and any difference from the purchased quantities.
- Purchase and receipt status.
- Notes and supporting documents, where needed.

When a purchase is received, the received quantity will be added to the Super Hub’s raw inventory and linked to that purchase. A purchase that has not been received will not add stock to inventory.

Purchase reports will help users review purchases and receipts by date, vendor, material, and status.

## 3. Processing raw materials into saleable products

The Super Hub will have a processing workflow for converting raw materials into finished products. For example, whole chicken can be processed into Chicken Curry Cut, Chicken Cubes, and other saleable products.

A processing record will include:

- Raw materials and batches used.
- Quantity of each material used.
- Finished products produced and their quantities.
- Processing date, location, and the user who recorded it.
- Processing loss, such as trim, spoilage, or other wastage.
- Notes about the processing run.

When processing is completed, the recorded raw-material quantity will be deducted from raw inventory, and the finished products will be added to the Super Hub’s finished-product inventory. Each finished batch will remain linked to the raw-material batch or batches used to produce it.

## 4. Stock transfers from the Super Hub to Sub Hubs

The Super Hub will be able to send finished products to a Sub Hub, such as Thane. A transfer will list the products and quantities being sent, along with the relevant batch and dispatch details.

The Sub Hub will see the incoming transfer and record what it received. Accepted products will be added directly to the Sub Hub’s inventory from the transfer. The Sub Hub will not need to manually re-enter the product, batch, or other inventory details.

The transfer record will show what was sent, what was received, and any quantity difference. This will help both hubs track stock while it is being moved.

## 5. Transport damage, wastage, and returns

If products are damaged, missing, or otherwise unusable during transport, the Sub Hub will be able to report the issue against the relevant transfer.

The report can include:

- Product, batch, and affected quantity.
- Reason for the issue.
- Notes and photos or other supporting information.
- The person who reported it and when it was reported.

Reported stock will be kept separate from sellable stock until it is resolved. The issue can then be recorded as a return to the Super Hub, replacement, shortage correction, or write-off, depending on what happened. The inventory records will be updated to match the resolution, and the original report will remain available for tracking.

## 6. Product recommendations on the website

The customer website will show product recommendations based on shopping activity. Recommendations may use:

- Products currently in the customer’s cart.
- Products purchased previously.
- Products frequently purchased by other customers.
- Products that may complement the current cart.
- The value and mix of items in the cart.

Recommendations will only show products available for the customer’s delivery area. If there is not enough information to personalize recommendations, the website can show popular available products instead.

## 7. Business analytics in the admin panel

The admin panel will include reports to help the business understand sales and product demand.

### Daily sales

Administrators will be able to view sales and order counts by day or date range. Reports can be filtered by Sub Hub and order status to compare business activity across locations and time periods.

### Product sales and demand

Reports will show which products sold the most and how many units were ordered. Product demand can be viewed by day and over a selected period to help identify changing demand and plan purchasing and processing.

### Customer activity

Authorized administrators will be able to review customer purchase history and summaries such as order frequency and spending. Access to customer information will be limited to users who need it for their work.

Reports may also support filtering and export so administrators can review the information outside the dashboard.

## 8. Inventory tracking across the workflow

The system will keep a record of stock movements through the full process:

1. Raw materials are purchased from a vendor.
2. Received materials are added to Super Hub raw inventory.
3. Raw materials are used in a processing run.
4. Processing output is added as finished-product inventory at the Super Hub.
5. Finished products are transferred to a Sub Hub.
6. Accepted quantities are added to the Sub Hub’s inventory.
7. Any damage, shortage, return, or wastage is recorded and reflected in inventory.

This tracking will help prevent stock from being counted twice and make it possible to trace a finished product batch back to its raw materials.
