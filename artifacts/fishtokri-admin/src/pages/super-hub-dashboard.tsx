import { useState, useEffect, useCallback } from "react";
import { useGetSuperHubs, getGetSuperHubsQueryKey, useGetSubHubsBySuperHub, getGetSubHubsBySuperHubQueryKey } from "@workspace/api-client-react";
import {
  Layers, MapPin, CheckCircle2, Warehouse, Building2, RefreshCw,
  ShoppingBag, Clock, Truck, Package, XCircle, UserCheck,
  Phone, User, ArrowRight, Activity,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getAdminData() {
  try { return JSON.parse(localStorage.getItem("fishtokri_admin") || "null"); } catch { return null; }
}
function getToken() { return localStorage.getItem("fishtokri_token") || ""; }
function getBase() { return import.meta.env.BASE_URL?.replace(/\/$/, "") || ""; }
async function apiFetch(path: string) {
  const res = await fetch(`${getBase()}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}
function formatRupees(n: number) { return `₹${Number(n || 0).toLocaleString("en-IN")}`; }
function formatDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── COLORS ───────────────────────────────────────────────────────────────────
const HUB_COLORS   = ["#1A56DB", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];
const ACTIVE_COLOR = "#10B981";
const INACTIVE_COLOR = "#F87171";

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; chart: string; icon: any }> = {
  pending:          { label: "Pending",         color: "text-amber-600",  bg: "bg-amber-50",  chart: "#F59E0B", icon: Clock },
  confirmed:        { label: "Confirmed",        color: "text-blue-600",   bg: "bg-blue-50",   chart: "#1A56DB", icon: CheckCircle2 },
  out_for_delivery: { label: "Out for Delivery", color: "text-indigo-600", bg: "bg-indigo-50", chart: "#6366F1", icon: Truck },
  delivered:        { label: "Delivered",        color: "text-green-600",  bg: "bg-green-50",  chart: "#10B981", icon: CheckCircle2 },
  cancelled:        { label: "Cancelled",        color: "text-red-500",    bg: "bg-red-50",    chart: "#EF4444", icon: XCircle },
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 shadow-xl rounded-xl px-3 py-2.5 text-xs">
      <p className="font-bold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-1.5 font-medium" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="text-gray-800 font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

function StatCard({ title, value, sub, icon: Icon, iconColor, iconBg, border, badge, badgeColor, loading }: any) {
  if (loading) return <Skeleton className="h-[108px] rounded-2xl" />;
  return (
    <div className={`bg-white rounded-2xl border ${border} shadow-sm p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor ?? "bg-green-50 text-green-600"}`}>{badge}</span>
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

function SectionHeader({ icon: Icon, iconColor, title, action, onAction }: any) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-sm font-bold text-[#162B4D]">{title}</h3>
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
export default function SuperHubDashboard() {
  const admin = getAdminData();
  const superHubIds: string[] = (
    admin?.superHubIds?.length > 0 ? admin.superHubIds : admin?.superHubId ? [admin.superHubId] : []
  ).map(String);

  const { data: superHubsData, isLoading: hubsLoading, refetch: refetchHubs } = useGetSuperHubs(undefined, {
    query: { queryKey: getGetSuperHubsQueryKey() },
  });

  // Fetch sub hubs for up to 6 super hubs
  const ids = [...superHubIds, "", "", "", "", "", ""].slice(0, 6);
  const { data: sd0 } = useGetSubHubsBySuperHub(ids[0], { query: { queryKey: getGetSubHubsBySuperHubQueryKey(ids[0]), enabled: !!ids[0] } });
  const { data: sd1 } = useGetSubHubsBySuperHub(ids[1], { query: { queryKey: getGetSubHubsBySuperHubQueryKey(ids[1]), enabled: !!ids[1] } });
  const { data: sd2 } = useGetSubHubsBySuperHub(ids[2], { query: { queryKey: getGetSubHubsBySuperHubQueryKey(ids[2]), enabled: !!ids[2] } });
  const { data: sd3 } = useGetSubHubsBySuperHub(ids[3], { query: { queryKey: getGetSubHubsBySuperHubQueryKey(ids[3]), enabled: !!ids[3] } });
  const { data: sd4 } = useGetSubHubsBySuperHub(ids[4], { query: { queryKey: getGetSubHubsBySuperHubQueryKey(ids[4]), enabled: !!ids[4] } });
  const { data: sd5 } = useGetSubHubsBySuperHub(ids[5], { query: { queryKey: getGetSubHubsBySuperHubQueryKey(ids[5]), enabled: !!ids[5] } });

  const allSubHubs = [
    ...(sd0?.subHubs ?? []), ...(sd1?.subHubs ?? []), ...(sd2?.subHubs ?? []),
    ...(sd3?.subHubs ?? []), ...(sd4?.subHubs ?? []), ...(sd5?.subHubs ?? []),
  ];

  const myHubs = (superHubsData?.superHubs ?? []).filter((h) => superHubIds.includes(h.id));

  // Extra data
  const [orderStats, setOrderStats]         = useState<Record<string, number>>({});
  const [recentOrders, setRecentOrders]     = useState<any[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState(0);
  const [extraLoading, setExtraLoading]     = useState(true);

  const loadExtra = useCallback(async () => {
    setExtraLoading(true);
    try {
      const queries: string[] = [];
      if (superHubIds.length > 0) queries.push(`superHubId=${superHubIds[0]}`);
      const [oStats, oRecent, dp] = await Promise.allSettled([
        apiFetch("/api/orders/stats"),
        apiFetch("/api/orders?limit=5&sort=createdAt&order=desc"),
        apiFetch(`/api/users?role=delivery_person${superHubIds.length > 0 ? `&superHubId=${superHubIds[0]}` : ""}&limit=100`),
      ]);
      if (oStats.status === "fulfilled")  setOrderStats(oStats.value.stats ?? {});
      if (oRecent.status === "fulfilled") setRecentOrders(oRecent.value.orders ?? []);
      if (dp.status === "fulfilled")      setDeliveryPartners(dp.value.total ?? 0);
    } finally { setExtraLoading(false); }
  }, [superHubIds.join(",")]);

  useEffect(() => { loadExtra(); }, [loadExtra]);

  const handleRefresh = () => { refetchHubs(); loadExtra(); };

  const isLoading = hubsLoading;
  const activeSubHubs   = allSubHubs.filter((s) => s.status === "Active").length;
  const totalPincodes   = allSubHubs.reduce((acc, s) => acc + ((s as any).pincodes?.length || 0), 0);
  const totalOrders     = Object.values(orderStats).reduce((a, b) => a + b, 0);
  const pendingOrders   = orderStats.pending ?? 0;
  const activeOrders    = (orderStats.pending ?? 0) + (orderStats.confirmed ?? 0) + (orderStats.out_for_delivery ?? 0);

  const subHubStatusData = [
    { name: "Active",   value: activeSubHubs },
    { name: "Inactive", value: allSubHubs.length - activeSubHubs },
  ].filter((d) => d.value > 0);

  const pincodeBarData = allSubHubs.map((s) => ({
    name: s.name,
    Pincodes: (s as any).pincodes?.length || 0,
  }));

  const orderStatusBarData = Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    count: orderStats[key] ?? 0,
    color: cfg.chart,
  }));

  return (
    <div className="space-y-7 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        {isLoading ? <Skeleton className="h-16 w-72" /> : myHubs.length === 1 ? (
          <div className="flex items-center gap-4">
            {(myHubs[0] as any).imageUrl && (
              <img src={(myHubs[0] as any).imageUrl} alt={myHubs[0].name} className="w-14 h-14 rounded-2xl object-cover shadow-md flex-shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-extrabold text-[#162B4D]">{myHubs[0].name}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${myHubs[0].status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                  {myHubs[0].status}
                </span>
              </div>
              {(myHubs[0] as any).location && (
                <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />{(myHubs[0] as any).location}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-extrabold text-[#162B4D]">My Hubs Dashboard</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {myHubs.map((h) => (
                <span key={h.id} className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  <Building2 className="w-3 h-3" /> {h.name}
                </span>
              ))}
            </div>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 gap-1.5 text-gray-500 flex-shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* ── Stats row 1: Hub stats ───────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> My Network
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard loading={isLoading} title="Super Hubs"       value={superHubIds.length}       sub={`${myHubs.filter(h => h.status === "Active").length} active`} icon={Warehouse}   iconColor="text-[#1A56DB]"  iconBg="bg-blue-50"   border="border-blue-100"   badge="Assigned"  badgeColor="bg-blue-50 text-blue-600" />
          <StatCard loading={isLoading} title="Total Sub Hubs"   value={allSubHubs.length}        sub={`${activeSubHubs} active`}                                    icon={Layers}      iconColor="text-indigo-600" iconBg="bg-indigo-50" border="border-indigo-100" badge={`${allSubHubs.length ? Math.round((activeSubHubs/allSubHubs.length)*100) : 0}% active`} badgeColor="bg-green-50 text-green-600" />
          <StatCard loading={isLoading} title="Service Pincodes" value={totalPincodes}            sub="areas covered"                                                icon={MapPin}      iconColor="text-purple-600" iconBg="bg-purple-50" border="border-purple-100" badge="Coverage" badgeColor="bg-purple-50 text-purple-600" />
          <StatCard loading={extraLoading} title="Delivery Partners" value={deliveryPartners}     sub="field team"                                                   icon={UserCheck}   iconColor="text-teal-600"   iconBg="bg-teal-50"   border="border-teal-100"   badge="My hub" badgeColor="bg-teal-50 text-teal-600" />
        </div>
      </div>

      {/* ── Stats row 2: Order stats ─────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <ShoppingBag className="w-3 h-3" /> Orders
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard loading={extraLoading} title="Total Orders"       value={totalOrders}                   sub={`${activeOrders} active`}          icon={ShoppingBag}  iconColor="text-orange-600"  iconBg="bg-orange-50"  border="border-orange-100"  badge={pendingOrders > 0 ? `${pendingOrders} pending` : "All clear"} badgeColor={pendingOrders > 0 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"} />
          <StatCard loading={extraLoading} title="Pending"            value={pendingOrders}                 sub="awaiting confirmation"             icon={Clock}        iconColor="text-amber-600"   iconBg="bg-amber-50"   border="border-amber-100"   badge="Action needed" badgeColor="bg-amber-50 text-amber-600" />
          <StatCard loading={extraLoading} title="Out for Delivery"   value={orderStats.out_for_delivery ?? 0} sub="on the road"                   icon={Truck}        iconColor="text-indigo-600"  iconBg="bg-indigo-50"  border="border-indigo-100"  badge="Active" badgeColor="bg-indigo-50 text-indigo-600" />
          <StatCard loading={extraLoading} title="Delivered"          value={orderStats.delivered ?? 0}     sub={`${orderStats.cancelled ?? 0} cancelled`} icon={CheckCircle2} iconColor="text-green-600" iconBg="bg-green-50" border="border-green-100" badge="Fulfilled" badgeColor="bg-green-50 text-green-600" />
        </div>
      </div>

      {/* ── Charts row: Order breakdown + Pincodes bar ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Order status chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={ShoppingBag} iconColor="text-orange-500" title="Orders by Status" />
          {extraLoading ? <Skeleton className="h-52 rounded-xl" /> : totalOrders === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-gray-300">
              <ShoppingBag className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">No orders yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={orderStatusBarData} barSize={24} margin={{ top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Orders" radius={[6, 6, 0, 0]}>
                    {orderStatusBarData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                {Object.entries(ORDER_STATUS_CONFIG).filter(([k]) => (orderStats[k] ?? 0) > 0).map(([k, cfg]) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: cfg.chart }} />
                    <span className="text-[10px] text-gray-500">{cfg.label}: <strong className="text-gray-700">{orderStats[k]}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={Clock} iconColor="text-[#1A56DB]" title="Recent Orders" />
          {extraLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : recentOrders.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-gray-300">
              <Clock className="w-10 h-10 mb-2" /><p className="text-sm font-medium">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => {
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
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg?.bg ?? "bg-gray-50"} ${cfg?.color ?? "text-gray-500"}`}>{cfg?.label ?? o.status}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{o.phone}</span>
                        {o.deliveryArea && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{o.deliveryArea}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#162B4D]">{formatRupees(total)}</p>
                      <p className="text-[10px] text-gray-400">{formatDate(o.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Sub hubs + status ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pincodes bar */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={MapPin} iconColor="text-[#1A56DB]" title="Pincodes per Sub Hub" />
          {isLoading ? <Skeleton className="h-48 rounded-xl" /> : pincodeBarData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-300">
              <Layers className="w-10 h-10 mb-2" /><p className="text-sm font-medium">No sub hubs yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pincodeBarData} barSize={44}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Pincodes" radius={[8, 8, 0, 0]}>
                  {pincodeBarData.map((_, i) => <Cell key={i} fill={HUB_COLORS[i % HUB_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sub hub status donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={CheckCircle2} iconColor="text-green-500" title="Sub Hub Status" />
          {isLoading ? <Skeleton className="h-48 rounded-xl" /> : subHubStatusData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-300">
              <Activity className="w-10 h-10 mb-2" /><p className="text-sm font-medium">No data</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={subHubStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                    {subHubStatusData.map((_, i) => <Cell key={i} fill={i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4">
                {subHubStatusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR }} />
                    <span className="text-xs text-gray-500">{d.name}: <strong className="text-gray-800">{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Order pipeline + Sub hubs table ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Order pipeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={Truck} iconColor="text-indigo-500" title="Order Pipeline" />
          <div className="space-y-3">
            {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const count = orderStats[key] ?? 0;
              const pct   = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
              const barColors: Record<string, string> = {
                pending: "bg-amber-400", confirmed: "bg-blue-500",
                out_for_delivery: "bg-indigo-500", delivered: "bg-green-500", cancelled: "bg-red-400",
              };
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{cfg.label}</span>
                      <span className={`text-xs font-bold ${cfg.color}`}>{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barColors[key]} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 w-7 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub hubs overview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <SectionHeader icon={Warehouse} iconColor="text-[#1A56DB]" title="Sub Hubs Overview" />
          {isLoading ? <Skeleton className="h-48 rounded-xl" /> : allSubHubs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-gray-300">
              <Layers className="w-10 h-10 mb-2" /><p className="text-sm font-medium">No sub hubs yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {allSubHubs.map((sub, idx) => {
                const pincodeCount = (sub as any).pincodes?.length || 0;
                const parentHub = myHubs.find((h) => h.id === (sub as any).superHubId);
                return (
                  <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/60 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-white text-xs" style={{ background: HUB_COLORS[idx % HUB_COLORS.length] }}>
                      {sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-[#162B4D] truncate">{sub.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${sub.status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>{sub.status}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {parentHub && <span className="text-[10px] text-gray-400">{parentHub.name}</span>}
                        {(sub as any).location && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{(sub as any).location}</span>}
                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{pincodeCount} pincode{pincodeCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
