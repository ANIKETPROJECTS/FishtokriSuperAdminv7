import "./_group.css";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Boxes,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  History,
  IndianRupee,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from "lucide-react";

type View = "overview" | "products" | "history" | "adjustment";

const products = [
  { name: "Fresh Rohu Curry Cut", category: "Fresh Fish", unit: "kg", quantity: 42, batches: 3, expiry: "Today, 7:00 PM", price: 480, status: "Available" },
  { name: "Prawns — Medium", category: "Seafood", unit: "kg", quantity: 18, batches: 2, expiry: "Tomorrow, 6:30 PM", price: 720, status: "Available" },
  { name: "Surmai Steaks", category: "Fresh Fish", unit: "kg", quantity: 7, batches: 1, expiry: "26 Aug, 7:00 PM", price: 890, status: "Low stock" },
  { name: "Pomfret Whole", category: "Fresh Fish", unit: "kg", quantity: 0, batches: 0, expiry: "—", price: 1100, status: "Out of stock" },
  { name: "Bombay Duck", category: "Dry Fish", unit: "kg", quantity: 24, batches: 2, expiry: "02 Sep, 6:00 PM", price: 360, status: "Available" },
];

const movements = [
  { date: "23 Aug 2026, 11:42 AM", type: "Order deduction", product: "Fresh Rohu Curry Cut", order: "#FT-10842", batch: "ROHU2308-01", change: -2, balance: 42 },
  { date: "23 Aug 2026, 10:18 AM", type: "Stock adjustment", product: "Prawns — Medium", order: "—", batch: "PRAW2308-02", change: 8, balance: 18 },
  { date: "22 Aug 2026, 7:30 PM", type: "Order restored", product: "Surmai Steaks", order: "#FT-10821", batch: "SURM2208-01", change: 1, balance: 7 },
  { date: "22 Aug 2026, 5:10 PM", type: "Order deduction", product: "Bombay Duck", order: "#FT-10805", batch: "BD2208-02", change: -3, balance: 24 },
];

function formatRupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function StatCard({ label, value, helper, icon: Icon, tone }: { label: string; value: string; helper: string; icon: typeof Package; tone: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#162B4D]">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{helper}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Header({ view, setView }: { view: View; setView: (view: View) => void }) {
  const title = view === "overview" ? "Inventory Management" : view === "products" ? "Inventory" : view === "history" ? "Inventory History" : "Stock Management";
  const description = view === "overview"
    ? "Overall analytics for stock levels, movements, and adjustments across sub-hubs."
    : view === "products" ? "Track current stock, batches, expiry dates, and inventory value."
    : view === "history" ? "Review every stock movement across products and batches."
    : "Add stock, remove stock, and record a clear reason for every adjustment.";

  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-gray-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-400">
          <span>Operations</span><ChevronRight className="h-3 w-3" /><span>Inventory</span>
        </div>
        <h1 className="text-2xl font-bold text-[#162B4D]">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {(["overview", "products", "history", "adjustment"] as View[]).map((item) => (
          <button
            key={item}
            onClick={() => setView(item)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${view === item ? "bg-[#162B4D] text-white" : "bg-white text-gray-500 hover:bg-gray-100"}`}
          >
            {item === "overview" ? "Overview" : item === "products" ? "Inventory" : item === "history" ? "History" : "Stock Management"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Overview({ setView }: { setView: (view: View) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Products" value="128" helper="112 available, across 4 sub-hubs" icon={Package} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Stock Value" value={formatRupees(184650)} helper="326 units in stock" icon={IndianRupee} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Low Stock" value="14" helper="6 out of stock" icon={AlertTriangle} tone="bg-amber-50 text-amber-600" />
        <StatCard label="Movements (30d)" value="486" helper="38 adjustments • 2,194 all-time" icon={TrendingUp} tone="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Inventory", copy: "128 products tracked across sub-hubs.", icon: Boxes, target: "products" as View },
          { label: "History", copy: "2,194 stock movements recorded.", icon: History, target: "history" as View },
          { label: "Stock Management", copy: "38 adjustments logged this month.", icon: SlidersHorizontal, target: "adjustment" as View },
        ].map(({ label, copy, icon: Icon, target }) => (
          <button key={label} onClick={() => setView(target)} className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-blue-100 hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#162B4D]/10 text-[#162B4D]"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm text-[#162B4D]">{label}</strong><small className="mt-0.5 block text-xs text-gray-500">{copy}</small></span>
            <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-1 group-hover:text-[#1A56DB]" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_420px]">
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div><h2 className="font-bold text-[#162B4D]">Stock Value by Sub-hub</h2><p className="mt-0.5 text-xs text-gray-400">Top sub-hubs by current stock valuation.</p></div>
            <Layers className="h-4 w-4 text-gray-300" />
          </div>
          <div className="space-y-5 p-5">
            {[["Mumbai Central", 78, "₹96,420"], ["Thane West", 61, "₹54,180"], ["Navi Mumbai", 42, "₹34,050"]].map(([name, percent, value]) => (
              <div key={name}><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-gray-700">{name}</span><span className="font-bold text-[#162B4D]">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#1A56DB]" style={{ width: `${percent}%` }} /></div></div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-bold text-[#162B4D]">Low Stock Alerts</h2><p className="mt-0.5 text-xs text-gray-400">Products that need attention.</p></div><AlertTriangle className="h-4 w-4 text-amber-500" /></div>
          <div className="divide-y divide-gray-100">{products.filter((p) => p.quantity < 20).slice(0, 3).map((product) => <button key={product.name} onClick={() => setView("products")} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${product.quantity === 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}><Package className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-gray-700">{product.name}</strong><small className="text-xs text-gray-400">{product.quantity} {product.unit} remaining</small></span><ArrowRight className="h-4 w-4 text-gray-300" /></button>)}</div>
        </div>
      </div>
    </div>
  );
}

function Products() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || p.status.toLowerCase().replaceAll(" ", "-") === filter)), [search, filter]);
  const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><StatCard label="Products" value={`${filtered.length}`} helper="Showing current view" icon={Package} tone="bg-blue-50 text-blue-500" /><StatCard label="Stock Value" value={formatRupees(totalValue)} helper="Current inventory" icon={Boxes} tone="bg-emerald-50 text-emerald-500" /><StatCard label="Low Stock" value="14" helper="Below threshold" icon={AlertTriangle} tone="bg-amber-50 text-amber-500" /><StatCard label="Out of Stock" value="6" helper="Needs restock" icon={X} tone="bg-red-50 text-red-500" /><StatCard label="Expiring ≤ 7d" value="9" helper="Check batches" icon={Clock3} tone="bg-orange-50 text-orange-500" /></div>
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400" /></div><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none"><option value="all">All products</option><option value="available">Available</option><option value="low-stock">Low stock</option><option value="out-of-stock">Out of stock</option></select><button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="inventory-scrollbar overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Product</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Category</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Stock</th><th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Batches</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Next expiry</th><th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Value</th><th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th></tr></thead><tbody className="divide-y divide-gray-100">{filtered.map((p) => <tr key={p.name} className="group hover:bg-blue-50/30"><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Package className="h-4 w-4" /></span><span><strong className="block font-semibold text-[#162B4D]">{p.name}</strong><small className="text-xs text-gray-400">{p.unit}</small></span></div></td><td className="px-4 py-4 text-gray-600">{p.category}</td><td className={`px-4 py-4 text-right font-bold ${p.quantity === 0 ? "text-red-600" : p.quantity < 10 ? "text-amber-600" : "text-[#162B4D]"}`}>{p.quantity} <span className="text-xs font-normal text-gray-400">{p.unit}</span></td><td className="px-4 py-4 text-center text-gray-600">{p.batches}</td><td className="px-4 py-4 text-gray-600">{p.expiry}</td><td className="px-4 py-4 text-right font-semibold text-gray-600">{formatRupees(p.price * p.quantity)}</td><td className="px-4 py-4 text-center"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${p.status === "Available" ? "bg-emerald-50 text-emerald-700" : p.status === "Low stock" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{p.status}</span></td></tr>)}</tbody></table></div></div>
    </div>
  );
}

function HistoryView() {
  const [search, setSearch] = useState("");
  const visible = movements.filter((m) => `${m.product} ${m.order} ${m.type}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="space-y-5"><div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product, order, or reason..." className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400" /></div><select className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600"><option>All movements</option><option>Order deductions</option><option>Order restores</option><option>Manual adjustments</option></select></div><div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"><div className="inventory-scrollbar overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b border-gray-100 bg-gray-50">{["When", "Type", "Product", "Order", "Batch", "Change", "Balance"].map((h) => <th key={h} className={`px-4 py-3 text-${h === "Change" || h === "Balance" ? "right" : "left"} text-xs font-semibold uppercase tracking-wider text-gray-500`}>{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{visible.map((m) => <tr key={`${m.date}-${m.product}`} className="hover:bg-gray-50"><td className="px-4 py-4 text-gray-500">{m.date}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${m.change > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{m.change > 0 ? <ArrowUpCircle className="h-3.5 w-3.5" /> : <ArrowDownCircle className="h-3.5 w-3.5" />}{m.type}</span></td><td className="px-4 py-4 font-semibold text-[#162B4D]">{m.product}</td><td className="px-4 py-4 text-gray-600">{m.order}</td><td className="px-4 py-4 font-mono text-xs text-gray-500">{m.batch}</td><td className={`px-4 py-4 text-right font-bold ${m.change > 0 ? "text-emerald-600" : "text-red-600"}`}>{m.change > 0 ? "+" : ""}{m.change}</td><td className="px-4 py-4 text-right font-semibold text-gray-700">{m.balance}</td></tr>)}</tbody></table></div></div></div>;
}

function Adjustment() {
  const [rows, setRows] = useState([{ product: "Fresh Rohu Curry Cut", mode: "Add stock", quantity: "12", batch: "ROHU2308-03" }]);
  return <div className="space-y-5"><div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-bold text-[#162B4D]">Adjustment Details</h2><p className="mt-1 text-xs text-gray-400">Every adjustment is recorded in stock history.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Draft</span></div><div className="grid grid-cols-1 gap-4 md:grid-cols-4"><label className="space-y-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Date<input type="date" defaultValue="2026-08-23" className="mt-1.5 h-9 w-full rounded-lg border border-gray-200 px-3 text-sm font-medium normal-case tracking-normal text-[#162B4D]" /></label><label className="space-y-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">Reason <span className="text-red-500">*</span><input defaultValue="New stock received" className="mt-1.5 h-9 w-full rounded-lg border border-gray-200 px-3 text-sm font-medium normal-case tracking-normal text-[#162B4D]" /></label><label className="space-y-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 md:col-span-2">Notes<input placeholder="Write notes here..." className="mt-1.5 h-9 w-full rounded-lg border border-gray-200 px-3 text-sm normal-case tracking-normal text-gray-600" /></label></div></div><div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold text-[#162B4D]">Products</h2><p className="mt-1 text-xs text-gray-400">{rows.length} product selected</p></div><button onClick={() => setRows([...rows, { product: "", mode: "Add stock", quantity: "", batch: "" }])} className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Plus className="h-3.5 w-3.5" /> Add product</button></div><div className="space-y-3">{rows.map((row, index) => <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-end"><label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Product<select value={row.product} onChange={(e) => setRows(rows.map((r, i) => i === index ? { ...r, product: e.target.value } : r))} className="mt-1.5 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm font-medium normal-case tracking-normal text-[#162B4D]"><option value="">Select product</option>{products.map((p) => <option key={p.name}>{p.name}</option>)}</select></label><label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Action<select className="mt-1.5 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm font-medium normal-case tracking-normal text-[#162B4D]"><option>Add stock</option><option>Remove stock</option></select></label><label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Quantity<input defaultValue={row.quantity} type="number" className="mt-1.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm font-medium normal-case tracking-normal text-[#162B4D]" /></label><label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Batch number<input defaultValue={row.batch} placeholder="Auto-generated" className="mt-1.5 h-9 w-full rounded-lg border border-gray-200 px-2 text-sm normal-case tracking-normal text-[#162B4D]" /></label><button onClick={() => setRows(rows.filter((_, i) => i !== index))} className="flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-gray-400 hover:text-red-600"><X className="h-4 w-4" /></button></div>)}</div><div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4"><button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">Cancel</button><button className="flex items-center gap-2 rounded-lg bg-[#1A56DB] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Check className="h-4 w-4" /> Save adjustment</button></div></div></div>;
}

export function InventoryModule() {
  const initialView = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("view") as View | null
    : null;
  const [view, setView] = useState<View>(initialView && ["overview", "products", "history", "adjustment"].includes(initialView) ? initialView : "overview");
  return <div className="min-h-screen bg-[#F4F6FA] p-4 text-[#162B4D] sm:p-6 lg:p-8"><div className="mx-auto max-w-[1440px]"><Header view={view} setView={setView} />{view === "overview" && <Overview setView={setView} />}{view === "products" && <Products />}{view === "history" && <HistoryView />}{view === "adjustment" && <Adjustment />}</div></div>;
}

export default InventoryModule;