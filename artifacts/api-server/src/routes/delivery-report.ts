import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { loadScope, type ScopedRequest } from "../middlewares/scope.js";
import { getSubHubDbConnection } from "../db/sub-hub-connections.js";

const router = Router();
router.use(requireAuth as any);
router.use(loadScope as any);

async function getOrdersDb() {
  return getSubHubDbConnection("orders");
}

function buildDateFilter(from: string, to: string): Record<string, any> {
  if (!from && !to) return {};
  const dateFilter: any = {};
  if (from) dateFilter.$gte = from;
  if (to) dateFilter.$lte = to;
  return { deliveryDate: dateFilter };
}

const ORDER_PROJECTION = {
  _id: 1, orderId: 1, orderNumber: 1, customerName: 1, phone: 1, total: 1,
  paidAmount: 1, dueAmount: 1, payments: 1, paymentMode: 1, paymentStatus: 1, status: 1,
  deliveryType: 1, assignedDeliveryPersonId: 1, assignedDeliveryPersonName: 1,
  deliveryAssignedAt: 1, deliveryPickedUpAt: 1, deliveryDeliveredAt: 1,
  createdAt: 1, deliveryDate: 1, subHubName: 1, deliveryArea: 1, items: 1, isExpress: 1,
  walletUsed: 1,
};

interface ModeData { count: number; amount: number; }

interface TimeBucket {
  count: number;
  totalMinutes: number;
  minMinutes: number | null;
  maxMinutes: number | null;
}

interface DeliveryTimeStats {
  assignedCount: number;
  pickedUpCount: number;
  deliveredCount: number;
  assignmentToPickup: TimeBucket;
  pickupToDelivered: TimeBucket;
  assignmentToDelivered: TimeBucket;
}

function emptyTimeBucket(): TimeBucket {
  return { count: 0, totalMinutes: 0, minMinutes: null, maxMinutes: null };
}

function emptyDeliveryTimeStats(): DeliveryTimeStats {
  return {
    assignedCount: 0,
    pickedUpCount: 0,
    deliveredCount: 0,
    assignmentToPickup: emptyTimeBucket(),
    pickupToDelivered: emptyTimeBucket(),
    assignmentToDelivered: emptyTimeBucket(),
  };
}

function parseTimestamp(value: any): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function addTimeBucket(bucket: TimeBucket, milliseconds: number) {
  if (milliseconds < 0) return;
  const minutes = milliseconds / 60000;
  bucket.count++;
  bucket.totalMinutes += minutes;
  bucket.minMinutes = bucket.minMinutes === null ? minutes : Math.min(bucket.minMinutes, minutes);
  bucket.maxMinutes = bucket.maxMinutes === null ? minutes : Math.max(bucket.maxMinutes, minutes);
}

function recordDeliveryTimes(stats: DeliveryTimeStats, order: any) {
  const assignedAt = parseTimestamp(order.deliveryAssignedAt);
  const pickedUpAt = parseTimestamp(order.deliveryPickedUpAt);
  const deliveredAt = parseTimestamp(order.deliveryDeliveredAt);

  if (assignedAt !== null) stats.assignedCount++;
  if (pickedUpAt !== null) stats.pickedUpCount++;
  if (deliveredAt !== null) stats.deliveredCount++;
  if (assignedAt !== null && pickedUpAt !== null) {
    addTimeBucket(stats.assignmentToPickup, pickedUpAt - assignedAt);
  }
  if (pickedUpAt !== null && deliveredAt !== null) {
    addTimeBucket(stats.pickupToDelivered, deliveredAt - pickedUpAt);
  }
  if (assignedAt !== null && deliveredAt !== null) {
    addTimeBucket(stats.assignmentToDelivered, deliveredAt - assignedAt);
  }
}

function publicTimeBucket(bucket: TimeBucket) {
  return {
    count: bucket.count,
    averageMinutes: bucket.count > 0 ? Math.round((bucket.totalMinutes / bucket.count) * 10) / 10 : null,
    minMinutes: bucket.minMinutes === null ? null : Math.round(bucket.minMinutes * 10) / 10,
    maxMinutes: bucket.maxMinutes === null ? null : Math.round(bucket.maxMinutes * 10) / 10,
  };
}

function publicDeliveryTimeStats(stats: DeliveryTimeStats) {
  return {
    assignedCount: stats.assignedCount,
    pickedUpCount: stats.pickedUpCount,
    deliveredCount: stats.deliveredCount,
    trackedOrderCount: stats.assignmentToDelivered.count,
    assignmentToPickup: publicTimeBucket(stats.assignmentToPickup),
    pickupToDelivered: publicTimeBucket(stats.pickupToDelivered),
    assignmentToDelivered: publicTimeBucket(stats.assignmentToDelivered),
  };
}

function calculateDeliveryTimeStats(orders: any[]) {
  const stats = emptyDeliveryTimeStats();
  for (const order of orders) {
    const personId = String(order.assignedDeliveryPersonId || "");
    const isTakeaway = order.deliveryType === "takeaway" || order.status === "takeaway";
    if (!personId || personId === "unassigned" || isTakeaway) continue;
    recordDeliveryTimes(stats, order);
  }
  return publicDeliveryTimeStats(stats);
}

function processOrders(orders: any[]) {
  const personMap = new Map<string, any>();

  for (const order of orders) {
    // Group under "Porter Delivery" only when explicitly assigned to porter_delivery.
    // Express orders that have been re-assigned to a real in-house delivery person
    // should appear under that person instead.
    const isPorter = String(order.assignedDeliveryPersonId || "") === "porter_delivery";
    const isTakeaway = order.deliveryType === "takeaway" || order.status === "takeaway";
    const personId = isPorter
      ? "porter_delivery"
      : isTakeaway
        ? "unassigned"
        : String(order.assignedDeliveryPersonId || "unassigned");
    const personName = isPorter
      ? "Porter Delivery"
      : order.assignedDeliveryPersonName ||
        (isTakeaway ? "Takeaway (Counter)" : "Unassigned");

    if (!personMap.has(personId)) {
      personMap.set(personId, {
        personId,
        personName,
        orderCount: 0,
        totalRevenue: 0,
        totalSales: 0,
        dueAmount: 0,
        walletExtra: 0,
        byMode: {} as Record<string, ModeData>,
        deliveryTimeStats: emptyDeliveryTimeStats(),
        orders: [] as any[],
      });
    }

    const person = personMap.get(personId)!;
    person.orderCount++;
    person.dueAmount += Number(order.dueAmount) || 0;

    const orderTotal = Number(order.total) || 0;

    // Wallet amount used by customer: prefer payments[] wallet entries,
    // fall back to order.walletUsed (the field set at order creation).
    // Mirrors the Day-end report cash calculation so numbers stay consistent.
    const rawPayments: any[] = Array.isArray(order.payments) ? order.payments : [];
    const walletFromPays = rawPayments
      .filter(p => (p.mode || "").toLowerCase() === "wallet")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const walletUsed = walletFromPays > 0 ? walletFromPays : (Number(order.walletUsed) || 0);

    // Older takeaway orders may store the collection only in the top-level
    // paymentMode/paidAmount fields, with no payments[] entries. Normalize
    // that legacy shape so cash collections are reported just like UPI.
    const payments: any[] = rawPayments.length > 0
      ? rawPayments
      : (() => {
          const mode = String(order.paymentMode || "").toLowerCase();
          const paid = Number(order.paidAmount);
          const isUnpaid = String(order.paymentStatus || "").toLowerCase() === "unpaid";
          if (isUnpaid || !["cash", "cod", "upi", "card"].includes(mode)) return [];
          const amount = Number.isFinite(paid) ? paid : Math.max(0, orderTotal - walletUsed);
          return amount > 0 ? [{ mode: mode === "cod" ? "cash" : mode, amount }] : [];
        })();

    const nonWalletPays = payments.filter(p => (p.mode || "").toLowerCase() !== "wallet");
    const nonWalletPaid = nonWalletPays.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    // Accumulate each payment mode at its actual received amount.
    // Do NOT scale down by wallet usage — the delivery person physically collected
    // the full nonWalletPaid amount; any excess over balanceDue is tracked separately
    // in walletExtra and credited back to the customer's wallet.
    if (nonWalletPays.length > 0) {
      for (const p of nonWalletPays) {
        const mode = (p.mode || "other").toLowerCase();
        const amount = Number(p.amount) || 0;
        if (!person.byMode[mode]) person.byMode[mode] = { count: 0, amount: 0 };
        (person.byMode[mode] as ModeData).count++;
        (person.byMode[mode] as ModeData).amount += amount;
      }
      // totalRevenue = actual money physically received (cash/UPI/card)
      person.totalRevenue += nonWalletPaid;
    }

    // Extra physically collected beyond balance due (grand total minus wallet already
    // applied) → credited to customer wallet. Must subtract walletUsed so we compare
    // against what the customer actually owed in cash/UPI/card, not the gross total.
    const balanceDue = Math.max(0, orderTotal - walletUsed);
    person.walletExtra += Math.max(0, nonWalletPaid - balanceDue);

    // Gross order value (for "Today's Sales" card, mirrors Day-end report)
    person.totalSales += orderTotal;
    if (personId !== "unassigned") {
      recordDeliveryTimes(person.deliveryTimeStats, order);
    }

    person.orders.push({
      id: String(order._id),
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      phone: order.phone,
      total: order.total,
      paidAmount: order.paidAmount,
      dueAmount: order.dueAmount,
      paymentStatus: order.paymentStatus,
      payments: payments.map((p: any) => ({ mode: p.mode, amount: p.amount, reference: p.reference })),
      status: order.status,
      deliveryType: order.deliveryType,
      deliveryAssignedAt: order.deliveryAssignedAt,
      deliveryPickedUpAt: order.deliveryPickedUpAt,
      deliveryDeliveredAt: order.deliveryDeliveredAt,
      createdAt: order.createdAt,
      subHubName: order.subHubName,
      deliveryArea: order.deliveryArea,
      itemCount: Array.isArray(order.items) ? order.items.reduce((s: number, i: any) => s + (Number(i.quantity) || 1), 0) : 0,
      // walletUsed must always be sent so the frontend can compute
      // dueViaCashUpi = orderTotal - walletUsed correctly, even for orders
      // where walletUsed is stored in the top-level field rather than as a
      // payments[] entry with mode="wallet".
      walletUsed,
    });
  }

  for (const person of personMap.values()) {
    person.deliveryTime = publicDeliveryTimeStats(person.deliveryTimeStats);
    delete person.deliveryTimeStats;
  }

  return personMap;
}

function buildScopeFilter(req: ScopedRequest, personId?: string): Record<string, any> | null {
  const scope = req.scope;
  const filter: any = {};

  if (!scope || scope.isMaster) {
    if (personId && personId !== "unassigned") filter.assignedDeliveryPersonId = personId;
    return filter;
  }

  if (scope.role === "delivery_person") {
    const uid = req.admin?.adminId;
    if (!uid) return null;
    filter.assignedDeliveryPersonId = String(uid);
    return filter;
  }

  if (!scope.subHubIds || scope.subHubIds.length === 0) return null;
  filter.subHubId = { $in: scope.subHubIds };
  if (personId && personId !== "unassigned") filter.assignedDeliveryPersonId = personId;
  return filter;
}

// ─── GET /api/delivery-report ─────────────────────────────────────────────────
// ?from=YYYY-MM-DD  &to=YYYY-MM-DD  &personId=<id>
router.get("/", async (req: ScopedRequest, res) => {
  try {
    const conn = await getOrdersDb();
    const col = conn.db.collection("orders");
    const { from = "", to = "", personId = "" } = req.query as Record<string, string>;

    const scopeFilter = buildScopeFilter(req, personId || undefined);
    if (!scopeFilter) {
      res.json({
        summary: {
          totalOrders: 0, totalRevenue: 0, dueAmount: 0, byMode: {},
          deliveryTime: publicDeliveryTimeStats(emptyDeliveryTimeStats()),
        },
        byPerson: [],
      });
      return;
    }

    const filter: any = {
      // Takeaway orders are included for counter collections. Cancelled
      // orders must never appear or affect report totals; unpaid orders remain
      // visible because their due amount is part of the report.
      $and: [
        { status: { $ne: "cancelled" } },
        { $or: [{ status: { $in: ["delivered", "out_for_delivery", "takeaway"] } }, { deliveryType: "takeaway" }] },
      ],
      ...scopeFilter,
      ...buildDateFilter(from, to),
    };

    const orders = await col
      .find(filter, { projection: ORDER_PROJECTION })
      .sort({ createdAt: -1 })
      .toArray();

    const personMap = processOrders(orders);
    const byPersonArr = Array.from(personMap.values()).sort((a, b) => b.orderCount - a.orderCount);
    const deliveryTime = calculateDeliveryTimeStats(orders);

    const globalByMode: Record<string, ModeData> = {};
    let totalRevenue = 0;
    let totalDue = 0;
    let totalWalletExtra = 0;
    let totalSales = 0;

    for (const p of byPersonArr) {
      totalRevenue += p.totalRevenue;
      totalDue += p.dueAmount;
      totalWalletExtra += p.walletExtra || 0;
      totalSales += p.totalSales || 0;
      for (const [mode, data] of Object.entries(p.byMode) as [string, ModeData][]) {
        if (!globalByMode[mode]) globalByMode[mode] = { count: 0, amount: 0 };
        globalByMode[mode].count += data.count;
        globalByMode[mode].amount += data.amount;
      }
    }

    const r2 = (n: number) => Math.round(n * 100) / 100;
    res.json({
      summary: {
        totalOrders: orders.length,
        totalRevenue: r2(totalRevenue),
        dueAmount: r2(totalDue),
        walletExtra: r2(totalWalletExtra),
        totalSales: r2(totalSales),
        byMode: globalByMode,
        deliveryTime,
      },
      byPerson: byPersonArr,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch delivery report");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch delivery report" });
  }
});

// ─── GET /api/delivery-report/person/:id ─────────────────────────────────────
// ?from=YYYY-MM-DD  &to=YYYY-MM-DD
router.get("/person/:id", async (req: ScopedRequest, res) => {
  try {
    const conn = await getOrdersDb();
    const col = conn.db.collection("orders");
    const { from = "", to = "" } = req.query as Record<string, string>;
    const targetPersonId = req.params.id;

    const scopeFilter = buildScopeFilter(req, targetPersonId);
    if (!scopeFilter) {
      res.json({
        person: { personId: targetPersonId, personName: "Unknown", orderCount: 0, totalRevenue: 0, dueAmount: 0, byMode: {}, deliveryTime: publicDeliveryTimeStats(emptyDeliveryTimeStats()), orders: [] },
        summary: { totalOrders: 0, totalRevenue: 0, dueAmount: 0, byMode: {}, deliveryTime: publicDeliveryTimeStats(emptyDeliveryTimeStats()) },
      });
      return;
    }

    const filter: any = {
      // Keep the person report consistent with the summary report: exclude
      // cancelled orders, while retaining unpaid orders for due totals.
      $and: [
        { status: { $ne: "cancelled" } },
        { $or: [{ status: { $in: ["delivered", "out_for_delivery", "takeaway"] } }, { deliveryType: "takeaway" }] },
      ],
      ...scopeFilter,
      ...buildDateFilter(from, to),
    };

    const orders = await col
      .find(filter, { projection: ORDER_PROJECTION })
      .sort({ createdAt: -1 })
      .toArray();

    const personMap = processOrders(orders);

    // For delivery_person scope, personId may be their own ID, not targetPersonId
    const actualId =
      req.scope && !req.scope.isMaster && req.scope.role === "delivery_person"
        ? String(req.admin?.adminId ?? targetPersonId)
        : targetPersonId;

    const person = personMap.get(actualId) ?? {
      personId: actualId,
      personName: "No deliveries in range",
      orderCount: 0,
      totalRevenue: 0,
      dueAmount: 0,
      byMode: {},
      deliveryTime: publicDeliveryTimeStats(emptyDeliveryTimeStats()),
      orders: [],
    };

    res.json({
      person,
      summary: {
        totalOrders: person.orderCount,
        totalRevenue: person.totalRevenue,
        dueAmount: person.dueAmount,
        byMode: person.byMode,
        deliveryTime: person.deliveryTime,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch person delivery report");
    res.status(500).json({ error: "InternalError", message: "Failed to fetch person delivery report" });
  }
});

export default router;
