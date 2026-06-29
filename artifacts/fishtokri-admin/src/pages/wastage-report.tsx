import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Download, Search, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown,
  ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const POPPINS = { fontFamily: "Poppins, sans-serif" };
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function getToken() { return localStorage.getItem("fishtokri_token") || ""; }
function getAdmin() {
  try { return JSON.parse(localStorage.getItem("fishtokri_admin") || "null"); } catch { return null; }
}
async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`Request failed: ${path}`);
  return res.json();
}

function today() { return new Date().toISOString().slice(0, 10); }
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}
function fmtRupees(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function isoToMs(iso: string | null) {
  if (!iso) return 0;
  return new Date(iso).getTime() || 0;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type SortKey = "operationDate" | "item" | "expiryDate" | "quantity" | "totalPrice" | "dateAdded";
type SortDir = "asc" | "desc";

// ── TypeBadge ─────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const isExpired = type === "expired";
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.03em",
      background: isExpired ? "#fef2f2" : "#fff7ed",
      color: isExpired ? "#dc2626" : "#c2410c",
      border: `1px solid ${isExpired ? "#fecaca" : "#fed7aa"}`,
    }}>
      {isExpired ? "Expired" : "Reduced"}
    </span>
  );
}

// ── SortIcon ──────────────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown style={{ width: 11, height: 11, opacity: 0.4, flexShrink: 0 }} />;
  return sortDir === "asc"
    ? <ArrowUp style={{ width: 11, height: 11, color: "#F05B4E", flexShrink: 0 }} />
    : <ArrowDown style={{ width: 11, height: 11, color: "#F05B4E", flexShrink: 0 }} />;
}

// ── Pagination bar ────────────────────────────────────────────────────────────
function PaginationBar({
  total, pageSize, currentPage, onPageChange, onPageSizeChange,
}: {
  total: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  // Build page number list with ellipsis
  const pages: (number | "…")[] = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const result: (number | "…")[] = [1];
    if (currentPage > 3) result.push("…");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      result.push(i);
    }
    if (currentPage < totalPages - 2) result.push("…");
    result.push(totalPages);
    return result;
  }, [totalPages, currentPage]);

  const btnBase: React.CSSProperties = {
    minWidth: 30, height: 30, padding: "0 6px",
    border: "1px solid #e5e7eb", borderRadius: 7,
    background: "#fff", cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 500, color: "#374151",
    fontFamily: "Poppins, sans-serif", transition: "all 0.15s",
    flexShrink: 0,
  };
  const btnActive: React.CSSProperties = {
    ...btnBase,
    background: "#162B4D", borderColor: "#162B4D", color: "#fff", fontWeight: 700,
  };
  const btnDisabled: React.CSSProperties = {
    ...btnBase, opacity: 0.35, cursor: "not-allowed", pointerEvents: "none",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "14px 16px",
      borderTop: "1px solid #f0f0f0", flexWrap: "wrap", ...POPPINS,
    }}>
      {/* Rows per page */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 6 }}>
        <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>Rows per page</span>
        <div style={{ position: "relative" }}>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            style={{
              height: 30, border: "1px solid #e5e7eb", borderRadius: 7,
              fontSize: 12, fontFamily: "Poppins, sans-serif", color: "#374151",
              background: "#fff", padding: "0 22px 0 8px", appearance: "none", cursor: "pointer",
            }}
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, color: "#888", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Showing X–Y of Z */}
      <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap", marginRight: "auto" }}>
        {total === 0 ? "No records" : `Showing ${from}–${to} of ${total}`}
      </span>

      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          style={currentPage === 1 ? btnDisabled : btnBase}
          title="First page"
        >
          <ChevronsLeft style={{ width: 13, height: 13 }} />
        </button>
        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          style={currentPage === 1 ? btnDisabled : btnBase}
          title="Previous page"
        >
          <ChevronLeft style={{ width: 13, height: 13 }} />
        </button>

        {/* Page numbers */}
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} style={{ minWidth: 30, textAlign: "center", fontSize: 12, color: "#bbb" }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              style={p === currentPage ? btnActive : btnBase}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          style={currentPage === totalPages ? btnDisabled : btnBase}
          title="Next page"
        >
          <ChevronRight style={{ width: 13, height: 13 }} />
        </button>
        {/* Last */}
        <button
          onClick={() => onPageChange(totalPages)}
          style={currentPage === totalPages ? btnDisabled : btnBase}
          title="Last page"
        >
          <ChevronsRight style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WastageReportPage() {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expired" | "reduced">("all");
  const [sortKey, setSortKey] = useState<SortKey>("operationDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedSubHubId, setSelectedSubHubId] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const admin = getAdmin();
  const isMaster = admin?.role === "master_admin";
  const isSuperHub = admin?.role === "super_hub";
  const isSubHub = admin?.role === "sub_hub";

  const { data: subHubsData } = useQuery({
    queryKey: ["sub-hubs-for-wastage"],
    queryFn: () => apiFetch("/api/sub-hubs"),
    enabled: isMaster || isSuperHub,
  });
  const subHubs: any[] = subHubsData?.subHubs ?? subHubsData?.data ?? [];

  const activeSubHubId = useMemo(() => {
    if (isSubHub) return admin?.subHubIds?.[0] || admin?.subHubId || "";
    if (selectedSubHubId) return selectedSubHubId;
    return subHubs[0]?._id || subHubs[0]?.id || "";
  }, [isSubHub, admin, selectedSubHubId, subHubs]);

  const activeSubHubName = useMemo(() => {
    if (isSubHub) return admin?.subHubName || "";
    const found = subHubs.find((s: any) => (s._id || s.id) === activeSubHubId);
    return found?.name || "";
  }, [isSubHub, admin, activeSubHubId, subHubs]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["wastage-report", activeSubHubId, from, to],
    queryFn: () => {
      const p = new URLSearchParams({ subHubId: activeSubHubId, from, to });
      return apiFetch(`/api/reports/wastage?${p}`);
    },
    enabled: !!activeSubHubId,
  });

  const records: any[] = data?.records ?? [];

  // ── Reset to page 1 whenever filters / sort / source data change ───────────
  useEffect(() => { setCurrentPage(1); }, [search, typeFilter, sortKey, sortDir, activeSubHubId, from, to]);

  // ── Column sort handler ────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // ── Filtered + sorted list (all rows — used for Excel export & totals) ─────
  const displayRows = useMemo(() => {
    let list = [...records];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.item || "").toLowerCase().includes(q) ||
        (r.batchId || "").toLowerCase().includes(q) ||
        (r.reason || "").toLowerCase().includes(q) ||
        (r.type || "").toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") list = list.filter(r => r.type === typeFilter);
    list.sort((a, b) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "item":       va = (a.item || "").toLowerCase();   vb = (b.item || "").toLowerCase(); break;
        case "quantity":   va = a.quantity ?? 0;                vb = b.quantity ?? 0; break;
        case "totalPrice": va = a.totalPrice ?? 0;              vb = b.totalPrice ?? 0; break;
        case "expiryDate": va = isoToMs(a.expiryDate);          vb = isoToMs(b.expiryDate); break;
        case "dateAdded":  va = isoToMs(a.dateAdded);           vb = isoToMs(b.dateAdded); break;
        default:           va = isoToMs(a.operationDate);       vb = isoToMs(b.operationDate); break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [records, search, typeFilter, sortKey, sortDir]);

  // ── Current page slice (what the table actually renders) ──────────────────
  const pagedRows = useMemo(
    () => displayRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [displayRows, currentPage, pageSize],
  );

  // ── Summary stats (always from full unfiltered records) ───────────────────
  const stats = useMemo(() => {
    const expired = records.filter(r => r.type === "expired");
    const reduced = records.filter(r => r.type === "reduced");
    return {
      total: records.length,
      expired: expired.length,
      reduced: reduced.length,
      totalValue: records.reduce((s, r) => s + (r.totalPrice || 0), 0),
      expiredValue: expired.reduce((s, r) => s + (r.totalPrice || 0), 0),
      reducedValue: reduced.reduce((s, r) => s + (r.totalPrice || 0), 0),
    };
  }, [records]);

  // Totals across ALL filtered rows (not just current page)
  const filteredTotal = useMemo(() => ({
    qty: displayRows.reduce((s, r) => s + (r.quantity || 0), 0),
    value: displayRows.reduce((s, r) => s + (r.totalPrice || 0), 0),
  }), [displayRows]);

  // ── Excel Export (exports ALL filtered rows, ignores pagination) ──────────
  const handleDownload = useCallback(() => {
    if (!displayRows.length) return;
    const wb = XLSX.utils.book_new();

    // Sheet 1: Data
    const dataRows: any[][] = [];
    dataRows.push([`Wastage Report — ${activeSubHubName || "All Sub Hubs"}`]);
    dataRows.push([`Period: ${fmtDate(from)} to ${fmtDate(to)}`]);
    dataRows.push([`Generated: ${fmtDateTime(new Date().toISOString())}`]);
    dataRows.push([`Type filter: ${typeFilter === "all" ? "All" : typeFilter === "expired" ? "Expired only" : "Reduced only"}`]);
    dataRows.push([]);
    dataRows.push([
      "Batch Name", "Date Added", "Expiry Date", "Item", "Unit",
      "Type", "Quantity", "Total Price (₹)", "Reason / Notes", "Date of Operation",
    ]);
    for (const r of displayRows) {
      dataRows.push([
        r.batchId || "—",
        r.dateAdded || "—",
        r.expiryDate || "—",
        r.item || "—",
        r.unit || "",
        r.type === "expired" ? "Expired" : "Reduced",
        Number(r.quantity) || 0,
        Number(r.totalPrice) || 0,
        [r.reason, r.notes].filter(Boolean).join(" | ") || "—",
        r.operationDate ? fmtDateTime(r.operationDate) : "—",
      ]);
    }
    dataRows.push([]);
    dataRows.push(["TOTAL", "", "", "", "", `${displayRows.length} records`, filteredTotal.qty, filteredTotal.value, "", ""]);

    const ws1 = XLSX.utils.aoa_to_sheet(dataRows);
    ws1["!cols"] = [
      { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 8 },
      { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 26 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Wastage Data");

    // Sheet 2: Summary
    const summaryRows: any[][] = [
      [`Wastage Report Summary`],
      [`Sub Hub: ${activeSubHubName || "All"}`],
      [`Period: ${fmtDate(from)} to ${fmtDate(to)}`],
      [],
      ["Metric", "Count", "Value (₹)"],
      ["Total Wastage Records", stats.total, stats.totalValue],
      ["Expired Items", stats.expired, stats.expiredValue],
      ["Reduced Items", stats.reduced, stats.reducedValue],
      [],
      ["--- Filtered / Exported ---"],
      ["Filtered Records", displayRows.length, filteredTotal.value],
      ["Filtered Qty (units)", "", filteredTotal.qty],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws2["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Summary");

    XLSX.writeFile(wb, `wastage-report-${from}-to-${to}.xlsx`);
  }, [displayRows, stats, filteredTotal, from, to, typeFilter, activeSubHubName]);

  // ── Shared input style ─────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 8px",
    fontSize: 12, fontFamily: "Poppins, sans-serif", color: "#000",
    background: "#fff", height: 30,
  };

  const thStyle = (key: SortKey, align: "left" | "right" = "left"): React.CSSProperties => ({
    padding: "11px 14px", textAlign: align, fontSize: 11,
    fontWeight: 700, color: "#fff", whiteSpace: "nowrap", letterSpacing: "0.04em",
    cursor: "pointer", userSelect: "none",
    background: sortKey === key ? "#1a3560" : "transparent",
    transition: "background 0.15s",
  });

  // ── Header portal ──────────────────────────────────────────────────────────
  const headerSlot = document.getElementById("page-header-slot");

  const headerContent = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", ...POPPINS }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <Trash2 style={{ width: 16, height: 16, color: "#F05B4E" }} />
        <h1 style={{ fontSize: 15, fontWeight: 700, color: "#000", margin: 0, whiteSpace: "nowrap" }}>
          Wastage Report
        </h1>
      </div>
      <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0 }} />

      {/* Sub-hub selector */}
      {(isMaster || isSuperHub) && subHubs.length > 1 && (
        <>
          <select
            value={selectedSubHubId || activeSubHubId}
            onChange={e => setSelectedSubHubId(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          >
            {subHubs.map((s: any) => (
              <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
            ))}
          </select>
          <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0 }} />
        </>
      )}

      {/* Date range */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <label style={{ fontSize: 11, fontWeight: 500, color: "#888", whiteSpace: "nowrap" }}>From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        <label style={{ fontSize: 11, fontWeight: 500, color: "#888", whiteSpace: "nowrap" }}>To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ flex: 1 }} />

      {/* Type filter pills */}
      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 9, padding: 3, gap: 2, flexShrink: 0 }}>
        {(["all", "expired", "reduced"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            style={{
              padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, ...POPPINS,
              background: typeFilter === t ? "#fff" : "transparent",
              color: typeFilter === t ? "#F05B4E" : "#666",
              boxShadow: typeFilter === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {t === "all" ? "All" : t === "expired" ? "Expired" : "Reduced"}
          </button>
        ))}
      </div>

      {/* Export */}
      <button
        onClick={handleDownload}
        title="Export all filtered rows to Excel"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          height: 34, padding: "0 12px", borderRadius: 9,
          border: "1px solid #e5e7eb", background: "#fff",
          cursor: "pointer", color: "#15803d",
          fontSize: 12, fontWeight: 600, ...POPPINS,
          transition: "all 0.15s", flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f0fdf4"; (e.currentTarget as HTMLElement).style.borderColor = "#86efac"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; }}
      >
        <Download style={{ width: 14, height: 14 }} />
        Export Excel
      </button>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {headerSlot && createPortal(headerContent, headerSlot)}

      <div style={{ padding: "24px 28px", background: "#fff", minHeight: "100vh", ...POPPINS }}>

        {/* Stats strip */}
        {records.length > 0 && (
          <div style={{ display: "flex", borderRadius: 14, border: "1px solid #ebebeb", marginBottom: 20, overflow: "hidden" }}>
            {[
              { label: "Total Records",      value: String(stats.total),              color: "#000" },
              { label: "Expired Items",       value: String(stats.expired),            color: "#dc2626" },
              { label: "Reduced Items",       value: String(stats.reduced),            color: "#c2410c" },
              { label: "Expired Value",       value: fmtRupees(stats.expiredValue),    color: "#dc2626" },
              { label: "Reduced Value",       value: fmtRupees(stats.reducedValue),    color: "#c2410c" },
              { label: "Total Wastage Value", value: fmtRupees(stats.totalValue),      color: "#000" },
            ].map((s, i, arr) => (
              <div key={s.label} style={{ flex: 1, padding: "14px 18px", borderRight: i < arr.length - 1 ? "1px solid #ebebeb" : "none" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 17, fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* States */}
        {!activeSubHubId && <div style={{ textAlign: "center", padding: "80px 0", color: "#aaa", fontSize: 14 }}>No sub hub linked to your account.</div>}
        {activeSubHubId && isLoading && <div style={{ textAlign: "center", padding: "80px 0", color: "#aaa", fontSize: 14 }}>Loading wastage data…</div>}
        {activeSubHubId && isError && <div style={{ textAlign: "center", padding: "80px 0", color: "#ef4444", fontSize: 14 }}>Failed to load. Please try again.</div>}

        {activeSubHubId && !isLoading && !isError && (
          <>
            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#aaa", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search item, batch name, reason…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 28, paddingRight: 10, width: 260, height: 32 }}
                />
              </div>

              {/* Sort dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#888", whiteSpace: "nowrap" }}>Sort by</label>
                <div style={{ position: "relative" }}>
                  <select
                    value={`${sortKey}:${sortDir}`}
                    onChange={e => {
                      const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
                      setSortKey(k); setSortDir(d);
                    }}
                    style={{ ...inputStyle, height: 32, paddingRight: 28, appearance: "none", width: 220 }}
                  >
                    <option value="operationDate:desc">Operation Date — Newest first</option>
                    <option value="operationDate:asc">Operation Date — Oldest first</option>
                    <option value="expiryDate:desc">Expiry Date — Newest first</option>
                    <option value="expiryDate:asc">Expiry Date — Oldest first</option>
                    <option value="dateAdded:desc">Date Added — Newest first</option>
                    <option value="dateAdded:asc">Date Added — Oldest first</option>
                    <option value="item:asc">Item — A → Z</option>
                    <option value="item:desc">Item — Z → A</option>
                    <option value="quantity:desc">Quantity — High to Low</option>
                    <option value="quantity:asc">Quantity — Low to High</option>
                    <option value="totalPrice:desc">Total Price — High to Low</option>
                    <option value="totalPrice:asc">Total Price — Low to High</option>
                  </select>
                  <ChevronDown style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#888", pointerEvents: "none" }} />
                </div>
              </div>

              {/* Count (right-aligned) */}
              <span style={{ fontSize: 12, color: "#888", marginLeft: "auto" }}>
                {displayRows.length !== records.length
                  ? `${displayRows.length} of ${records.length} records`
                  : `${records.length} record${records.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {/* ── Table ───────────────────────────────────────────────── */}
            {records.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#aaa", fontSize: 14 }}>No wastage records found for this period.</div>
            ) : displayRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#aaa", fontSize: 14 }}>No records match your search / filter.</div>
            ) : (
              <div style={{ borderRadius: 12, border: "1px solid #ebebeb", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#162B4D" }}>
                        {/* Batch Name */}
                        <th style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                          Batch Name
                        </th>
                        {/* Date Added */}
                        <th onClick={() => handleSort("dateAdded")} style={thStyle("dateAdded")}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            Date Added <SortIcon col="dateAdded" sortKey={sortKey} sortDir={sortDir} />
                          </span>
                        </th>
                        {/* Expiry Date */}
                        <th onClick={() => handleSort("expiryDate")} style={thStyle("expiryDate")}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            Expiry Date <SortIcon col="expiryDate" sortKey={sortKey} sortDir={sortDir} />
                          </span>
                        </th>
                        {/* Item */}
                        <th onClick={() => handleSort("item")} style={thStyle("item")}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            Item <SortIcon col="item" sortKey={sortKey} sortDir={sortDir} />
                          </span>
                        </th>
                        {/* Type */}
                        <th style={{ padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                          Type
                        </th>
                        {/* Quantity */}
                        <th onClick={() => handleSort("quantity")} style={thStyle("quantity", "right")}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            <SortIcon col="quantity" sortKey={sortKey} sortDir={sortDir} /> Qty
                          </span>
                        </th>
                        {/* Total Price */}
                        <th onClick={() => handleSort("totalPrice")} style={thStyle("totalPrice", "right")}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            <SortIcon col="totalPrice" sortKey={sortKey} sortDir={sortDir} /> Total Price
                          </span>
                        </th>
                        {/* Date of Operation */}
                        <th onClick={() => handleSort("operationDate")} style={thStyle("operationDate", "right")}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                            <SortIcon col="operationDate" sortKey={sortKey} sortDir={sortDir} /> Date of Operation
                          </span>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {pagedRows.map((r, idx) => {
                        const globalIdx = (currentPage - 1) * pageSize + idx;
                        return (
                          <tr
                            key={r.id || globalIdx}
                            style={{ background: globalIdx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0", transition: "background 0.1s" }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f5f3ff"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = globalIdx % 2 === 0 ? "#fff" : "#fafafa"}
                          >
                            <td style={{ padding: "10px 14px", color: "#374151", fontWeight: 500, fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
                              {r.batchId || "—"}
                            </td>
                            <td style={{ padding: "10px 14px", color: "#555", whiteSpace: "nowrap", fontSize: 12 }}>
                              {fmtDate(r.dateAdded)}
                            </td>
                            <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                              {r.expiryDate
                                ? <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 12 }}>{fmtDate(r.expiryDate)}</span>
                                : <span style={{ color: "#bbb" }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "#111", maxWidth: 220 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                                <span>{r.item}</span>
                                {r.unit && <span style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>{r.unit}</span>}
                              </div>
                              {(r.reason || r.notes) && (
                                <div style={{ fontSize: 11, color: "#999", fontWeight: 400, marginTop: 2 }}>
                                  {[r.reason, r.notes].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <TypeBadge type={r.type} />
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#dc2626", fontSize: 14 }}>
                              {(r.quantity ?? 0).toLocaleString("en-IN")}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "#111", whiteSpace: "nowrap" }}>
                              {r.totalPrice > 0 ? fmtRupees(r.totalPrice) : <span style={{ color: "#bbb" }}>—</span>}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", color: "#555", whiteSpace: "nowrap", fontSize: 11 }}>
                              {fmtDateTime(r.operationDate)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Summary footer — totals across ALL filtered rows */}
                    <tfoot>
                      <tr style={{ background: "#162B4D", borderTop: "2px solid #364F9F" }}>
                        <td colSpan={5} style={{ padding: "12px 14px", fontWeight: 700, color: "#fff", fontSize: 13 }}>
                          {displayRows.length < records.length
                            ? `FILTERED TOTAL — ${displayRows.length} of ${records.length} records`
                            : `TOTAL — ${records.length} record${records.length !== 1 ? "s" : ""}`}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#fff", fontSize: 16 }}>
                          {filteredTotal.qty.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 800, color: "#fff", fontSize: 15, whiteSpace: "nowrap" }}>
                          {fmtRupees(filteredTotal.value)}
                        </td>
                        <td style={{ padding: "12px 14px" }} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* ── Pagination bar ───────────────────────────────────── */}
                <PaginationBar
                  total={displayRows.length}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={s => { setPageSize(s); setCurrentPage(1); }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
