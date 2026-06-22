import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  calculateSalePrice,
  createRawFishProduct,
  createRecord,
  listRawFishProducts,
  type CalculateSalePriceResponse,
  type RawFishProduct
} from "../api";

type FormState = {
  record_date: string;
  raw_fish_product_id: string; // number string or ""
  buy_price_per_kg: string;
  wastage_percent: string;
  margin_percent: string;
  total_kg: string;
  expiry_date: string;
  save_to_history: boolean;
};

function parseNumberOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function fmt2(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

export function PriceCalculatorPage() {
  const [form, setForm] = useState<FormState>({
    record_date: new Date().toISOString().slice(0, 10),
    raw_fish_product_id: "",
    buy_price_per_kg: "",
    wastage_percent: "0",
    margin_percent: "0",
    total_kg: "",
    expiry_date: "",
    save_to_history: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CalculateSalePriceResponse | null>(null);
  const [products, setProducts] = useState<RawFishProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [adding, setAdding] = useState(false);

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const data = await listRawFishProducts({ limit: 1000 });
      setProducts(data);
    } finally {
      setProductsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const validationError = useMemo(() => {
    const buy = parseNumberOrNull(form.buy_price_per_kg);
    const wastage = parseNumberOrNull(form.wastage_percent);
    const margin = parseNumberOrNull(form.margin_percent);

    if (!form.raw_fish_product_id) return "Select Raw Fish Product (or add a new one).";
    if (buy === null) return "Enter Buy Price (₹/kg).";
    if (buy <= 0) return "Buy Price must be greater than 0.";
    if (wastage === null) return "Enter Wastage (%).";
    if (wastage < 0 || wastage >= 100) return "Wastage must be ≥ 0 and < 100.";
    if (margin === null) return "Enter Margin (%).";
    if (margin < 0) return "Margin must be ≥ 0.";
    return null;
  }, [form]);

  const selectedProduct = useMemo(() => {
    if (!form.raw_fish_product_id) return null;
    const id = Number(form.raw_fish_product_id);
    if (!Number.isFinite(id)) return null;
    return products.find((p) => p.id === id) || null;
  }, [form.raw_fish_product_id, products]);

  async function onAddProduct() {
    setError(null);
    setMessage(null);

    const name = newProductName.trim();
    if (!name) {
      setError("Enter raw fish product name.");
      return;
    }

    setAdding(true);
    try {
      const created = await createRawFishProduct({ name });
      await loadProducts();
      setForm((f) => ({ ...f, raw_fish_product_id: String(created.id) }));
      setNewProductName("");
      setAddOpen(false);
      setMessage("Raw fish product saved.");
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError((e.response?.data as any)?.detail || e.message || "Failed to add product.");
      } else {
        setError("Failed to add product.");
      }
    } finally {
      setAdding(false);
    }
  }

  async function onCalculate() {
    setError(null);
    setMessage(null);
    setResult(null);

    if (validationError) {
      setError(validationError);
      return;
    }

    const buy = Number(form.buy_price_per_kg);
    const wastage = Number(form.wastage_percent);
    const margin = Number(form.margin_percent);

    setLoading(true);
    try {
      const data = await calculateSalePrice({
        buy_price_per_kg: buy,
        wastage_percent: wastage,
        margin_percent: margin
      });
      setResult(data);
      if (form.save_to_history) {
        const totalKg = parseNumberOrNull(form.total_kg);
        await createRecord({
          record_date: form.record_date,
          buy_price_per_kg: buy,
          wastage_percent: wastage,
          margin_percent: margin,
          raw_fish_product_id: selectedProduct?.id ?? null,
          raw_fish_product_name: selectedProduct?.name ?? null,
          total_kg: totalKg ?? undefined,
          expiry_date: form.expiry_date || undefined
        });
        setMessage("Calculated and saved to history.");
      } else {
        setMessage("Calculated.");
      }
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError(
          (e.response?.data as any)?.detail ||
            e.message ||
            "Failed to calculate price."
        );
      } else {
        setError("Failed to calculate price.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    setError(null);
    setMessage(null);

    if (!result) {
      setError("Calculate first, then save.");
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!form.record_date) {
      setError("Select a date.");
      return;
    }

    setSaving(true);
    try {
      const totalKg = parseNumberOrNull(form.total_kg);
      await createRecord({
        record_date: form.record_date,
        buy_price_per_kg: Number(form.buy_price_per_kg),
        wastage_percent: Number(form.wastage_percent),
        margin_percent: Number(form.margin_percent),
        raw_fish_product_id: selectedProduct?.id ?? null,
        raw_fish_product_name: selectedProduct?.name ?? null,
        total_kg: totalKg ?? undefined,
        expiry_date: form.expiry_date || undefined
      });
      setMessage("Saved to history.");
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError(
          (e.response?.data as any)?.detail || e.message || "Failed to save record."
        );
      } else {
        setError("Failed to save record.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2 className="card__title">Price Calculator</h2>
      <p className="muted">
        Enter Buy Price in <b>₹/kg</b>. Wastage and Margin are <b>%</b> and can be
        0.
      </p>

      <div className="grid">
        <label className="field">
          <span className="field__label">Date</span>
          <input
            className="input"
            type="date"
            value={form.record_date}
            onChange={(e) => setForm((f) => ({ ...f, record_date: e.target.value }))}
          />
        </label>

        <label className="field">
          <span className="field__label">Raw Fish Product</span>
          <select
            className="input"
            value={form.raw_fish_product_id}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__add__") {
                setAddOpen(true);
                return;
              }
              setForm((f) => ({ ...f, raw_fish_product_id: val }));
            }}
            disabled={productsLoading}
          >
            <option value="">{productsLoading ? "Loading..." : "Select product"}</option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
            <option value="__add__">+ Add new product…</option>
          </select>
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => setAddOpen(true)}
              style={{ padding: "10px 12px", fontSize: 14 }}
            >
              + Add product
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field__label">Buy Price (₹/kg)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.buy_price_per_kg}
            onChange={(e) => setForm((f) => ({ ...f, buy_price_per_kg: e.target.value }))}
            placeholder="e.g. 320"
          />
        </label>

        <label className="field">
          <span className="field__label">Wastage (%)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.wastage_percent}
            onChange={(e) => setForm((f) => ({ ...f, wastage_percent: e.target.value }))}
            placeholder="e.g. 10"
          />
        </label>

        <label className="field">
          <span className="field__label">Margin (%)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.margin_percent}
            onChange={(e) => setForm((f) => ({ ...f, margin_percent: e.target.value }))}
            placeholder="e.g. 15"
          />
        </label>

        <label className="field">
          <span className="field__label">Total Purchase (kg)</span>
          <input
            className="input"
            inputMode="decimal"
            value={form.total_kg}
            onChange={(e) => setForm((f) => ({ ...f, total_kg: e.target.value }))}
            placeholder="e.g. 20"
          />
        </label>

        <label className="field">
          <span className="field__label">Expiry Date</span>
          <input
            className="input"
            type="date"
            value={form.expiry_date}
            onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
          />
        </label>
      </div>

      <div className="row">
        <button
          className="button"
          type="button"
          onClick={onCalculate}
          disabled={loading}
        >
          {loading ? "Calculating..." : "Calculate Price"}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={form.save_to_history}
            onChange={(e) => setForm((f) => ({ ...f, save_to_history: e.target.checked }))}
          />
          <span>Save to history</span>
        </label>
        <button
          className="button button--secondary"
          type="button"
          onClick={onSave}
          disabled={saving || !result}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {validationError && !error ? (
          <span className="hint">Tip: {validationError}</span>
        ) : null}
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert alert--success">{message}</div> : null}

      {addOpen ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Add Raw Fish Product</h3>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setAddOpen(false)}
              >
                Close
              </button>
            </div>
            <div style={{ height: 12 }} />
            <label className="field">
              <span className="field__label">Product name</span>
              <input
                className="input"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                placeholder="e.g. Sardine"
              />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button className="button" type="button" onClick={onAddProduct} disabled={adding}>
                {adding ? "Saving..." : "Save product"}
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={adding}
              >
                Cancel
              </button>
            </div>
            <p className="muted" style={{ marginTop: 10 }}>
              After saving, it will be selectable in the dropdown.
            </p>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="results">
          <div className="stats">
            <div className="stat">
              <div className="stat__label">Buy price per gram</div>
              <div className="stat__value">₹ {fmt2(result.buy_price_per_gram)}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Effective price per gram</div>
              <div className="stat__value">₹ {fmt2(result.effective_price_per_gram)}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Margin per gram</div>
              <div className="stat__value">₹ {fmt2(result.margin_price_per_gram)}</div>
            </div>
            <div className="stat stat--highlight">
              <div className="stat__label">Final sale price per gram</div>
              <div className="stat__value">₹ {fmt2(result.final_sale_price_per_gram)}</div>
            </div>
          </div>

          <h3 className="sectionTitle">Packet Prices</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Packet</th>
                <th>Price (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.packet_prices)
                .sort(([a], [b]) => Number(a.replace("g", "")) - Number(b.replace("g", "")))
                .map(([k, v]) => (
                <tr key={k}>
                  <td className="mono">{k}</td>
                  <td>{fmt2(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}


