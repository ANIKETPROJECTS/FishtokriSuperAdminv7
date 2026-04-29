import { useQuery } from "@tanstack/react-query";
import { Layers, MapPin, CheckCircle2, Store } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const ACTIVE_COLOR = "#10B981";
const INACTIVE_COLOR = "#F87171";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-lg px-3 py-2 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-medium">
            {p.name}: <span className="text-gray-800">{p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function getAdminData() {
  try {
    const raw = localStorage.getItem("fishtokri_admin");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem("fishtokri_token") || "";
}

function useAllSubHubs() {
  return useQuery({
    queryKey: ["all-sub-hubs"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${base}/api/sub-hubs`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch sub hubs");
      return res.json() as Promise<{ subHubs: any[]; total: number }>;
    },
  });
}

export default function SubHubDashboard() {
  const admin = getAdminData();
  const subHubIds: string[] = admin?.subHubIds?.length > 0
    ? admin.subHubIds
    : admin?.subHubId ? [admin.subHubId] : [];

  const { data: allSubHubsData, isLoading } = useAllSubHubs();

  const mySubHubs = (allSubHubsData?.subHubs || []).filter((s) =>
    subHubIds.includes(s.id)
  );

  const activeCount = mySubHubs.filter((s) => s.status === "Active").length;
  const inactiveCount = mySubHubs.length - activeCount;
  const totalPincodes = mySubHubs.reduce((acc, s) => acc + (s.pincodes?.length || 0), 0);

  const statusData = [
    { name: "Active", value: activeCount },
    { name: "Inactive", value: inactiveCount },
  ].filter((d) => d.value > 0);

  const pincodeBarData = mySubHubs.map((s) => ({
    name: s.name,
    Pincodes: s.pincodes?.length || 0,
  }));

  const statCards = [
    {
      title: "Assigned Sub Hubs",
      value: subHubIds.length,
      sub: `${activeCount} active`,
      icon: Store,
      iconColor: "text-teal-600",
      iconBg: "bg-teal-50",
      border: "border-teal-100",
    },
    {
      title: "Active Sub Hubs",
      value: activeCount,
      sub: `of ${mySubHubs.length} total`,
      icon: CheckCircle2,
      iconColor: "text-green-600",
      iconBg: "bg-green-50",
      border: "border-green-100",
    },
    {
      title: "Inactive Sub Hubs",
      value: inactiveCount,
      sub: "currently offline",
      icon: Layers,
      iconColor: "text-red-500",
      iconBg: "bg-red-50",
      border: "border-red-100",
    },
    {
      title: "Total Pincodes",
      value: totalPincodes,
      sub: "service areas",
      icon: MapPin,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
      border: "border-purple-100",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : mySubHubs.length === 1 ? (
          <div className="flex items-start gap-4">
            {mySubHubs[0].imageUrl && (
              <img src={mySubHubs[0].imageUrl} alt={mySubHubs[0].name} className="w-16 h-16 rounded-xl object-cover shadow-md flex-shrink-0" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-[#162B4D]">{mySubHubs[0].name}</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${mySubHubs[0].status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                  {mySubHubs[0].status}
                </span>
              </div>
              {mySubHubs[0].location && (
                <p className="text-gray-500 text-sm mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {mySubHubs[0].location}
                </p>
              )}
              {mySubHubs[0].superHubName && (
                <p className="text-gray-400 text-xs mt-0.5">Under: {mySubHubs[0].superHubName}</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-[#162B4D]">My Sub Hubs Dashboard</h2>
            <p className="text-gray-500 text-sm mt-1">Manage your assigned sub hub locations.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {mySubHubs.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
                  <MapPin className="w-3 h-3" /> {s.name}
                  {s.superHubName && <span className="text-teal-400">· {s.superHubName}</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ title, value, sub, icon: Icon, iconColor, iconBg, border }) => (
            <div key={title} className={`bg-white p-5 rounded-xl border ${border} shadow-sm`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[#162B4D]">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{title}</p>
              <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <MapPin className="w-4 h-4 text-[#1A56DB]" />
            <h3 className="text-sm font-bold text-[#162B4D]">Pincodes per Sub Hub</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-48 rounded-lg" />
          ) : pincodeBarData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No sub hubs assigned</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pincodeBarData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Pincodes" fill="#14B8A6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-bold text-[#162B4D]">Sub Hub Status</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-48 rounded-lg" />
          ) : statusData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2">
                {statusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? ACTIVE_COLOR : INACTIVE_COLOR }} />
                    <span className="text-xs text-gray-500">{d.name}: <strong className="text-gray-700">{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-bold text-[#162B4D]">My Sub Hubs</h3>
        </div>
        {isLoading ? (
          <Skeleton className="h-32 rounded-lg" />
        ) : mySubHubs.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-8">No sub hubs assigned to your account yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 pr-4">Sub Hub</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 pr-4">Super Hub</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 pr-4">Pincodes</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mySubHubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-[#162B4D]">{sub.name}</td>
                    <td className="py-3 pr-4 text-xs text-gray-500">{sub.superHubName || "—"}</td>
                    <td className="py-3 pr-4">
                      <span className="bg-purple-50 text-purple-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                        {sub.pincodes?.length || 0} pincodes
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${sub.status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sub.status === "Active" ? "bg-green-500" : "bg-red-400"}`} />
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
