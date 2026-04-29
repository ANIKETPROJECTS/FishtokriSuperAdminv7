import { Fragment, useEffect, useMemo, useState } from "react";
import { Building2, Search, Boxes, Package, AlertTriangle, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";
import { getCurrentAdminScope } from "@/lib/api";

function getToken() {
  return localStorage.getItem("fishtokri_token") ?? "";
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data;
}

type SuperHub = { id: string; name: string; location?: string };
type SubHub = { id: string; name: string; location?: string };
type Batch = {
  id: string;
  batchNumber: string;
  quantity: number;
  shelfLifeDays: number | null;
  receivedDate: string | null;
  expiryDate: string | null;
  notes: string;
};
type Product = {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  unit: string;
  price: number;
  quantity: number;
  status: string;
  imageUrl: string;
  batches?: Batch[];
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}
function daysUntil(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export default function InventoryPage() {
  const { toast } = useToast();
  const [superHubs, setSuperHubs] = useState<SuperHub[]>([]);
  const [subHubs, setSubHubs] = useState<SubHub[]>([]);
  const [selectedSuperHubId, setSelectedSuperHubId] = useState("");
  const [selectedSubHubId, setSelectedSubHubId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  function toggleExpanded(id: string) { setExpanded((m) => ({ ...m, [id]: !m[id] })); }

  useEffect(() => {
    apiFetch("/api/super-hubs")
      .then((d) => setSuperHubs(d.superHubs ?? []))
      .catch((err) => toast({ title: "Failed to load super hubs", description: err.message, variant: "destructive" }));
  }, [toast]);

  // Auto-select hub for super_hub users when only one option is available.
  const adminScope = useMemo(() => getCurrentAdminScope(), []);
  useEffect(() => {
    if (selectedSuperHubId) return;
    if (adminScope.role !== "super_hub") return;
    if (superHubs.length !== 1) return;
    setSelectedSuperHubId(superHubs[0].id);
  }, [superHubs, selectedSuperHubId, adminScope]);
  useEffect(() => {
    if (selectedSubHubId) return;
    if (adminScope.role !== "super_hub") return;
    if (subHubs.length !== 1) return;
    setSelectedSubHubId(subHubs[0].id);
  }, [subHubs, selectedSubHubId, adminScope]);

  useEffect(() => {
    if (!selectedSuperHubId) { setSubHubs([]); setSelectedSubHubId(""); return; }
    apiFetch(`/api/super-hubs/${selectedSuperHubId}/sub-hubs`)
      .then((d) => setSubHubs(d.subHubs ?? []))
      .catch((err) => toast({ title: "Failed to load sub hubs", description: err.message, variant: "destructive" }));
    setSelectedSubHubId("");
  }, [selectedSuperHubId, toast]);

  useEffect(() => {
    if (!selectedSubHubId) { setProducts([]); return; }
    setLoadingProducts(true);
    apiFetch(`/api/inventory/products?subHubId=${selectedSubHubId}`)
      .then((d) => setProducts(d.products ?? []))
      .catch((err) => toast({ title: "Failed to load products", description: err.message, variant: "destructive" }))
      .finally(() => setLoadingProducts(false));
  }, [selectedSubHubId, toast]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.subCategory.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter]);

  const pagedProducts = usePaginated(filtered, 20, `${search}|${categoryFilter}`);

  const totalValue = filtered.reduce((s, p) => s + p.price * p.quantity, 0);
  const lowStock = filtered.filter((p) => p.quantity > 0 && p.quantity < 5).length;
  const outOfStock = filtered.filter((p) => p.quantity <= 0).length;
  const expiringCount = filtered.reduce((c, p) => {
    return c + (p.batches ?? []).filter((b) => {
      const dl = daysUntil(b.expiryDate);
      return b.quantity > 0 && dl != null && dl <= 7;
    }).length;
  }, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#162B4D]">Inventory</h1>
        <p className="text-sm text-gray-500">Live stock levels for products in a sub-hub.</p>
      </div>

      {/* Hub picker */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Super Hub</Label>
            <Select value={selectedSuperHubId} onValueChange={setSelectedSuperHubId}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select super hub" /></SelectTrigger>
              <SelectContent>
                {superHubs.length === 0 ? (
                  <div className="p-2 text-xs text-gray-400 text-center">No super hubs</div>
                ) : superHubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      {h.name}{h.location && <span className="text-[10px] text-gray-400">· {h.location}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub Hub</Label>
            <Select value={selectedSubHubId} onValueChange={setSelectedSubHubId} disabled={!selectedSuperHubId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={!selectedSuperHubId ? "Select super hub first" : subHubs.length === 0 ? "No sub-hubs" : "Select sub hub"} />
              </SelectTrigger>
              <SelectContent>
                {subHubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      {h.name}{h.location && <span className="text-[10px] text-gray-400">· {h.location}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedSubHubId ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 flex items-center justify-center">
            <Boxes className="w-5 h-5 text-[#1A56DB]" />
          </div>
          <p className="text-sm font-semibold text-[#162B4D]">Select a super hub and sub hub to view inventory</p>
          <p className="text-xs text-gray-400 mt-1">Stock is tracked per sub-hub catalog.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Products" value={filtered.length} icon={<Package className="w-4 h-4 text-blue-500" />} />
            <StatCard label="Stock Value" value={`₹${totalValue.toFixed(0)}`} icon={<Boxes className="w-4 h-4 text-emerald-500" />} />
            <StatCard label="Low Stock (<5)" value={lowStock} icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} accent={lowStock > 0 ? "amber" : "default"} />
            <StatCard label="Out of Stock" value={outOfStock} icon={<AlertTriangle className="w-4 h-4 text-red-500" />} accent={outOfStock > 0 ? "red" : "default"} />
            <StatCard label="Expiring ≤ 7d" value={expiringCount} icon={<Clock className="w-4 h-4 text-orange-500" />} accent={expiringCount > 0 ? "amber" : "default"} />
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or category..."
                className="pl-9 h-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-10 w-full sm:w-56"><SelectValue placeholder="All categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Product list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-2 py-3 w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Batches</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Next Expiry</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Value</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingProducts ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">No products found</td></tr>
                  ) : pagedProducts.pageItems.map((p) => {
                    const stockTone =
                      p.quantity <= 0 ? "bg-red-50 text-red-700"
                      : p.quantity < 5 ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700";
                    const batches = p.batches ?? [];
                    const nextBatch = batches.find((b) => b.quantity > 0 && b.expiryDate);
                    const dl = nextBatch ? daysUntil(nextBatch.expiryDate) : null;
                    const expTone = dl == null ? "text-gray-400"
                      : dl < 0 ? "text-red-600"
                      : dl <= 7 ? "text-amber-600"
                      : "text-emerald-600";
                    const isOpen = !!expanded[p.id];
                    return (
                      <Fragment key={p.id}>
                        <tr className="hover:bg-gray-50/40">
                          <td className="px-2 py-3 text-center">
                            {batches.length > 0 && (
                              <button onClick={() => toggleExpanded(p.id)} className="text-gray-400 hover:text-[#1A56DB]">
                                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-[#162B4D] truncate">{p.name}</p>
                                {p.unit && <p className="text-[11px] text-gray-400">{p.unit}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {p.category || <span className="text-gray-300">—</span>}
                            {p.subCategory && <span className="text-gray-400"> / {p.subCategory}</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">₹{p.price}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center justify-end px-2 py-0.5 rounded-md font-semibold text-xs ${stockTone}`}>
                              {p.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500">
                            {batches.length > 0 ? batches.length : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 py-3 text-xs font-medium ${expTone}`}>
                            {nextBatch ? (
                              <>
                                {fmtDate(nextBatch.expiryDate)}
                                {dl != null && (
                                  <span className="ml-1 text-[10px]">
                                    ({dl < 0 ? `expired ${Math.abs(dl)}d ago` : dl === 0 ? "today" : `${dl}d`})
                                  </span>
                                )}
                              </>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">₹{(p.price * p.quantity).toFixed(0)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              p.status === "available" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                            }`}>{p.status || "—"}</span>
                          </td>
                        </tr>
                        {isOpen && batches.length > 0 && (
                          <tr className="bg-gray-50/40">
                            <td></td>
                            <td colSpan={8} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {batches.map((b) => {
                                  const bdl = daysUntil(b.expiryDate);
                                  const tone = bdl == null ? "border-gray-200 bg-white"
                                    : bdl < 0 ? "border-red-200 bg-red-50/60"
                                    : bdl <= 7 ? "border-amber-200 bg-amber-50/60"
                                    : "border-emerald-200 bg-emerald-50/40";
                                  return (
                                    <div key={b.id} className={`rounded-lg border ${tone} p-2.5 text-xs`}>
                                      <div className="flex items-center justify-between">
                                        <span className="font-semibold text-[#162B4D]">{b.batchNumber || "Batch"}</span>
                                        <span className="font-bold">{b.quantity} {p.unit}</span>
                                      </div>
                                      <div className="text-[11px] text-gray-500 mt-1">
                                        Expires {fmtDate(b.expiryDate)}
                                        {bdl != null && (
                                          <span className="ml-1">
                                            ({bdl < 0 ? `expired ${Math.abs(bdl)}d ago` : bdl === 0 ? "today" : `${bdl}d left`})
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-gray-400 mt-0.5">
                                        Received {fmtDate(b.receivedDate)}
                                        {b.shelfLifeDays != null && ` · shelf ${b.shelfLifeDays}d`}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={pagedProducts.page}
              pages={pagedProducts.pages}
              total={pagedProducts.total}
              onChange={pagedProducts.setPage}
              label="products"
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, accent = "default" }: { label: string; value: any; icon: React.ReactNode; accent?: "default" | "amber" | "red" }) {
  const ring =
    accent === "amber" ? "border-amber-200 bg-amber-50/40"
    : accent === "red" ? "border-red-200 bg-red-50/40"
    : "border-gray-100 bg-white";
  return (
    <div className={`rounded-xl border ${ring} shadow-sm p-4`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-xl font-bold text-[#162B4D] mt-1">{value}</p>
    </div>
  );
}
