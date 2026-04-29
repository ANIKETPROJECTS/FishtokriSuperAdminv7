import { useState, useEffect } from "react";
import { Building2, Store, MapPin, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";

function getAdminData() {
  try { return JSON.parse(localStorage.getItem("fishtokri_admin") || "null"); } catch { return null; }
}
function getToken() { return localStorage.getItem("fishtokri_token") || ""; }
function getBase() { return import.meta.env.BASE_URL?.replace(/\/$/, "") || ""; }

async function apiFetch(path: string) {
  const res = await fetch(`${getBase()}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export default function DeliveryHubs() {
  const admin = getAdminData();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"super" | "sub">("super");
  const [superHubs, setSuperHubs] = useState<any[]>([]);
  const [subHubs, setSubHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const superHubIds: string[] = admin?.superHubIds?.length > 0 ? admin.superHubIds : admin?.superHubId ? [admin.superHubId] : [];
  const subHubIds: string[]   = admin?.subHubIds?.length > 0   ? admin.subHubIds   : admin?.subHubId   ? [admin.subHubId]   : [];

  useEffect(() => {
    Promise.all([
      apiFetch("/api/super-hubs").then((d) => setSuperHubs((d.superHubs ?? []).filter((s: any) => superHubIds.includes(s.id)))).catch(() => {}),
      apiFetch("/api/sub-hubs").then((d) => setSubHubs((d.subHubs ?? []).filter((s: any) => subHubIds.includes(s.id)))).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const filtered = (tab === "super" ? superHubs : subHubs).filter((h) => {
    const q = search.toLowerCase();
    return !q || h.name?.toLowerCase().includes(q) || h.location?.toLowerCase().includes(q);
  });

  const pagedHubs = usePaginated(filtered, 20, `${tab}|${search}`);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#162B4D]">My Hubs</h2>
          <p className="text-gray-500 text-sm mt-0.5">Hubs you cover for pickups and deliveries.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          <button onClick={() => setTab("super")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === "super" ? "bg-white text-[#162B4D] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Building2 className="w-3.5 h-3.5" /> Super Hubs
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{superHubs.length}</span>
          </button>
          <button onClick={() => setTab("sub")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === "sub" ? "bg-white text-[#162B4D] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Store className="w-3.5 h-3.5" /> Sub Hubs
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600">{subHubs.length}</span>
          </button>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hubs..." className="pl-8 h-9 text-sm" />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
          <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No {tab === "super" ? "super" : "sub"} hubs assigned</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedHubs.pageItems.map((hub) => (
            <div key={hub.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${tab === "super" ? "border-blue-100" : "border-teal-100"}`}>
              <div className={`h-14 flex items-center px-4 gap-3 ${tab === "super" ? "bg-gradient-to-r from-blue-500 to-blue-700" : "bg-gradient-to-r from-teal-500 to-teal-700"}`}>
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  {tab === "super" ? <Building2 className="w-3.5 h-3.5 text-white" /> : <Store className="w-3.5 h-3.5 text-white" />}
                </div>
                <p className="text-white font-bold text-sm truncate flex-1">{hub.name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hub.status === "Active" ? "bg-green-400/90 text-white" : "bg-red-400/90 text-white"}`}>{hub.status}</span>
              </div>
              <div className="p-3 space-y-1">
                {hub.location && <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-gray-400" />{hub.location}</p>}
                {hub.superHubName && <p className="text-xs text-gray-400">Under: {hub.superHubName}</p>}
                {hub.pincodes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(hub.pincodes as string[]).slice(0, 4).map((p: string) => (
                      <span key={p} className="bg-purple-50 text-purple-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{p}</span>
                    ))}
                    {hub.pincodes.length > 4 && <span className="text-[10px] text-gray-400">+{hub.pincodes.length - 4}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <PaginationBar
        page={pagedHubs.page}
        pages={pagedHubs.pages}
        total={pagedHubs.total}
        onChange={pagedHubs.setPage}
        label="hubs"
      />
    </div>
  );
}
