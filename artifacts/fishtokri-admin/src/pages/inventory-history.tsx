import { useEffect, useMemo, useState } from "react";
import { Building2, Search, History, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";
import { getCurrentAdminScope } from "@/lib/api";

function getToken() { return localStorage.getItem("fishtokri_token") ?? ""; }

async function apiFetch(path: string, options: RequestInit = {}) {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data;
}

type SuperHub = { id: string; name: string; location?: string };
type SubHub = { id: string; name: string; location?: string };
type Movement = {
  _id: string;
  type: "order_deduct" | "order_restore" | "adjustment";
  productId: string;
  productName: string;
  unit?: string;
  change: number;
  balance: number;
  orderId?: string;
  orderRef?: string;
  reason?: string;
  notes?: string;
  createdAt: string;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InventoryHistory() {
  const { toast } = useToast();
  const [superHubs, setSuperHubs] = useState<SuperHub[]>([]);
  const [subHubs, setSubHubs] = useState<SubHub[]>([]);
  const [selectedSuperHubId, setSelectedSuperHubId] = useState("");
  const [selectedSubHubId, setSelectedSubHubId] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    apiFetch("/api/super-hubs")
      .then((d) => setSuperHubs(d.superHubs ?? []))
      .catch((err) => toast({ title: "Failed to load super hubs", description: err.message, variant: "destructive" }));
  }, [toast]);

  useEffect(() => {
    if (!selectedSuperHubId) { setSubHubs([]); setSelectedSubHubId(""); return; }
    apiFetch(`/api/super-hubs/${selectedSuperHubId}/sub-hubs`)
      .then((d) => setSubHubs(d.subHubs ?? []))
      .catch((err) => toast({ title: "Failed to load sub hubs", description: err.message, variant: "destructive" }));
    setSelectedSubHubId("");
  }, [selectedSuperHubId, toast]);

  // Auto-select hub for super_hub users when only one option is available
  // (the API already filters super-hubs and sub-hubs to the user's scope).
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

  function loadHistory() {
    if (!selectedSubHubId) { setMovements([]); return; }
    setLoading(true);
    apiFetch(`/api/inventory/movements?subHubId=${selectedSubHubId}&limit=300`)
      .then((d) => setMovements(d.movements ?? []))
      .catch((err) => toast({ title: "Failed to load history", description: err.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }

  useEffect(loadHistory, [selectedSubHubId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (!q) return true;
      return (
        m.productName.toLowerCase().includes(q) ||
        (m.orderRef ?? "").toLowerCase().includes(q) ||
        (m.reason ?? "").toLowerCase().includes(q)
      );
    });
  }, [movements, search, typeFilter]);

  const pagedMovements = usePaginated(filtered, 20, `${search}|${typeFilter}`);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#162B4D]">Inventory History</h1>
        <p className="text-sm text-gray-500">Stock movement log — order deductions, cancellations, and adjustments.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Super Hub</Label>
            <Select value={selectedSuperHubId} onValueChange={setSelectedSuperHubId}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Select super hub" /></SelectTrigger>
              <SelectContent>
                {superHubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />{h.name}
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
                <SelectValue placeholder={!selectedSuperHubId ? "Select super hub first" : "Select sub hub"} />
              </SelectTrigger>
              <SelectContent>
                {subHubs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />{h.name}
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
            <History className="w-5 h-5 text-[#1A56DB]" />
          </div>
          <p className="text-sm font-semibold text-[#162B4D]">Select a sub hub to see its inventory history</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product, order, or reason..."
                className="pl-9 h-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-10 w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All movements</SelectItem>
                <SelectItem value="order_deduct">Order deductions</SelectItem>
                <SelectItem value="order_restore">Order restores</SelectItem>
                <SelectItem value="adjustment">Manual adjustments</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">When</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Loading...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No movements yet</td></tr>
                  ) : pagedMovements.pageItems.map((m) => {
                    const isPositive = m.change >= 0;
                    const typeMeta = m.type === "order_deduct"
                      ? { label: "Order Deduct", icon: <ArrowDownCircle className="w-3.5 h-3.5" />, tone: "bg-red-50 text-red-700" }
                      : m.type === "order_restore"
                        ? { label: "Order Restore", icon: <ArrowUpCircle className="w-3.5 h-3.5" />, tone: "bg-emerald-50 text-emerald-700" }
                        : { label: "Adjustment", icon: <SlidersHorizontal className="w-3.5 h-3.5" />, tone: "bg-blue-50 text-blue-700" };
                    return (
                      <tr key={m._id} className="hover:bg-gray-50/40">
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${typeMeta.tone}`}>
                            {typeMeta.icon}{typeMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#162B4D]">{m.productName}</p>
                          {m.unit && <p className="text-[11px] text-gray-400">{m.unit}</p>}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                          {isPositive ? "+" : ""}{m.change}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{m.balance}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {m.orderRef ? (
                            <span className="font-mono text-xs">{m.orderRef}</span>
                          ) : m.reason ? (
                            <span>
                              <span className="font-medium text-[#162B4D]">{m.reason}</span>
                              {m.notes && <span className="text-gray-400 text-xs"> · {m.notes}</span>}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={pagedMovements.page}
              pages={pagedMovements.pages}
              total={pagedMovements.total}
              onChange={pagedMovements.setPage}
              label="movements"
            />
          </div>
        </>
      )}
    </div>
  );
}
