import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { listRecords, updateRecord, deleteRecord, type RecordItem } from "../api";

type Filters = {
  from_date: string;
  to_date: string;
  limit: number;
};

type EditState = {
  id: number | null;
  buy_price_per_kg: string;
  wastage_percent: string;
  margin_percent: string;
  total_kg: string;
  total_purchase_kg: string;
};

function parseNumberOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function fmt2(n: unknown) {
  const num = typeof n === "number" ? n : Number(n);
  return Number.isFinite(num) ? num.toFixed(2) : "-";
}

function packetEntries(packet_prices: Record<string, number>) {
  return Object.entries(packet_prices || {}).sort(
    ([a], [b]) => Number(a.replace("g", "")) - Number(b.replace("g", ""))
  );
}

const REQUIRED_PACKET_WEIGHTS = [100, 250, 500, 750, 1000] as const;

function normalizedPacketEntries(r: RecordItem) {
  const outputs: any = r.outputs as any;
  const fromSaved: Record<string, number> = outputs?.packet_prices || {};
  const finalPerGram = Number(outputs?.final_sale_price_per_gram);

  // If record already has some packet prices, prefer them; otherwise derive from final_per_gram.
  const out: Record<string, number> = {};
  for (const w of REQUIRED_PACKET_WEIGHTS) {
    const k = `${w}g`;
    const savedVal = fromSaved?.[k];
    if (typeof savedVal === "number" && Number.isFinite(savedVal)) {
      out[k] = savedVal;
    } else if (Number.isFinite(finalPerGram)) {
      out[k] = Math.round(finalPerGram * w * 100) / 100;
    }
  }
  return packetEntries(out);
}

function packetPriceForWeight(r: RecordItem, w: (typeof REQUIRED_PACKET_WEIGHTS)[number]) {
  const outputs: any = r.outputs as any;
  const fromSaved: Record<string, number> = outputs?.packet_prices || {};
  const k = `${w}g`;
  const savedVal = fromSaved?.[k];
  if (typeof savedVal === "number" && Number.isFinite(savedVal)) return savedVal;

  const finalPerGram = Number(outputs?.final_sale_price_per_gram);
  if (!Number.isFinite(finalPerGram)) return null;
  return Math.round(finalPerGram * w * 100) / 100;
}

export function HistoryPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [filters, setFilters] = useState<Filters>({ from_date: today, to_date: today, limit: 50 });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>({
    id: null,
    buy_price_per_kg: "",
    wastage_percent: "",
    margin_percent: "",
    total_kg: "",
    total_purchase_kg: ""
  });

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await listRecords({
        from_date: filters.from_date || undefined,
        to_date: filters.to_date || undefined,
        limit: filters.limit
      });
      setRecords(data);
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError((e.response?.data as any)?.detail || e.message || "Failed to load history.");
      } else {
        setError("Failed to load history.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const product = String(r.inputs.raw_fish_product_name || "").toLowerCase();
      const recordDate = String(r.record_date || "").toLowerCase();
      const createdAt = String(r.created_at || "").toLowerCase();
      const buy = String(r.inputs.buy_price_per_kg ?? "").toLowerCase();
      return (
        product.includes(q) ||
        recordDate.includes(q) ||
        createdAt.includes(q) ||
        buy.includes(q)
      );
    });
  }, [records, query]);

  function startEdit(r: RecordItem) {
    setError(null);
    setEdit({
      id: r.id,
      buy_price_per_kg: String(r.inputs.buy_price_per_kg ?? ""),
      wastage_percent: String(r.inputs.wastage_percent ?? ""),
      margin_percent: String(r.inputs.margin_percent ?? ""),
      total_kg: String(r.inputs.total_kg ?? ""),
      total_purchase_kg: String(r.inputs.total_purchase_kg ?? "")
    });
  }

  function cancelEdit() {
    setEdit({ id: null, buy_price_per_kg: "", wastage_percent: "", margin_percent: "", total_kg: "", total_purchase_kg: "" });
  }

  const editValidationError = useMemo(() => {
    if (edit.id == null) return null;
    const buy = parseNumberOrNull(edit.buy_price_per_kg);
    const wastage = parseNumberOrNull(edit.wastage_percent);
    const margin = parseNumberOrNull(edit.margin_percent);
    if (buy === null) return "Enter Buy (₹/kg).";
    if (buy <= 0) return "Buy must be > 0.";
    if (wastage === null) return "Enter Wastage (%).";
    if (wastage < 0 || wastage >= 100) return "Wastage must be ≥ 0 and < 100.";
    if (margin === null) return "Enter Margin (%).";
    if (margin < 0) return "Margin must be ≥ 0.";
    return null;
  }, [edit]);

  async function saveEdit() {
    if (edit.id == null) return;
    setError(null);
    if (editValidationError) {
      setError(editValidationError);
      return;
    }

    const id = edit.id;
    setSavingId(id);
    try {
      const totalKg = parseNumberOrNull(edit.total_kg);
      const totalPurchaseKg = parseNumberOrNull(edit.total_purchase_kg);
      const payload: { buy_price_per_kg: number; wastage_percent: number; margin_percent: number; total_kg?: number; total_purchase_kg?: number; expiry_date?: string } = {
        buy_price_per_kg: Number(edit.buy_price_per_kg),
        wastage_percent: Number(edit.wastage_percent),
        margin_percent: Number(edit.margin_percent)
      };
      if (totalKg !== null) {
        payload.total_kg = totalKg;
      }
      if (totalPurchaseKg !== null) {
        payload.total_purchase_kg = totalPurchaseKg;
      }
      const updated = await updateRecord(id, payload);
      setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      cancelEdit();
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError((e.response?.data as any)?.detail || e.message || "Failed to update record.");
      } else {
        setError("Failed to update record.");
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(recordId: number) {
    if (!confirm("Are you sure you want to delete this record?")) {
      return;
    }
    setError(null);
    setDeletingId(recordId);
    try {
      await deleteRecord(recordId);
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        setError((e.response?.data as any)?.detail || e.message || "Failed to delete record.");
      } else {
        setError("Failed to delete record.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  function exportToCSV() {
    if (filteredRecords.length === 0) {
      setError("No records to export.");
      return;
    }

    const headers = [
      "ID",
      "Date",
      "Batch Number",
      "Product",
      "Buy (₹/kg)",
      "Wastage (%)",
      "Margin (%)",
      "Total (kg)",
      "Expiry Date",
      "Final (₹/g)",
      "100g",
      "250g",
      "500g",
      "750g",
      "1000g",
      "Created At"
    ];

    const rows = filteredRecords.map((r) => {
      const totalKg = r.inputs.total_kg ?? r.inputs.total_purchase_kg ?? "";
      return [
        r.id,
        r.record_date,
        r.inputs.batch_number || "",
        r.inputs.raw_fish_product_name || "",
        r.inputs.buy_price_per_kg ?? "",
        r.inputs.wastage_percent ?? "",
        r.inputs.margin_percent ?? "",
        totalKg,
        r.inputs.expiry_date || "",
        fmt2((r.outputs as any)?.final_sale_price_per_gram),
        fmt2(packetPriceForWeight(r, 100) ?? "-"),
        fmt2(packetPriceForWeight(r, 250) ?? "-"),
        fmt2(packetPriceForWeight(r, 500) ?? "-"),
        fmt2(packetPriceForWeight(r, 750) ?? "-"),
        fmt2(packetPriceForWeight(r, 1000) ?? "-"),
        r.created_at
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `fish_purchase_history_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="card">
      <h2 className="card__title">History</h2>
      <p className="muted">Filter by date and track what was calculated.</p>

      <div className="grid">
        <label className="field">
          <span className="field__label">From date</span>
          <input
            className="input"
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field__label">To date</span>
          <input
            className="input"
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))}
          />
        </label>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <span className="field__label">&nbsp;</span>
          <button className="button" type="button" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Load"}
          </button>
        </div>
      </div>

      {error ? <div className="alert alert--error">{error}</div> : null}

      <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
        <h3 className="sectionTitle" style={{ margin: 0 }}>
          Saved calculations ({filteredRecords.length})
        </h3>
        <div className="row" style={{ marginTop: 0, gap: 8 }}>
          <button
            className="button button--secondary"
            type="button"
            onClick={exportToCSV}
            disabled={filteredRecords.length === 0}
            style={{ padding: "10px 12px", fontSize: 14 }}
          >
            Export CSV
          </button>
          <select
            className="input"
            style={{ width: 110, padding: "10px 12px", fontSize: 14 }}
            value={String(filters.limit)}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                limit: Number(e.target.value) || 50
              }))
            }
            aria-label="Record limit"
            title="Record limit"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>

          <input
            className="input"
            style={{ maxWidth: 260, padding: "10px 12px", fontSize: 14 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search saved calculations"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Batch</th>
              <th>Product</th>
              <th>Buy (₹/kg)</th>
              <th>Wastage (%)</th>
              <th>Margin (%)</th>
              <th>Total (kg)</th>
              <th>Expiry</th>
              <th>Final (₹/g)</th>
              <th>100g</th>
              <th>250g</th>
              <th>500g</th>
              <th>750g</th>
              <th>1000g</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.record_date}</td>
                <td className="mono">{r.inputs.batch_number || "-"}</td>
                <td>{r.inputs.raw_fish_product_name || "-"}</td>
                <td>
                  {edit.id === r.id ? (
                    <input
                      className="input"
                      style={{ padding: "8px 10px", fontSize: 14, width: 140 }}
                      inputMode="decimal"
                      value={edit.buy_price_per_kg}
                      onChange={(e) => setEdit((s) => ({ ...s, buy_price_per_kg: e.target.value }))}
                    />
                  ) : (
                    r.inputs.buy_price_per_kg
                  )}
                </td>
                <td>
                  {edit.id === r.id ? (
                    <input
                      className="input"
                      style={{ padding: "8px 10px", fontSize: 14, width: 120 }}
                      inputMode="decimal"
                      value={edit.wastage_percent}
                      onChange={(e) => setEdit((s) => ({ ...s, wastage_percent: e.target.value }))}
                    />
                  ) : (
                    fmt2(r.inputs.wastage_percent)
                  )}
                </td>
                <td>
                  {edit.id === r.id ? (
                    <input
                      className="input"
                      style={{ padding: "8px 10px", fontSize: 14, width: 120 }}
                      inputMode="decimal"
                      value={edit.margin_percent}
                      onChange={(e) => setEdit((s) => ({ ...s, margin_percent: e.target.value }))}
                    />
                  ) : (
                    r.inputs.margin_percent
                  )}
                </td>
                <td>
                  {edit.id === r.id ? (
                    <input
                      className="input"
                      style={{ padding: "8px 10px", fontSize: 14, width: 120 }}
                      inputMode="decimal"
                      value={r.inputs.total_purchase_kg !== undefined ? edit.total_purchase_kg : edit.total_kg}
                      onChange={(e) => {
                        if (r.inputs.total_purchase_kg !== undefined) {
                          setEdit((s) => ({ ...s, total_purchase_kg: e.target.value }));
                        } else {
                          setEdit((s) => ({ ...s, total_kg: e.target.value }));
                        }
                      }}
                      placeholder="kg"
                    />
                  ) : (
                    fmt2((r.inputs.total_kg ?? r.inputs.total_purchase_kg) ?? "-")
                  )}
                </td>
                <td className="mono">{r.inputs.expiry_date || "-"}</td>
                <td>{fmt2((r.outputs as any)?.final_sale_price_per_gram)}</td>
                <td>{fmt2(packetPriceForWeight(r, 100) ?? "-")}</td>
                <td>{fmt2(packetPriceForWeight(r, 250) ?? "-")}</td>
                <td>{fmt2(packetPriceForWeight(r, 500) ?? "-")}</td>
                <td>{fmt2(packetPriceForWeight(r, 750) ?? "-")}</td>
                <td>{fmt2(packetPriceForWeight(r, 1000) ?? "-")}</td>
                <td>
                  {edit.id === r.id ? (
                    <div style={{ display: "flex", flexDirection: "row", gap: 4, alignItems: "center" }}>
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={saveEdit}
                        disabled={savingId === r.id}
                        style={{ padding: "6px 10px", fontSize: 14, minWidth: "auto", display: "inline-block" }}
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingId === r.id}
                        style={{ padding: "6px 10px", fontSize: 14, minWidth: "auto", display: "inline-block" }}
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "row", gap: 4, alignItems: "center" }}>
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => startEdit(r)}
                        style={{ padding: "6px 10px", fontSize: 14, minWidth: "auto", display: "inline-block" }}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        style={{ padding: "6px 10px", fontSize: 14, minWidth: "auto", display: "inline-block", color: "#dc3545" }}
                        title="Delete"
                      >
                        {deletingId === r.id ? "…" : "🗑"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={15} className="muted">
                  No records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="historyCards">
        {filteredRecords.map((r) => (
          <div className="historyCard" key={r.id}>
            <div className="historyCard__top">
              <div>
                <div className="historyCard__title">{r.inputs.raw_fish_product_name || "Saved calculation"}</div>
                <div className="historyCard__meta mono">
                  {r.record_date}
                </div>
              </div>
              <div className="historyCard__final">₹ {fmt2((r.outputs as any)?.final_sale_price_per_gram)} / g</div>
            </div>

            <div className="historyCard__kv">
              <div className="historyKV">
                <div className="historyKV__label">Batch Number</div>
                <div className="historyKV__value mono">{r.inputs.batch_number || "-"}</div>
              </div>
              <div className="historyKV">
                <div className="historyKV__label">Buy (₹/kg)</div>
                <div className="historyKV__value">{r.inputs.buy_price_per_kg}</div>
              </div>
              <div className="historyKV">
                <div className="historyKV__label">Wastage (%)</div>
                <div className="historyKV__value">{fmt2(r.inputs.wastage_percent)}</div>
              </div>
              <div className="historyKV">
                <div className="historyKV__label">Margin (%)</div>
                <div className="historyKV__value">{r.inputs.margin_percent}</div>
              </div>
              {(r.inputs.total_kg || r.inputs.total_purchase_kg) ? (
                <div className="historyKV">
                  <div className="historyKV__label">Total (kg)</div>
                  <div className="historyKV__value">{fmt2((r.inputs.total_kg ?? r.inputs.total_purchase_kg) ?? "-")}</div>
                </div>
              ) : null}
              {r.inputs.expiry_date ? (
                <div className="historyKV">
                  <div className="historyKV__label">Expiry Date</div>
                  <div className="historyKV__value mono">{r.inputs.expiry_date}</div>
                </div>
              ) : null}
            </div>

            <div className="historyCard__packets">
              <div className="historyCard__subtitle">Packet prices</div>
              <div className="packetGrid">
                {normalizedPacketEntries(r).map(([k, v]) => (
                  <div className="packetPill" key={k}>
                    <span className="mono">{k}</span>
                    <span>₹ {fmt2(v)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "row", gap: 4, alignItems: "center", marginTop: 12 }}>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => startEdit(r)}
                style={{ padding: "6px 10px", fontSize: 14, minWidth: "auto", display: "inline-block" }}
                title="Edit"
              >
                ✎
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => handleDelete(r.id)}
                disabled={deletingId === r.id}
                style={{ padding: "6px 10px", fontSize: 14, minWidth: "auto", display: "inline-block", color: "#dc3545" }}
                title="Delete"
              >
                {deletingId === r.id ? "…" : "🗑"}
              </button>
            </div>
          </div>
        ))}

        {filteredRecords.length === 0 ? <div className="muted">No records found.</div> : null}
      </div>
    </div>
  );
}


