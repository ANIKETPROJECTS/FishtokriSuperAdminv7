import { useState, useEffect, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { FishCalculatorTabs } from "@/components/fish-calculator-tabs";

type Config = {
  market_handling_cost: number;
  fixed_cost: number;
  packaging_cost: number;
  delivery_cost: number;
};

type CalculateResult = {
  buy_price_per_gram: number;
  effective_price_per_gram: number;
  margin_price_per_gram: number;
  final_sale_price_per_gram: number;
  packet_prices: Record<string, number>;
};

type RawProduct = { id: string; name: string };

type FormState = {
  record_date: string;
  raw_fish_product_id: string;
  buy_price_per_kg: string;
  wastage_percent: string;
  margin_percent: string;
  total_kg: string;
  expiry_date: string;
  save_to_history: boolean;
};

function fmt2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

function parseNum(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function FishCalculatorPricePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FormState>({
    record_date: today,
    raw_fish_product_id: "",
    buy_price_per_kg: "",
    wastage_percent: "0",
    margin_percent: "0",
    total_kg: "",
    expiry_date: "",
    save_to_history: true,
  });
  const [result, setResult] = useState<CalculateResult | null>(null);
  const [products, setProducts] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [adding, setAdding] = useState(false);

  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadProducts() {
    try {
      const data = await apiFetch("/api/fish-calculator/products?limit=1000");
      setProducts(data);
    } catch {}
  }

  useEffect(() => { void loadProducts(); }, []);

  const selectedProduct = useMemo(() => {
    if (!form.raw_fish_product_id) return null;
    return products.find((p) => p.id === form.raw_fish_product_id) || null;
  }, [form.raw_fish_product_id, products]);

  const validationError = useMemo(() => {
    const buy = parseNum(form.buy_price_per_kg);
    const wastage = parseNum(form.wastage_percent);
    const margin = parseNum(form.margin_percent);
    if (!form.raw_fish_product_id) return "Select a raw fish product.";
    if (buy === null) return "Enter Buy Price (₹/kg).";
    if (buy <= 0) return "Buy Price must be > 0.";
    if (wastage === null) return "Enter Wastage (%).";
    if (wastage < 0 || wastage >= 100) return "Wastage must be ≥ 0 and < 100.";
    if (margin === null) return "Enter Margin (%).";
    if (margin < 0) return "Margin must be ≥ 0.";
    return null;
  }, [form]);

  async function onEditProduct() {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) { toast({ title: "Enter product name", variant: "destructive" }); return; }
    setEditSaving(true);
    try {
      await apiFetch(`/api/fish-calculator/products/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      });
      await loadProducts();
      setEditingId(null);
      setEditingName("");
      toast({ title: "Product updated" });
    } catch (e: any) {
      toast({ title: e.message || "Failed to update product", variant: "destructive" });
    } finally {
      setEditSaving(false);
    }
  }

  async function onDeleteProduct(id: string) {
    setDeleting(true);
    try {
      await apiFetch(`/api/fish-calculator/products/${id}`, { method: "DELETE" });
      await loadProducts();
      if (form.raw_fish_product_id === id) {
        setForm((f) => ({ ...f, raw_fish_product_id: "" }));
      }
      setDeleteConfirmId(null);
      toast({ title: "Product deleted" });
    } catch (e: any) {
      toast({ title: e.message || "Failed to delete product", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function onAddProduct() {
    const name = newProductName.trim();
    if (!name) { toast({ title: "Enter product name", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const created = await apiFetch("/api/fish-calculator/products", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      await loadProducts();
      setForm((f) => ({ ...f, raw_fish_product_id: created.id }));
      setNewProductName("");
      setAddOpen(false);
      toast({ title: "Product added" });
    } catch (e: any) {
      toast({ title: e.message || "Failed to add product", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function onCalculate() {
    if (validationError) { toast({ title: validationError, variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const buy = Number(form.buy_price_per_kg);
      const wastage = Number(form.wastage_percent);
      const margin = Number(form.margin_percent);
      const data: CalculateResult = await apiFetch("/api/fish-calculator/calculate", {
        method: "POST",
        body: JSON.stringify({ buy_price_per_kg: buy, wastage_percent: wastage, margin_percent: margin }),
      });
      setResult(data);
      if (form.save_to_history) {
        const totalKg = parseNum(form.total_kg);
        await apiFetch("/api/fish-calculator/records", {
          method: "POST",
          body: JSON.stringify({
            record_date: form.record_date,
            buy_price_per_kg: buy,
            wastage_percent: wastage,
            margin_percent: margin,
            raw_fish_product_id: selectedProduct?.id ?? null,
            raw_fish_product_name: selectedProduct?.name ?? null,
            total_kg: totalKg ?? undefined,
            expiry_date: form.expiry_date || undefined,
          }),
        });
        toast({ title: "Calculated and saved to history" });
      } else {
        toast({ title: "Calculated" });
      }
    } catch (e: any) {
      toast({ title: e.message || "Calculation failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!result) { toast({ title: "Calculate first", variant: "destructive" }); return; }
    if (validationError) { toast({ title: validationError, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const totalKg = parseNum(form.total_kg);
      await apiFetch("/api/fish-calculator/records", {
        method: "POST",
        body: JSON.stringify({
          record_date: form.record_date,
          buy_price_per_kg: Number(form.buy_price_per_kg),
          wastage_percent: Number(form.wastage_percent),
          margin_percent: Number(form.margin_percent),
          raw_fish_product_id: selectedProduct?.id ?? null,
          raw_fish_product_name: selectedProduct?.name ?? null,
          total_kg: totalKg ?? undefined,
          expiry_date: form.expiry_date || undefined,
        }),
      });
      toast({ title: "Saved to history" });
    } catch (e: any) {
      toast({ title: e.message || "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <FishCalculatorTabs />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Price Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">Enter buy price in ₹/kg. Wastage and Margin are percentages and can be 0.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
              value={form.record_date}
              onChange={(e) => setForm((f) => ({ ...f, record_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raw Fish Product</label>
            <div className="flex gap-2">
              <select
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
                value={form.raw_fish_product_id}
                onChange={(e) => {
                  if (e.target.value === "__add__") { setAddOpen(true); return; }
                  setForm((f) => ({ ...f, raw_fish_product_id: e.target.value }));
                }}
              >
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="__add__">+ Add new…</option>
              </select>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-[#364F9F] font-medium"
              >
                + Add
              </button>
              <button
                type="button"
                onClick={() => { setManageOpen(true); setEditingId(null); setDeleteConfirmId(null); }}
                title="Edit / delete products"
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 font-medium"
              >
                ✎
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buy Price (₹/kg)</label>
            <input
              inputMode="decimal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
              value={form.buy_price_per_kg}
              onChange={(e) => setForm((f) => ({ ...f, buy_price_per_kg: e.target.value }))}
              placeholder="e.g. 320"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wastage (%)</label>
            <input
              inputMode="decimal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
              value={form.wastage_percent}
              onChange={(e) => setForm((f) => ({ ...f, wastage_percent: e.target.value }))}
              placeholder="e.g. 10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Margin (%)</label>
            <input
              inputMode="decimal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
              value={form.margin_percent}
              onChange={(e) => setForm((f) => ({ ...f, margin_percent: e.target.value }))}
              placeholder="e.g. 15"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Purchase (kg)</label>
            <input
              inputMode="decimal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
              value={form.total_kg}
              onChange={(e) => setForm((f) => ({ ...f, total_kg: e.target.value }))}
              placeholder="e.g. 20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
              value={form.expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCalculate}
            disabled={loading}
            className="px-5 py-2.5 bg-[#F05B4E] hover:bg-[#d94a3d] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Calculating…" : "Calculate Price"}
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.save_to_history}
              onChange={(e) => setForm((f) => ({ ...f, save_to_history: e.target.checked }))}
              className="rounded"
            />
            Save to history
          </label>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !result}
            className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#364F9F] text-sm font-semibold rounded-lg transition disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {validationError && (
            <span className="text-xs text-amber-600">Tip: {validationError}</span>
          )}
        </div>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Buy price / gram", value: `₹ ${fmt2(result.buy_price_per_gram)}` },
              { label: "Effective price / gram", value: `₹ ${fmt2(result.effective_price_per_gram)}` },
              { label: "Margin / gram", value: `₹ ${fmt2(result.margin_price_per_gram)}` },
              { label: "Final sale price / gram", value: `₹ ${fmt2(result.final_sale_price_per_gram)}`, highlight: true },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border p-4 ${s.highlight ? "bg-[#F05B4E] border-[#F05B4E] text-white" : "bg-white border-gray-200"}`}
              >
                <div className={`text-xs font-medium mb-1 ${s.highlight ? "text-white/80" : "text-gray-500"}`}>{s.label}</div>
                <div className={`text-xl font-bold ${s.highlight ? "text-white" : "text-gray-900"}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Packet Prices</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs">
                  <th className="text-left px-5 py-2.5 font-medium">Packet Size</th>
                  <th className="text-right px-5 py-2.5 font-medium">Price (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.packet_prices)
                  .sort(([a], [b]) => Number(a.replace("g", "")) - Number(b.replace("g", "")))
                  .map(([k, v]) => (
                    <tr key={k} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-gray-700">{k}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">₹ {fmt2(v)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Add Raw Fish Product</h3>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product name</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="e.g. Sardine"
                onKeyDown={(e) => { if (e.key === "Enter") onAddProduct(); }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAddProduct}
                disabled={adding}
                className="flex-1 py-2.5 bg-[#F05B4E] hover:bg-[#d94a3d] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
              >
                {adding ? "Saving…" : "Save product"}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={adding}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Manage Raw Fish Products</h3>
              <button
                onClick={() => { setManageOpen(false); setEditingId(null); setDeleteConfirmId(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >×</button>
            </div>

            {products.length === 0 && (
              <p className="text-sm text-gray-400 py-4 text-center">No products added yet.</p>
            )}

            <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {products.map((p) => (
                <li key={p.id} className="py-2.5">
                  {editingId === p.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F05B4E]/40"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") onEditProduct(); if (e.key === "Escape") setEditingId(null); }}
                      />
                      <button
                        onClick={onEditProduct}
                        disabled={editSaving}
                        className="px-3 py-1.5 bg-[#F05B4E] hover:bg-[#d94a3d] text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {editSaving ? "…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : deleteConfirmId === p.id ? (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-red-600">Delete <strong>{p.name}</strong>?</span>
                      <button
                        onClick={() => onDeleteProduct(p.id)}
                        disabled={deleting}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {deleting ? "…" : "Yes, delete"}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-800">{p.name}</span>
                      <button
                        onClick={() => { setEditingId(p.id); setEditingName(p.name); setDeleteConfirmId(null); }}
                        className="px-2.5 py-1 text-xs text-[#364F9F] border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setDeleteConfirmId(p.id); setEditingId(null); }}
                        className="px-2.5 py-1 text-xs text-red-500 border border-gray-200 rounded-lg hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => { setManageOpen(false); setAddOpen(true); }}
              className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-[#364F9F] hover:bg-gray-50 transition"
            >
              + Add new product
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
