import { useState, useEffect, useCallback } from "react";
import {
  Truck, MapPin, Building2, Store, CheckCircle2, Clock, Package, XCircle,
  RefreshCw, ShoppingBag, TrendingUp, Activity, ArrowRight,
  CircleDollarSign, Phone, AlertCircle, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getAdminData() {
  try { return JSON.parse(localStorage.getItem("fishtokri_admin") || "null"); } catch { return null; }
}
function getToken() { return localStorage.getItem("fishtokri_token") || ""; }
function getBase() { return import.meta.env.BASE_URL?.replace(/\/$/, "") || ""; }

async function apiFetch(path: string) {
  const res = await fetch(`${getBase()}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

function formatRupees(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}
function formatDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ACTIVE_COLOR = "#10B981";
const INACTIVE_COLOR = "#F87171";

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; chart: string; icon: any }> = {
  pending:          { label: "Pending",          color: "text-amber-600",  bg: "bg-amber-50 border-amber-200",  chart: "#F59E0B", icon: Clock },
  confirmed:        { label: "Confirmed",        color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",    chart: "#1A56DB", icon: CheckCircle2 },
  out_for_delivery: { label: "Out for Delivery", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200",chart: "#6366F1", icon: Truck },
  delivered:        { label: "Delivered",        color: "text-green-600",  bg: "bg-green-50 border-green-200",  chart: "#10B981", icon: CheckCircle2 },
  cancelled:        { label: "Cancelled",        color: "text-red-500",    bg: "bg-red-50 border-red-200",      chart: "#EF4444", icon: XCircle },
};

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-3 py-2.5 text-xs">
        <p className="font-bold text-gray-700 mb-1.5">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="flex items-center gap-1.5 font-medium" style={{ color: p.color || p.stroke || p.fill }}>
            <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
            {p.name}: <span className="text-gray-800 font-bold">{p.name === "Revenue" ? formatRupees(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, iconColor, iconBg, border, badge, badgeColor, loading,
}: {
  title: string; value: string | number; sub: string;
  icon: any; iconColor: string; iconBg: string; border: string;
  badge?: string; badgeColor?: string; loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-[108px] rounded-2xl" />;
  return (
    <div className={`bg-white rounded-2xl border ${border} shadow-sm p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor ?? "bg-green-50 text-green-600"}`}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-[#162B4D] leading-none">{value}</p>
        <p className="text-xs font-semibold text-gray-500 mt-1">{title}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, iconColor, title, action, onAction, sub }: any) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <div>
          <h3 className="text-sm font-bold text-[#162B4D]">{title}</h3>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
      </div>
      {action && (
        <button onClick={onAction} className="flex items-center gap-1 text-[11px] font-semibold text-[#1A56DB] hover:text-[#1447B4] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
          {action} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DeliveryDashboard() {
  const admin = getAdminData();

  const superHubIds: string[] = admin?.superHubIds?.length > 0 ? admin.superHubIds : admin?.superHubId ? [admin.superHubId] : [];
  const subHubIds: string[]   = admin?.subHubIds?.length > 0   ? admin.subHubIds   : admin?.subHubId   ? [admin.subHubId]   : [];

  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [superHubs, setSuperHubs] = useState<any[]>([]);
  const [subHubs, setSubHubs] = useState<any[]>([]);
  const [loadingHubs, setLoadingHubs] = useState(true);

  const loadAll = useCallback(async () => {
    if (!admin?.id) return;
    setLoadingStats(true);
    setLoadingHubs(true);
    const [s, sh, su] = await Promise.allSettled([
      apiFetch(`/api/orders/delivery-stats?assignedTo=${admin.id}`),
      apiFetch("/api/super-hubs"),
      apiFetch("/api/sub-hubs"),
    ]);
    if (s.status === "fulfilled") setStats(s.value);
    if (sh.status === "fulfilled") setSuperHubs((sh.value.superHubs ?? []).filter((h: any) => superHubIds.includes(h.id)));
    if (su.status === "fulfilled") setSubHubs((su.value.subHubs ?? []).filter((h: any) => subHubIds.includes(h.id)));
    setLoadingStats(false);
    setLoadingHubs(false);
  }, [admin?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const statusCounts: Record<string, number> = stats?.statusCounts ?? { pending: 0, confirmed: 0, preparing: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 };
  const totalAssigned: number = stats?.totalAssigned ?? 0;
  const activeCount: number   = stats?.activeCount ?? 0;
  const today    = stats?.today   ?? { count: 0, revenue: 0 };
  const week     = stats?.week    ?? { count: 0, revenue: 0 };
  const month    = stats?.month   ?? { count: 0, revenue: 0 };
  const allTime  = stats?.allTime ?? { count: 0, revenue: 0 };
  const monthly: any[] = stats?.monthly ?? [];
  const recent: any[]  = stats?.recent ?? [];

  const orderStatusBarData = Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => ({
    name:  cfg.label.replace(" for ", "\nfor "),
    count: statusCounts[key] ?? 0,
    color: cfg.chart,
  }));
  const orderStatusPieData = Object.entries(ORDER_STATUS_CONFIG)
    .map(([key, cfg]) => ({ name: cfg.label, value: statusCounts[key] ?? 0, color: cfg.chart }))
    .filter((d) => d.value > 0);

  const monthlyHasData = monthly.some((m) => m.delivered > 0 || m.revenue > 0);

  const activeSuperHubs = superHubs.filter((h) => h.status === "Active").length;
  const activeSubHubs   = subHubs.filter((h) => h.status === "Active").length;
  const pincodes = subHubs.reduce((s, h) => s + (h.pincodes?.length ?? 0), 0);

  const hubStatusData = [
    { name: "Active",   value: activeSuperHubs },
    { name: "Inactive", value: superHubs.length - activeSuperHubs },
  ].filter((d) => d.value > 0);
  const subHubStatusData = [
    { name: "Active",   value: activeSubHubs },
    { name: "Inactive", value: subHubs.length - activeSubHubs },
  ].filter((d) => d.value > 0);

  const isLoading = loadingStats;

  return (
    <div className="space-y-7 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Truck className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-[#162B4D]">Delivery Dashboard</h2>
            <p className="text-gray-400 text-sm mt-0.5">Welcome back, {admin?.name || "Delivery Person"}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} className="h-8 gap-1.5 text-gray-500">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* ── Row 1: Today / Week / Month / Lifetime ───────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3" /> Performance
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard loading={isLoading} title="Today Delivered"     value={today.count}    sub={`${formatRupees(today.revenue)} collected`}   icon={CheckCircle2} iconColor="text-green-600"   iconBg="bg-green-50"  border="border-green-100"  badge="Today"      badgeColor="bg-green-50 text-green-600" />
          <StatCard loading={isLoading} title="This Week Delivered" value={week.count}     sub={`${formatRupees(week.revenue)} collected`}    icon={TrendingUp}   iconColor="text-blue-600"    iconBg="bg-blue-50"   border="border-blue-100"   badge="7 days"     badgeColor="bg-blue-50 text-blue-600" />
          <StatCard loading={isLoading} title="This Month Delivered" value={month.count}    sub={`${formatRupees(month.revenue)} collected`}   icon={Activity}     iconColor="text-purple-600"  iconBg="bg-purple-50" border="border-purple-100" badge="Month"      badgeColor="bg-purple-50 text-purple-600" />
          <StatCard loading={isLoading} title="Lifetime Delivered"   value={allTime.count}  sub={`${formatRupees(allTime.revenue)} collected`} icon={CircleDollarSign} iconColor="text-amber-600" iconBg="bg-amber-50"  border="border-amber-100"  badge="All time"   badgeColor="bg-amber-50 text-amber-600" />
        </div>
      </div>

      {/* ── Row 2: Operations stats ───────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <ShoppingBag className="w-3 h-3" /> Operations
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard loading={isLoading} title="Active Orders"   value={activeCount}                 sub="awaiting your action"  icon={Truck}        iconColor="text-orange-600" iconBg="bg-orange-50" border="border-orange-100" badge={statusCounts.pending > 0 ? `${statusCounts.pending} pending` : "All caught up"} badgeColor={statusCounts.pending > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-400"} />
          <StatCard loading={isLoading} title="Out for Delivery" value={statusCounts.out_for_delivery} sub="on the road"           icon={Package}      iconColor="text-indigo-600" iconBg="bg-indigo-50" border="border-indigo-100" badge="In transit" badgeColor="bg-indigo-50 text-indigo-600" />
          <StatCard loading={isLoading} title="Total Assigned"  value={totalAssigned}               sub="orders ever assigned"  icon={ShoppingBag}  iconColor="text-sky-600"    iconBg="bg-sky-50"    border="border-sky-100"    badge="Lifetime"   badgeColor="bg-sky-50 text-sky-600" />
          <StatCard loading={isLoading} title="Cancelled Orders" value={statusCounts.cancelled}      sub="not completed"          icon={XCircle}      iconColor="text-red-500"    iconBg="bg-red-50"    border="border-red-100"    badge={`${totalAssigned > 0 ? Math.round(((statusCounts.cancelled ?? 0) / totalAssigned) * 100) : 0}% rate`} badgeColor="bg-red-50 text-red-600" />
        </div>
      </div>

      {/* ── Row 3: Order status breakdown + Recent orders ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Order status bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={ShoppingBag} iconColor="text-orange-500" title="My Orders by Status" />
          {isLoading ? (
            <Skeleton className="h-52 rounded-xl" />
          ) : totalAssigned === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-gray-300">
              <ShoppingBag className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">No orders assigned yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={orderStatusBarData} barSize={28} margin={{ top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Orders" radius={[6, 6, 0, 0]}>
                    {orderStatusBarData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                {orderStatusPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-[10px] text-gray-500">{d.name}: <strong className="text-gray-700">{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={Clock} iconColor="text-[#1A56DB]" title="Recent Orders" action="View all" onAction={() => { window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/my-deliveries`; }} />
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : recent.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-gray-300">
              <Clock className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">No recent orders</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((o) => {
                const cfg = ORDER_STATUS_CONFIG[o.status];
                const Icon = cfg?.icon ?? Clock;
                const total = (o.items ?? []).reduce((s: number, i: any) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
                return (
                  <div key={String(o._id)} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/60 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg?.bg ?? "bg-gray-50"}`}>
                      <Icon className={`w-4 h-4 ${cfg?.color ?? "text-gray-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#162B4D] truncate">{o.customerName}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cfg?.bg ?? "bg-gray-50 border-gray-200"} ${cfg?.color ?? "text-gray-500"}`}>
                          {cfg?.label ?? o.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {o.phone && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{o.phone}</span>}
                        {o.deliveryArea && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{o.deliveryArea}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#162B4D]">{formatRupees(o.total || total)}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(o.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Monthly trend (area) ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <SectionHeader icon={TrendingUp} iconColor="text-green-500" title="Monthly Performance" sub="Deliveries and revenue collected over the last 6 months" />
        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : !monthlyHasData ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-300">
            <TrendingUp className="w-10 h-10 mb-2" />
            <p className="text-sm font-medium">No delivery activity in the last 6 months</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthly} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1A56DB" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#1A56DB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area yAxisId="left"  type="monotone" dataKey="delivered" name="Delivered" stroke="#10B981" strokeWidth={2.5} fill="url(#colDelivered)" />
              <Area yAxisId="right" type="monotone" dataKey="revenue"   name="Revenue"   stroke="#1A56DB" strokeWidth={2.5} fill="url(#colRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Row 5: Hub coverage ───────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> My Coverage
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <StatCard loading={loadingHubs} title="Super Hubs"      value={superHubs.length}  sub={`${activeSuperHubs} active`}  icon={Building2} iconColor="text-blue-600"   iconBg="bg-blue-50"   border="border-blue-100"   badge="Assigned"  badgeColor="bg-blue-50 text-blue-600" />
          <StatCard loading={loadingHubs} title="Sub Hubs"        value={subHubs.length}    sub={`${activeSubHubs} active`}    icon={Store}      iconColor="text-teal-600"   iconBg="bg-teal-50"   border="border-teal-100"   badge="Assigned"  badgeColor="bg-teal-50 text-teal-600" />
          <StatCard loading={loadingHubs} title="Service Pincodes" value={pincodes}         sub="across your sub hubs"          icon={MapPin}     iconColor="text-purple-600" iconBg="bg-purple-50" border="border-purple-100" badge="Coverage"  badgeColor="bg-purple-50 text-purple-600" />
          <StatCard loading={loadingHubs} title="Inactive Hubs"   value={(superHubs.length - activeSuperHubs) + (subHubs.length - activeSubHubs)} sub="need attention" icon={AlertCircle} iconColor="text-red-500" iconBg="bg-red-50" border="border-red-100" badge="Watch" badgeColor="bg-red-50 text-red-600" />
        </div>
      </div>

      {/* ── Row 6: Hub status donuts + Hub list ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hub list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={Building2} iconColor="text-[#1A56DB]" title="My Hubs" action="View all" onAction={() => { window.location.href = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/my-deliveries-hubs`; }} />
          {loadingHubs ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : superHubs.length === 0 && subHubs.length === 0 ? (
            <div className="py-12 text-center text-gray-300">
              <Building2 className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm font-medium">No hubs assigned</p>
            </div>
          ) : (
            <div className="space-y-2">
              {superHubs.slice(0, 3).map((hub) => (
                <div key={hub.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/60 border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#162B4D] truncate">{hub.name}</p>
                    {hub.location && <p className="text-[10px] text-gray-400">{hub.location}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hub.status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>{hub.status}</span>
                </div>
              ))}
              {subHubs.slice(0, 3).map((hub) => (
                <div key={hub.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/60 border border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0">
                    <Store className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#162B4D] truncate">{hub.name}</p>
                    {hub.superHubName && <p className="text-[10px] text-gray-400">Under: {hub.superHubName}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hub.status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>{hub.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hub status donuts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <h4 className="text-xs font-bold text-[#162B4D]">Super Hub Status</h4>
            </div>
            {loadingHubs ? <Skeleton className="h-28 rounded-xl" /> : hubStatusData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No super hubs assigned</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={90} height={90}>
                  <PieChart>
                    <Pie data={hubStatusData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={4} dataKey="value">
                      {hubStatusData.map((_, i) => <Cell key={i} fill={i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {hubStatusData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR }} />
                      <span className="text-xs text-gray-500">{d.name}</span>
                      <strong className="text-xs text-gray-800 ml-auto pl-2">{d.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <h4 className="text-xs font-bold text-[#162B4D]">Sub Hub Status</h4>
            </div>
            {loadingHubs ? <Skeleton className="h-28 rounded-xl" /> : subHubStatusData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No sub hubs assigned</p>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={90} height={90}>
                  <PieChart>
                    <Pie data={subHubStatusData} cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={4} dataKey="value">
                      {subHubStatusData.map((_, i) => <Cell key={i} fill={i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {subHubStatusData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR }} />
                      <span className="text-xs text-gray-500">{d.name}</span>
                      <strong className="text-xs text-gray-800 ml-auto pl-2">{d.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
