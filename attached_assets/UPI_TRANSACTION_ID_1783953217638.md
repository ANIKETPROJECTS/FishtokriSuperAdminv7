# UPI Transaction ID in Order Documents

## What it is

When a customer pays via UPI (Razorpay), the Razorpay payment ID (e.g. `pay_XXXXXXXXXXXXXXX`) is saved as the `upiTransactionId` field **directly on the order document** in MongoDB.

- For cash-on-delivery orders: `upiTransactionId` is `null`
- For wallet-only orders (no UPI component): `upiTransactionId` is `null`
- For any order where UPI is one of the payment modes: `upiTransactionId` is the Razorpay payment ID string

---

## Where to find it in MongoDB

**Database:** `orders`  
**Collection:** `orders`  
**Field:** `upiTransactionId` (top-level field, type `String | null`)

---

## Example MongoDB document (UPI-paid order)

```json
{
  "_id": { "$oid": "6872a1f3c4e2b30012a4d8e1" },
  "customerId": "6841c3b2f1d4a20011b3c5f0",
  "customerName": "Rahul Mehta",
  "phone": "9820012345",
  "email": null,
  "items": [
    {
      "productId": "6841c3b2f1d4a20011b3c6a1",
      "name": "Surmai (King Fish) Steaks",
      "price": 480,
      "quantity": 2,
      "unit": "500g",
      "imageUrl": "https://cdn.fishtokri.com/surmai.jpg"
    }
  ],
  "subtotal": 960,
  "discount": 0,
  "slotCharge": 49,
  "total": 1009,
  "deliveryType": "delivery",
  "address": "A-304 Sai Leela CHS, Pokhran Road No.2, Thane West",
  "deliveryArea": "Thane West",
  "deliveryAddressDetail": {
    "name": "Rahul Mehta",
    "phone": "9820012345",
    "building": "A-304 Sai Leela CHS",
    "street": "Pokhran Road No.2",
    "area": "Thane West",
    "pincode": "400610",
    "type": "house",
    "label": "Home",
    "instructions": "Ring the bell twice",
    "_id": "6841c3b2f1d4a20011b3c5f9"
  },
  "pickupLocation": "",
  "notes": "Ring the bell twice",
  "status": "pending",
  "source": "online",
  "subHubId": "6841c3b2f1d4a20011b3c600",
  "subHubName": "Thane",
  "superHubId": "6841c3b2f1d4a20011b3c601",
  "superHubName": "Mumbai",
  "couponIds": [],
  "couponCodes": [],
  "coupons": [],
  "paymentStatus": "paid",
  "payments": [
    {
      "mode": "upi",
      "amount": 1009,
      "reference": "pay_QsT7pXk3Rm9WvL",
      "paidAt": "2026-07-13T09:15:33.000Z"
    }
  ],
  "paidAmount": 1009,
  "dueAmount": 0,
  "paymentMode": "upi",
  "scheduleType": "slot",
  "deliveryDate": "2026-07-13",
  "timeslotId": "6841c3b2f1d4a20011b3c612",
  "timeslotLabel": "7:00 AM – 9:00 AM",
  "timeslotStart": "07:00",
  "timeslotEnd": "09:00",
  "inventoryDeducted": true,
  "upiTransactionId": "pay_QsT7pXk3Rm9WvL",
  "createdAt": { "$date": "2026-07-13T09:15:33.000Z" },
  "updatedAt": { "$date": "2026-07-13T09:15:33.000Z" },
  "orderId": "#FTW202607131"
}
```

---

## Key points for your admin panel

| Scenario | `upiTransactionId` | `paymentMode` | `paymentStatus` |
|---|---|---|---|
| Full UPI payment | `"pay_XXXXXXXXXXXXXX"` | `"upi"` | `"paid"` |
| Wallet + UPI split | `"pay_XXXXXXXXXXXXXX"` | `"upi"` | `"paid"` |
| Cash on delivery | `null` | `"cash"` | `"unpaid"` |
| Wallet only (no UPI) | `null` | `"wallet"` | `"paid"` |

### Querying in your admin panel

To find all UPI-paid orders:
```js
db.orders.find({ upiTransactionId: { $ne: null } })
```

To look up an order by its Razorpay payment ID:
```js
db.orders.findOne({ upiTransactionId: "pay_QsT7pXk3Rm9WvL" })
```

---

## How it's set

The value is extracted **server-side** at order-creation time from the `payments` array — no client change was needed. The rule is:

```
upiTransactionId = payments.find(p => p.mode === "upi" && p.reference)?.reference ?? null
```

The same ID also lives inside `payments[].reference` for the UPI entry, so your admin panel can use either location. The top-level `upiTransactionId` field is the fast-lookup path.
