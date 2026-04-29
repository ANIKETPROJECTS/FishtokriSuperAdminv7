import { Router, type IRouter } from "express";
import { mongoose } from "../db/index.js";
import { requireAuth } from "../middlewares/auth.js";
import { denyIfNotMaster, loadScope } from "../middlewares/scope.js";

const router: IRouter = Router();
router.use(requireAuth as any);
router.use(loadScope as any);
// Retail invoices are not hub-tagged today, so we restrict the entire router
// to Master Admins. Super-hub / sub-hub users only see data scoped to their
// assigned hubs and must not read or mutate cross-hub retail invoices.
router.use(denyIfNotMaster as any);

const retailItemSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unit: { type: String, default: "pc" },
  pricePerUnit: { type: Number, default: 0 },
  totalPrice: { type: Number, default: 0 },
}, { _id: true });

const retailInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, default: "" },
    invoiceDate: { type: Date, default: Date.now },
    partyName: { type: String, required: true, trim: true },
    partyPhone: { type: String, default: "" },
    paymentMode: { type: String, default: "CASH" },
    status: { type: String, enum: ["paid", "draft", "cancelled", "due"], default: "paid" },
    items: { type: [retailItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String, default: "" },
    createdByName: { type: String, default: "" },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

function getModel() {
  if (mongoose.models["RetailInvoice"]) return mongoose.models["RetailInvoice"];
  return mongoose.model("RetailInvoice", retailInvoiceSchema, "retail_invoices");
}

function serialize(doc: any) {
  return {
    id: String(doc._id),
    invoiceNumber: doc.invoiceNumber ?? "",
    invoiceDate: doc.invoiceDate,
    partyName: doc.partyName ?? "",
    partyPhone: doc.partyPhone ?? "",
    paymentMode: doc.paymentMode ?? "CASH",
    status: doc.status ?? "paid",
    items: (doc.items ?? []).map((it: any) => ({
      id: String(it._id),
      productName: it.productName ?? "",
      quantity: it.quantity ?? 0,
      unit: it.unit ?? "pc",
      pricePerUnit: it.pricePerUnit ?? 0,
      totalPrice: it.totalPrice ?? 0,
    })),
    subtotal: doc.subtotal ?? 0,
    discount: doc.discount ?? 0,
    tax: doc.tax ?? 0,
    dueAmount: doc.dueAmount ?? 0,
    total: doc.total ?? 0,
    notes: doc.notes ?? "",
    createdByName: doc.createdByName ?? "",
    createdByEmail: doc.createdByEmail ?? "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

router.get("/next-invoice-number", async (req, res) => {
  try {
    const Model = getModel();
    const last = await Model.findOne({ invoiceNumber: /^TH\d+$/ })
      .sort({ createdAt: -1 })
      .select({ invoiceNumber: 1 })
      .lean();
    let nextNum = 1;
    if (last && (last as any).invoiceNumber) {
      const m = String((last as any).invoiceNumber).match(/^TH(\d+)$/);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    let candidate = `TH${String(nextNum).padStart(3, "0")}`;
    while (await Model.exists({ invoiceNumber: candidate })) {
      nextNum += 1;
      candidate = `TH${String(nextNum).padStart(3, "0")}`;
    }
    res.json({ invoiceNumber: candidate });
  } catch (err) {
    req.log.error({ err }, "Failed to compute next retail invoice number");
    res.status(500).json({ error: "InternalError", message: "Failed to compute next invoice number" });
  }
});

router.get("/", async (req, res) => {
  try {
    const Model = getModel();
    const { search, status, paymentMode, sort = "date_desc", page = "1", limit = "20" } = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ partyName: regex }, { invoiceNumber: regex }];
    }
    if (status && status !== "all") filter.status = status;
    if (paymentMode && paymentMode !== "all") filter.paymentMode = paymentMode;

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      date_desc: { invoiceDate: -1 },
      date_asc: { invoiceDate: 1 },
      total_desc: { total: -1 },
      total_asc: { total: 1 },
      party_asc: { partyName: 1 },
      party_desc: { partyName: -1 },
    };
    const sortObj = sortMap[sort] ?? { invoiceDate: -1 };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Model.find(filter).sort(sortObj).skip(skip).limit(limitNum),
      Model.countDocuments(filter),
    ]);
    res.json({ invoices: items.map(serialize), total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error({ err }, "Failed to list retail invoices");
    res.status(500).json({ error: "InternalError", message: "Failed to list retail invoices" });
  }
});

router.post("/", async (req, res) => {
  try {
    const Model = getModel();
    const { invoiceNumber, invoiceDate, partyName, partyPhone, paymentMode, status, items, discount, tax, dueAmount, notes } = req.body;
    if (!partyName?.trim()) {
      res.status(400).json({ error: "ValidationError", message: "Party name is required" });
      return;
    }
    const itemList = Array.isArray(items) ? items : [];
    const processed = itemList.map((it: any) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.pricePerUnit) || 0;
      return {
        productName: String(it.productName ?? "").trim(),
        quantity: qty,
        unit: it.unit || "pc",
        pricePerUnit: price,
        totalPrice: qty * price,
      };
    });
    const subtotal = processed.reduce((s, i) => s + i.totalPrice, 0);
    const discountAmt = Number(discount) || 0;
    const taxAmt = Number(tax) || 0;
    const dueAmt = Number(dueAmount) || 0;
    const total = Math.max(0, subtotal - discountAmt + taxAmt);

    const admin = (req as any).admin || {};
    const doc = await Model.create({
      invoiceNumber: invoiceNumber?.trim() || "",
      invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
      partyName: partyName.trim(),
      partyPhone: (partyPhone ?? "").trim(),
      paymentMode: paymentMode || "CASH",
      status: status || "paid",
      items: processed,
      subtotal,
      discount: discountAmt,
      tax: taxAmt,
      dueAmount: dueAmt,
      total,
      notes: (notes ?? "").trim(),
      createdByName: admin.name || admin.email || "",
      createdByEmail: admin.email || "",
    });
    res.status(201).json({ invoice: serialize(doc) });
  } catch (err) {
    req.log.error({ err }, "Failed to create retail invoice");
    res.status(500).json({ error: "InternalError", message: "Failed to create retail invoice" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const Model = getModel();
    const doc = await Model.findById(req.params.id);
    if (!doc) { res.status(404).json({ error: "NotFound", message: "Invoice not found" }); return; }

    const { invoiceNumber, invoiceDate, partyName, partyPhone, paymentMode, status, items, discount, tax, dueAmount, notes } = req.body;
    if (invoiceNumber !== undefined) (doc as any).invoiceNumber = invoiceNumber.trim();
    if (invoiceDate) (doc as any).invoiceDate = new Date(invoiceDate);
    if (partyName !== undefined) (doc as any).partyName = partyName.trim();
    if (partyPhone !== undefined) (doc as any).partyPhone = partyPhone.trim();
    if (paymentMode !== undefined) (doc as any).paymentMode = paymentMode;
    if (status !== undefined) (doc as any).status = status;
    if (notes !== undefined) (doc as any).notes = notes.trim();
    if (Array.isArray(items)) {
      const processed = items.map((it: any) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.pricePerUnit) || 0;
        return { productName: String(it.productName ?? "").trim(), quantity: qty, unit: it.unit || "pc", pricePerUnit: price, totalPrice: qty * price };
      });
      (doc as any).items = processed;
      (doc as any).subtotal = processed.reduce((s: number, i: any) => s + i.totalPrice, 0);
    }
    if (discount !== undefined) (doc as any).discount = Number(discount) || 0;
    if (tax !== undefined) (doc as any).tax = Number(tax) || 0;
    if (dueAmount !== undefined) (doc as any).dueAmount = Number(dueAmount) || 0;
    (doc as any).total = Math.max(0, ((doc as any).subtotal || 0) - ((doc as any).discount || 0) + ((doc as any).tax || 0));

    await doc.save();
    res.json({ invoice: serialize(doc) });
  } catch (err) {
    req.log.error({ err }, "Failed to update retail invoice");
    res.status(500).json({ error: "InternalError", message: "Failed to update retail invoice" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const Model = getModel();
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) { res.status(404).json({ error: "NotFound", message: "Invoice not found" }); return; }
    res.json({ message: "Invoice deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete retail invoice");
    res.status(500).json({ error: "InternalError", message: "Failed to delete retail invoice" });
  }
});

export default router;
