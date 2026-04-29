import { Router, type IRouter } from "express";
import { mongoose } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { denyIfNotMaster, loadScope, type ScopedRequest } from "../middlewares/scope.js";
import { getSubHubDbConnection } from "../db/sub-hub-connections.js";

const router: IRouter = Router();
router.use(requireAuth as any);
router.use(loadScope as any);

// ── Schemas ────────────────────────────────────────────────────────────────

const accountSchema = new mongoose.Schema(
  {
    accountName: { type: String, required: true, trim: true },
    bankName:    { type: String, required: true, trim: true },
    accountNo:   { type: String, default: "", trim: true },
    ifscCode:    { type: String, default: "", trim: true },
    balance:     { type: Number, default: 0 },
  },
  { timestamps: true },
);

const receiptSchema = new mongoose.Schema(
  {
    date:                 { type: Date, required: true },
    paymentMode:          { type: String, required: true, trim: true },
    depositAccountName:   { type: String, required: true, trim: true },
    oppositeAccountName:  { type: String, required: true, trim: true },
    amount:               { type: Number, required: true },
    notes:                { type: String, default: "" },
    sourceType:           { type: String, default: "" },
    sourceOrderId:        { type: String, default: "" },
  },
  { timestamps: true },
);

const paymentSchema = new mongoose.Schema(
  {
    date:                 { type: Date, required: true },
    paymentMode:          { type: String, required: true, trim: true },
    depositAccountName:   { type: String, required: true, trim: true },
    oppositeAccountName:  { type: String, required: true, trim: true },
    amount:               { type: Number, required: true },
    notes:                { type: String, default: "" },
  },
  { timestamps: true },
);

function getAccountModel() {
  if (mongoose.models["BankAccount"]) return mongoose.models["BankAccount"];
  return mongoose.model("BankAccount", accountSchema, "bank_accounts");
}

function getReceiptModel() {
  if (mongoose.models["BankReceipt"]) return mongoose.models["BankReceipt"];
  return mongoose.model("BankReceipt", receiptSchema, "bank_receipts");
}

function getPaymentModel() {
  if (mongoose.models["BankPayment"]) return mongoose.models["BankPayment"];
  return mongoose.model("BankPayment", paymentSchema, "bank_payments");
}

function toId(id: string) {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
}

function serializeAccount(doc: any) {
  return {
    id:          String(doc._id),
    accountName: doc.accountName ?? "",
    bankName:    doc.bankName ?? "",
    accountNo:   doc.accountNo ?? "",
    ifscCode:    doc.ifscCode ?? "",
    balance:     doc.balance ?? 0,
    createdAt:   doc.createdAt,
    updatedAt:   doc.updatedAt,
  };
}

function serializeTx(doc: any) {
  return {
    id:                   String(doc._id),
    date:                 doc.date,
    paymentMode:          doc.paymentMode ?? "",
    depositAccountName:   doc.depositAccountName ?? "",
    oppositeAccountName:  doc.oppositeAccountName ?? "",
    amount:               doc.amount ?? 0,
    notes:                doc.notes ?? "",
    createdAt:            doc.createdAt,
    updatedAt:            doc.updatedAt,
  };
}

/**
 * Returns the set of orderIds (as strings) that fall within the request
 * user's scope. Returns null when the caller is master (no scoping needed).
 * Returns an empty Set when the caller has no hubs assigned.
 */
async function loadScopedOrderIds(scope: ScopedRequest["scope"]): Promise<Set<string> | null> {
  if (!scope || scope.isMaster) return null;
  if (scope.subHubIds.length === 0) return new Set();
  const ordersConn = await getSubHubDbConnection("orders");
  const orders = await ordersConn.db
    .collection("orders")
    .find({ subHubId: { $in: scope.subHubIds } })
    .project({ _id: 1 })
    .toArray();
  const set = new Set<string>();
  for (const o of orders) set.add(String(o._id));
  return set;
}

// ── Accounts (master-managed; non-master users see nothing) ────────────────

router.get("/accounts", async (req: ScopedRequest, res) => {
  try {
    if (req.scope && !req.scope.isMaster) { res.json([]); return; }
    const Account = getAccountModel();
    const docs = await Account.find().sort({ createdAt: -1 });
    res.json(docs.map(serializeAccount));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/accounts", denyIfNotMaster as any, async (req, res) => {
  try {
    const Account = getAccountModel();
    const doc = await Account.create(req.body);
    res.status(201).json(serializeAccount(doc));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/accounts/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Account = getAccountModel();
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid id" });
    const doc = await Account.findByIdAndUpdate(oid, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: "Account not found" });
    res.json(serializeAccount(doc));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/accounts/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Account = getAccountModel();
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid id" });
    const doc = await Account.findByIdAndDelete(oid);
    if (!doc) return res.status(404).json({ message: "Account not found" });
    res.json({ message: "Deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Receipts (scoped by source order for non-master users) ─────────────────

router.get("/receipts", async (req: ScopedRequest, res) => {
  try {
    const Receipt = getReceiptModel();
    const scopedOrderIds = await loadScopedOrderIds(req.scope);
    let filter: any = {};
    if (scopedOrderIds !== null) {
      // Non-master users only see receipts that originated from one of their
      // sub hub orders. Receipts without a source order are master-only.
      if (scopedOrderIds.size === 0) { res.json([]); return; }
      filter = { sourceType: "order", sourceOrderId: { $in: [...scopedOrderIds] } };
    }
    const docs = await Receipt.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(docs.map(serializeTx));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/receipts", denyIfNotMaster as any, async (req, res) => {
  try {
    const Receipt = getReceiptModel();
    const doc = await Receipt.create(req.body);
    res.status(201).json(serializeTx(doc));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/receipts/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Receipt = getReceiptModel();
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid id" });
    const doc = await Receipt.findByIdAndUpdate(oid, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: "Receipt not found" });
    res.json(serializeTx(doc));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/receipts/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Receipt = getReceiptModel();
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid id" });
    const doc = await Receipt.findByIdAndDelete(oid);
    if (!doc) return res.status(404).json({ message: "Receipt not found" });
    res.json({ message: "Deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Payments (master-only ledger) ──────────────────────────────────────────

router.get("/payments", async (req: ScopedRequest, res) => {
  try {
    if (req.scope && !req.scope.isMaster) { res.json([]); return; }
    const Payment = getPaymentModel();
    const docs = await Payment.find().sort({ date: -1, createdAt: -1 });
    res.json(docs.map(serializeTx));
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/payments", denyIfNotMaster as any, async (req, res) => {
  try {
    const Payment = getPaymentModel();
    const doc = await Payment.create(req.body);
    res.status(201).json(serializeTx(doc));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.put("/payments/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Payment = getPaymentModel();
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid id" });
    const doc = await Payment.findByIdAndUpdate(oid, req.body, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: "Payment not found" });
    res.json(serializeTx(doc));
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

router.delete("/payments/:id", denyIfNotMaster as any, async (req, res) => {
  try {
    const Payment = getPaymentModel();
    const oid = toId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid id" });
    const doc = await Payment.findByIdAndDelete(oid);
    if (!doc) return res.status(404).json({ message: "Payment not found" });
    res.json({ message: "Deleted" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Helper: sync order payments → bank_payments ───────────────────────────
const ORDER_MODE_MAP: Record<string, string> = {
  cash: "CASH",
  upi: "UPI",
  card: "CREDIT CARD",
  bank_transfer: "NEFT",
  wallet: "PAYTM",
  other: "OTHER",
};

export async function syncOrderBankPayments(opts: {
  orderId: string;
  customerName?: string;
  payments: Array<{ mode: string; amount: number; reference?: string; paidAt?: Date }>;
  orderRef?: string;
}) {
  const Receipt = getReceiptModel();
  const { orderId, customerName = "", payments = [], orderRef = "" } = opts;
  if (!orderId) return;

  // Remove any prior receipts tied to this order so updates reconcile cleanly.
  await Receipt.deleteMany({ sourceType: "order", sourceOrderId: orderId });

  const docs = (payments || [])
    .filter((p) => p && p.mode && Number(p.amount) > 0)
    .map((p) => {
      const modeKey = String(p.mode || "").toLowerCase();
      const mappedMode = ORDER_MODE_MAP[modeKey] || String(p.mode || "OTHER").toUpperCase();
      const noteParts = [
        `Order${orderRef ? ` ${orderRef}` : ""} payment`,
        p.reference ? `Ref: ${p.reference}` : "",
      ].filter(Boolean);
      return {
        date: p.paidAt ? new Date(p.paidAt) : new Date(),
        paymentMode: mappedMode,
        depositAccountName: mappedMode,
        oppositeAccountName: customerName || "Customer",
        amount: Math.max(0, Number(p.amount) || 0),
        notes: noteParts.join(" · "),
        sourceType: "order",
        sourceOrderId: orderId,
      };
    });

  if (docs.length > 0) {
    await Receipt.insertMany(docs);
  }
}

export default router;
