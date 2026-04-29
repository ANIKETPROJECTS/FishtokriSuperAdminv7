import { useState } from "react";
import { useGetSuperHubs, getGetSuperHubsQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { MapPin, ChevronRight, Building2, Search, ArrowUpDown, SlidersHorizontal, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";

function getAdminData() {
  try {
    const raw = localStorage.getItem("fishtokri_admin");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type SortOption = "name_asc" | "name_desc" | "status";

export default function MyHubs() {
  const admin = getAdminData();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [sort, setSort] = useState<SortOption>("name_asc");

  const superHubIds: string[] = admin?.superHubIds?.length > 0
    ? admin.superHubIds
    : admin?.superHubId ? [admin.superHubId] : [];

  const { data: superHubsData, isLoading } = useGetSuperHubs(undefined, {
    query: { queryKey: getGetSuperHubsQueryKey() },
  });

  const myHubs = (superHubsData?.superHubs || []).filter((h) =>
    superHubIds.includes(h.id)
  );

  if (superHubIds.length === 1 && myHubs.length === 1 && !search && statusFilter === "all") {
    setLocation(`/my-hub/${myHubs[0].id}`);
    return null;
  }

  const filtered = myHubs
    .filter((h) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || h.name.toLowerCase().includes(q) || ((h as any).location || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || h.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name);
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "status") return a.status.localeCompare(b.status);
      return 0;
    });

  const pagedHubs = usePaginated(filtered, 20, `${search}|${statusFilter}|${sort}`);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[#162B4D]">My Super Hubs</h2>
        <p className="text-gray-500 text-sm mt-1">Select a hub to manage its sub hubs and service areas.</p>
      </div>

      {/* Search, Sort, Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white border-gray-200 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="h-9 w-36 text-sm border-gray-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="h-9 w-40 text-sm border-gray-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A → Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z → A)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(search || statusFilter !== "all") && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); }} className="text-xs text-[#1A56DB] hover:underline font-medium">
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400 font-medium">
          {filtered.length} of {myHubs.length} hub{myHubs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-20 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search || statusFilter !== "all" ? "No hubs match your filters" : "No super hubs assigned"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {search || statusFilter !== "all" ? "Try adjusting your search or filters" : "Contact your administrator to get access."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pagedHubs.pageItems.map((hub) => (
            <button
              key={hub.id}
              onClick={() => setLocation(`/my-hub/${hub.id}`)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:shadow-md hover:border-blue-100 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {(hub as any).imageUrl ? (
                    <img
                      src={(hub as any).imageUrl}
                      alt={hub.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-[#1A56DB]" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#162B4D]">{hub.name}</h3>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${hub.status === "Active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                        {hub.status}
                      </span>
                    </div>
                    {(hub as any).location && (
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {(hub as any).location}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#1A56DB] transition-colors mt-1 flex-shrink-0" />
              </div>
              <p className="text-xs text-gray-400 mt-3">Click to manage sub hubs</p>
            </button>
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
