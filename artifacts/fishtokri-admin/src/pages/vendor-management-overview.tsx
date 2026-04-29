import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Boxes, Building2, FolderOpen, Handshake, History, IndianRupee, Package, RefreshCw, ShoppingCart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type VendorAnalytics = {
  overview: {
    totalVendors: number;
    activeVendors: number;
    inactiveVendors: number;
    totalTransactions: number;
    totalSpent: number;
    averagePurchase: number;
    last30DaysTransactions: number;
    last30DaysSpent: number;
    categoryCount: number;
    activeCategoryCount: number;
    itemCount: number;
    activeItemCount: number;
    inventoryCount: number;
  };
  topVendors: Array<{ id: string; name: string; category: string; totalPurchases: number; totalSpent: number; status: string }>;
  recentPurchases: Array<{ id: string; vendorName: string; invoiceNumber: string; purchaseDate: string; totalAmount: number; items: Array<{ productName: string }> }>;
  spendByCategory: Array<{ categoryName: string; totalSpent: number; purchases: number }>;
};

function getToken() {
  return localStorage.getItem("fishtokri_token") ?? "";
}

async function apiFetch(path: string) {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data;
}

function formatRupees(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function StatCard({ title, value, helper, icon: Icon, tone = "blue" }: { title: string; value: string | number; helper: string; icon: any; tone?: "blue" | "green" | "amber" | "purple" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-[#162B4D] mt-2">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{helper}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function SectionLink({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: any }) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#162B4D]/10 text-[#162B4D] flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#162B4D]">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-300" />
        </div>
      </div>
    </Link>
  );
}

export default function VendorManagementOverview() {
  const { toast } = useToast();
  const [data, setData] = useState<VendorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await apiFetch("/api/vendors/analytics/summary");
      setData(result);
    } catch (err: any) {
      toast({ title: "Could not load vendor analytics", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const maxCategorySpend = useMemo(() => {
    return Math.max(1, ...(data?.spendByCategory.map((item) => item.totalSpent) ?? [0]));
  }, [data?.spendByCategory]);

  const overview = data?.overview;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#162B4D]">Vendor Management</h1>
          <p className="text-sm text-gray-500 mt-1">Overall analytics for vendors, purchases, categories, items, and inventory.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Vendors" value={overview?.totalVendors ?? "—"} helper={`${overview?.activeVendors ?? 0} active, ${overview?.inactiveVendors ?? 0} inactive`} icon={Handshake} tone="blue" />
        <StatCard title="Total Spent" value={overview ? formatRupees(overview.totalSpent) : "—"} helper={`${overview?.totalTransactions ?? 0} purchase transactions`} icon={IndianRupee} tone="green" />
        <StatCard title="Last 30 Days" value={overview ? formatRupees(overview.last30DaysSpent) : "—"} helper={`${overview?.last30DaysTransactions ?? 0} recent transactions`} icon={TrendingUp} tone="amber" />
        <StatCard title="Average Purchase" value={overview ? formatRupees(overview.averagePurchase) : "—"} helper={`${overview?.inventoryCount ?? 0} inventory records tracked`} icon={ShoppingCart} tone="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionLink href="/vendors" label="Vendor" description="Manage supplier profiles and purchase entry." icon={Building2} />
        <SectionLink href="/vendor-categories" label="Categories" description={`${overview?.categoryCount ?? 0} categories, ${overview?.activeCategoryCount ?? 0} active.`} icon={FolderOpen} />
        <SectionLink href="/vendor-items" label="Items" description={`${overview?.itemCount ?? 0} catalog items, ${overview?.activeItemCount ?? 0} active.`} icon={Boxes} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#162B4D]">Spend by Vendor Item Category</h2>
            <p className="text-xs text-gray-400 mt-0.5">Based on recorded vendor purchase line items.</p>
          </div>
          <div className="p-5 space-y-4">
            {loading ? (
              <div className="h-36 rounded-xl bg-gray-50 animate-pulse" />
            ) : data?.spendByCategory.length ? (
              data.spendByCategory.map((item) => (
                <div key={item.categoryName} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-[#162B4D]">{item.categoryName}</span>
                    <span className="text-gray-500">{formatRupees(item.totalSpent)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#1A56DB]" style={{ width: `${Math.max(4, (item.totalSpent / maxCategorySpend) * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-gray-400">{item.purchases} purchase item entries</p>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Package className="w-10 h-10 mx-auto text-gray-200" />
                <p className="text-sm font-medium text-gray-500 mt-3">No category spend yet</p>
                <p className="text-xs text-gray-400 mt-1">Vendor purchase category analytics will appear after purchases are recorded.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#162B4D]">Top Vendors</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ranked by total spend.</p>
            </div>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-5 space-y-3">
                  <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                  <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                </div>
              ) : data?.topVendors.length ? (
                data.topVendors.map((vendor) => (
                  <Link key={vendor.id} href="/vendors">
                    <div className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50 cursor-pointer">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#162B4D] truncate">{vendor.name}</p>
                        <p className="text-xs text-gray-400">{vendor.totalPurchases} purchases • {vendor.category || "General"}</p>
                      </div>
                      <p className="font-bold text-sm text-[#162B4D]">{formatRupees(vendor.totalSpent)}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-gray-400">No vendors found.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#162B4D]">Recent Purchases</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest vendor transactions.</p>
            </div>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="p-5 space-y-3">
                  <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                  <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                </div>
              ) : data?.recentPurchases.length ? (
                data.recentPurchases.map((purchase) => (
                  <div key={purchase.id} className="p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-[#162B4D] truncate">{purchase.vendorName || "Unknown Vendor"}</p>
                        <p className="font-bold text-sm text-[#162B4D]">{formatRupees(purchase.totalAmount)}</p>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(purchase.purchaseDate)}{purchase.invoiceNumber ? ` • ${purchase.invoiceNumber}` : ""}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-gray-400">No purchases found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}