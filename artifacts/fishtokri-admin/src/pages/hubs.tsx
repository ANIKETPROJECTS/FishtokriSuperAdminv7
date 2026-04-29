import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, MapPin, ChevronDown, ChevronUp, Building2, X, UserPlus, Layers, Search, ArrowUpDown, SlidersHorizontal, LayoutGrid, LayoutList } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";
import {
  useGetSuperHubs,
  getGetSuperHubsQueryKey,
  useCreateSuperHub,
  useUpdateSuperHub,
  useDeleteSuperHub,
  useToggleSuperHubStatus,
  useGetSubHubsBySuperHub,
  getGetSubHubsBySuperHubQueryKey,
  useCreateSubHub,
  useUpdateSubHub,
  useDeleteSubHub,
  useToggleSubHubStatus,
  useCreateUser,
  getGetUsersQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = "name_asc" | "name_desc" | "subhubs_asc" | "subhubs_desc" | "status";

export default function Hubs() {
  const { data: superHubsData, isLoading } = useGetSuperHubs(undefined, {
    query: { queryKey: getGetSuperHubsQueryKey() },
  });

  const superHubs = superHubsData?.superHubs || [];
  const [isSuperModalOpen, setIsSuperModalOpen] = useState(false);
  const [editingSuperHub, setEditingSuperHub] = useState<any>(null);
  const [deleteSuperHubId, setDeleteSuperHubId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [sort, setSort] = useState<SortOption>("name_asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const stats = {
    total: superHubs.length,
    active: superHubs.filter((h) => h.status === "Active").length,
    totalSubHubs: superHubs.reduce((acc, h) => acc + h.subHubCount, 0),
  };

  const filtered = superHubs
    .filter((h) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || h.name.toLowerCase().includes(q) || (h.location || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || h.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name);
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "subhubs_asc") return a.subHubCount - b.subHubCount;
      if (sort === "subhubs_desc") return b.subHubCount - a.subHubCount;
      if (sort === "status") return a.status.localeCompare(b.status);
      return 0;
    });

  const pagedHubs = usePaginated(filtered, 20, `${search}|${statusFilter}|${sort}`);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-[#162B4D]">Super Hubs</h2>
          <p className="text-gray-500 text-sm mt-1">Manage your distribution network hierarchy</p>
        </div>
        <Button
          onClick={() => { setEditingSuperHub(null); setIsSuperModalOpen(true); }}
          className="bg-[#1A56DB] hover:bg-[#1447B4] text-white h-9 px-4 text-sm font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Super Hub
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Super Hubs", value: stats.total, color: "text-[#162B4D]" },
          { label: "Active Super Hubs", value: stats.active, color: "text-green-600" },
          { label: "Total Sub Hubs", value: stats.totalSubHubs, color: "text-[#1A56DB]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white px-5 py-4 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search, Sort, Filter Bar */}
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
              <SelectValue placeholder="Filter status" />
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
            <SelectTrigger className="h-9 w-44 text-sm border-gray-200 bg-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name (A → Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z → A)</SelectItem>
              <SelectItem value="subhubs_desc">Sub Hubs (Most)</SelectItem>
              <SelectItem value="subhubs_asc">Sub Hubs (Least)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(search || statusFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
            className="text-xs text-[#1A56DB] hover:underline font-medium"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">
            {filtered.length} of {superHubs.length} hub{superHubs.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button
              onClick={() => setViewMode("grid")}
              className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`}
              title="List view"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Hub Cards Grid / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-20 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{search || statusFilter !== "all" ? "No hubs match your filters" : "No super hubs yet"}</p>
          <p className="text-gray-400 text-sm mt-1">{search || statusFilter !== "all" ? "Try adjusting your search or filters" : 'Click "Add Super Hub" to get started'}</p>
        </div>
      ) : viewMode === "grid" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagedHubs.pageItems.map((hub) => (
              <SuperHubCard
                key={hub.id}
                hub={hub}
                onEdit={() => { setEditingSuperHub(hub); setIsSuperModalOpen(true); }}
                onDelete={() => setDeleteSuperHubId(hub.id)}
              />
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-4">
            <PaginationBar
              page={pagedHubs.page}
              pages={pagedHubs.pages}
              total={pagedHubs.total}
              onChange={pagedHubs.setPage}
              label="hubs"
            />
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {pagedHubs.pageItems.map((hub, i) => (
            <SuperHubRow
              key={hub.id}
              hub={hub}
              isLast={i === pagedHubs.pageItems.length - 1}
              onEdit={() => { setEditingSuperHub(hub); setIsSuperModalOpen(true); }}
              onDelete={() => setDeleteSuperHubId(hub.id)}
            />
          ))}
          <PaginationBar
            page={pagedHubs.page}
            pages={pagedHubs.pages}
            total={pagedHubs.total}
            onChange={pagedHubs.setPage}
            label="hubs"
          />
        </div>
      )}

      <SuperHubModal
        isOpen={isSuperModalOpen}
        onClose={() => setIsSuperModalOpen(false)}
        hub={editingSuperHub}
      />
      <DeleteSuperDialog hubId={deleteSuperHubId} onClose={() => setDeleteSuperHubId(null)} />
    </div>
  );
}

function SuperHubCard({ hub, onEdit, onDelete }: { hub: any; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const toggleStatus = useToggleSuperHubStatus();

  const handleToggle = () => {
    toggleStatus.mutate({ id: hub.id }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getGetSuperHubsQueryKey() });
      },
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="h-40 w-full relative bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
        {hub.imageUrl ? (
          <img src={hub.imageUrl} alt={hub.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-12 h-12 text-blue-200" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <h3 className="text-white text-lg font-bold drop-shadow">{hub.name}</h3>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/90 shadow-sm ${hub.status === "Active" ? "text-green-600" : "text-red-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${hub.status === "Active" ? "bg-green-500" : "bg-red-500"}`} />
            {hub.status}
          </span>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center text-gray-500 text-sm">
            <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400 flex-shrink-0" />
            <span className="truncate">{hub.location || "Location not set"}</span>
          </div>
          <span className="text-xs bg-blue-50 text-[#1A56DB] font-semibold px-2 py-0.5 rounded-full">
            {hub.subHubCount} Sub Hubs
          </span>
        </div>

        <div className="mt-auto pt-3 border-t border-gray-100 space-y-2">
          <Button
            onClick={() => setLocation(`/hubs/${hub.id}`)}
            className="w-full h-8 text-xs font-semibold bg-[#162B4D] hover:bg-[#1E3A5F] text-white gap-2"
            size="sm"
          >
            <Layers className="w-3.5 h-3.5" />
            View Sub Hubs
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-[#1A56DB] hover:border-blue-200 hover:bg-blue-50 transition-colors">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={hub.status === "Active"}
                onCheckedChange={handleToggle}
                className="data-[state=checked]:bg-[#1A56DB] scale-90"
              />
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 p-4">
          <SubHubsList superHubId={hub.id} superHubName={hub.name} />
        </div>
      )}
    </div>
  );
}

function SuperHubRow({ hub, isLast, onEdit, onDelete }: { hub: any; isLast: boolean; onEdit: () => void; onDelete: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const toggleStatus = useToggleSuperHubStatus();

  const handleToggle = () => {
    toggleStatus.mutate({ id: hub.id }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getGetSuperHubsQueryKey() });
      },
    });
  };

  return (
    <div className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors ${!isLast ? "border-b border-gray-100" : ""}`}>
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-50 to-indigo-100">
        {hub.imageUrl ? (
          <img src={hub.imageUrl} alt={hub.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#162B4D] text-sm truncate">{hub.name}</p>
        <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{hub.location || "Location not set"}</span>
        </div>
      </div>
      <span className="text-xs bg-blue-50 text-[#1A56DB] font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
        {hub.subHubCount} Sub Hubs
      </span>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${hub.status === "Active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${hub.status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
        {hub.status}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Switch checked={hub.status === "Active"} onCheckedChange={handleToggle} className="data-[state=checked]:bg-[#1A56DB] scale-75" />
        <button onClick={() => setLocation(`/hubs/${hub.id}`)} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-[#162B4D] hover:bg-gray-50 transition-colors" title="View Sub Hubs">
          <Layers className="w-3.5 h-3.5" />
        </button>
        <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-[#1A56DB] hover:border-blue-200 hover:bg-blue-50 transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function SubHubsList({ superHubId, superHubName }: { superHubId: string; superHubName: string }) {
  const { data, isLoading } = useGetSubHubsBySuperHub(superHubId, {
    query: { queryKey: getGetSubHubsBySuperHubQueryKey(superHubId) },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubHub, setEditingSubHub] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) return (
    <div className="space-y-2 py-1">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  );

  const subHubs = data?.subHubs || [];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Sub Hubs ({subHubs.length})</p>
        <Button variant="outline" size="sm" onClick={() => { setEditingSubHub(null); setIsModalOpen(true); }} className="h-6 text-xs px-2 bg-white border-dashed">
          <Plus className="w-3 h-3 mr-1" /> Add
        </Button>
      </div>
      {subHubs.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-2">No sub hubs yet</p>
      ) : (
        <div className="space-y-2">
          {subHubs.map((sub) => (
            <SubHubRow key={sub.id} sub={sub} onEdit={() => { setEditingSubHub(sub); setIsModalOpen(true); }} onDelete={() => setDeleteId(sub.id)} />
          ))}
        </div>
      )}
      <SubHubModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} subHub={editingSubHub} superHubId={superHubId} />
      <DeleteSubDialog subId={deleteId} onClose={() => setDeleteId(null)} superHubId={superHubId} />
    </div>
  );
}

function SubHubRow({ sub, onEdit, onDelete }: { sub: any; onEdit: () => void; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const toggleStatus = useToggleSubHubStatus();

  const handleToggle = () => {
    toggleStatus.mutate({ id: sub.id }, {
      onSuccess: () => {
        toast({ title: "Status updated" });
        queryClient.invalidateQueries({ queryKey: getGetSubHubsBySuperHubQueryKey(sub.superHubId) });
      },
    });
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1">
          <p className="text-sm font-semibold text-[#162B4D] truncate">{sub.name}</p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${sub.status === "Active" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
            {sub.status}
          </span>
        </div>
        {sub.location && <p className="text-xs text-gray-500 mb-1.5 truncate">{sub.location}</p>}
        <div className="flex flex-wrap gap-1">
          {(sub.pincodes as string[])?.slice(0, 3).map((p) => (
            <span key={p} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{p}</span>
          ))}
          {(sub.pincodes as string[])?.length > 3 && (
            <span className="text-[10px] text-gray-400">+{sub.pincodes.length - 3} more</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <Switch checked={sub.status === "Active"} onCheckedChange={handleToggle} className="scale-75 origin-right data-[state=checked]:bg-[#1A56DB]" />
        <div className="flex gap-1">
          <button onClick={onEdit} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-[#1A56DB] hover:bg-blue-50 transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Modals ----

type UserEntry = { name: string; email: string; phone: string; role: "super_hub" | "sub_hub" };

function SuperHubModal({ isOpen, onClose, hub }: { isOpen: boolean; onClose: () => void; hub: any }) {
  const isEditing = !!hub;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSuperHub();
  const updateMutation = useUpdateSuperHub();
  const createUserMutation = useCreateUser();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [tab, setTab] = useState<"details" | "users">("details");
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [newUser, setNewUser] = useState<UserEntry>({ name: "", email: "", phone: "", role: "super_hub" });

  useEffect(() => {
    if (isOpen) {
      if (hub) {
        setName(hub.name); setLocation(hub.location || ""); setImageUrl(hub.imageUrl || "");
        setIsActive(hub.status === "Active");
      } else {
        setName(""); setLocation(""); setImageUrl(""); setIsActive(true);
      }
      setTab("details");
      setUsers([]);
      setNewUser({ name: "", email: "", phone: "", role: "super_hub" });
    }
  }, [isOpen, hub]);

  const addUser = () => {
    if (!newUser.name || !newUser.email) return;
    setUsers([...users, newUser]);
    setNewUser({ name: "", email: "", phone: "", role: "super_hub" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, location, imageUrl, status: isActive ? "Active" : ("Inactive" as const) };
    if (isEditing) {
      updateMutation.mutate({ id: hub.id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Super Hub updated" });
          queryClient.invalidateQueries({ queryKey: getGetSuperHubsQueryKey() });
          onClose();
        },
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: async (res) => {
          const superHubId = (res as any)?.superHub?.id;
          if (users.length > 0 && superHubId) {
            for (const u of users) {
              try {
                await createUserMutation.mutateAsync({ data: { ...u, superHubId: String(superHubId), status: "Active" } as any });
              } catch {}
            }
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          }
          toast({ title: `Super Hub created${users.length > 0 ? ` with ${users.length} user(s)` : ""}` });
          queryClient.invalidateQueries({ queryKey: getGetSuperHubsQueryKey() });
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-[#162B4D]">{isEditing ? "Edit Super Hub" : "Add Super Hub"}</DialogTitle>
        </DialogHeader>

        {!isEditing && (
          <div className="flex border-b border-gray-100 -mx-6 px-6 gap-4">
            {(["details", "users"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-2.5 text-sm font-semibold capitalize transition-colors border-b-2 ${tab === t ? "border-[#1A56DB] text-[#1A56DB]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {t === "details" ? "Hub Details" : `Add Users ${users.length > 0 ? `(${users.length})` : ""}`}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {tab === "details" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Hub Name *</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mumbai" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600">Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mumbai, Maharashtra" className="h-9" />
              </div>
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                folder="fishtokri/super-hubs"
                label="Hub Image"
              />
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <Label className="text-sm">Active</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-[#1A56DB]" />
              </div>
            </>
          )}

          {tab === "users" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Add users who will manage this super hub. You can also add them later from Admin Users.</p>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Name" className="h-8 text-sm" />
                  <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} placeholder="Phone (optional)" className="h-8 text-sm" />
                  <Select value={newUser.role} onValueChange={(v: any) => setNewUser({ ...newUser, role: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_hub">Super Hub Admin</SelectItem>
                      <SelectItem value="sub_hub">Sub Hub Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addUser} disabled={!newUser.name || !newUser.email} className="w-full h-8 text-xs">
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Add User
                </Button>
              </div>
              {users.length > 0 && (
                <div className="space-y-1.5">
                  {users.map((u, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-[#162B4D]">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email} · {u.role === "super_hub" ? "Super Hub Admin" : "Sub Hub Admin"}</p>
                      </div>
                      <button type="button" onClick={() => setUsers(users.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9">Cancel</Button>
            {tab === "details" && !isEditing ? (
              <Button type="button" onClick={() => setTab("users")} className="bg-[#1A56DB] hover:bg-[#1447B4] h-9">
                Next: Add Users
              </Button>
            ) : (
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#1A56DB] hover:bg-[#1447B4] h-9">
                {isEditing ? "Save Changes" : "Create Hub"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubHubModal({ isOpen, onClose, subHub, superHubId }: { isOpen: boolean; onClose: () => void; subHub: any; superHubId: string }) {
  const isEditing = !!subHub;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSubHub();
  const updateMutation = useUpdateSubHub();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pincodes, setPincodes] = useState<string[]>([]);
  const [pinInput, setPinInput] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (subHub) {
        setName(subHub.name); setLocation(subHub.location || "");
        setImageUrl((subHub as any).imageUrl || "");
        setPincodes(subHub.pincodes || []); setIsActive(subHub.status === "Active");
      } else {
        setName(""); setLocation(""); setImageUrl(""); setPincodes([]); setIsActive(true);
      }
      setPinInput("");
    }
  }, [isOpen, subHub]);

  const addPin = () => {
    const val = pinInput.trim();
    if (val && !pincodes.includes(val)) { setPincodes([...pincodes, val]); setPinInput(""); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { name, location, imageUrl, pincodes, status: isActive ? "Active" : ("Inactive" as const) };
    if (isEditing) {
      updateMutation.mutate({ id: subHub.id, data: payload }, {
        onSuccess: () => {
          toast({ title: "Sub Hub updated" });
          queryClient.invalidateQueries({ queryKey: getGetSubHubsBySuperHubQueryKey(superHubId) });
          onClose();
        },
      });
    } else {
      createMutation.mutate({ id: superHubId, data: payload as any }, {
        onSuccess: () => {
          toast({ title: "Sub Hub created" });
          queryClient.invalidateQueries({ queryKey: getGetSubHubsBySuperHubQueryKey(superHubId) });
          queryClient.invalidateQueries({ queryKey: getGetSuperHubsQueryKey() });
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[#162B4D]">{isEditing ? "Edit Sub Hub" : "Add Sub Hub"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Sub Hub Name *</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thane" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Thane, Mumbai" className="h-9" />
          </div>
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            folder="fishtokri/sub-hubs"
            label="Sub Hub Image"
          />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Service Areas (Pincodes)</Label>
            <div className="flex gap-2">
              <Input value={pinInput} onChange={(e) => setPinInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPin(); } }} placeholder="Type pincode & press Enter" className="h-9" />
              <Button type="button" variant="secondary" onClick={addPin} className="h-9 px-3 text-sm">Add</Button>
            </div>
            {pincodes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 p-2 bg-gray-50 rounded-lg">
                {pincodes.map((p) => (
                  <span key={p} onClick={() => setPincodes(pincodes.filter((x) => x !== p))}
                    className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full cursor-pointer hover:bg-red-50 hover:text-red-600 transition-colors font-medium">
                    {p} <X className="w-2.5 h-2.5" />
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <Label className="text-sm">Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-[#1A56DB]" />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9">Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#1A56DB] hover:bg-[#1447B4] h-9">
              {isEditing ? "Save Changes" : "Create Sub Hub"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSuperDialog({ hubId, onClose }: { hubId: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteSuperHub();
  return (
    <Dialog open={!!hubId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Super Hub</DialogTitle>
          <DialogDescription>This action cannot be undone. All associated sub hubs will also be removed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (!hubId) return; deleteMutation.mutate({ id: hubId }, { onSuccess: () => { toast({ title: "Deleted" }); queryClient.invalidateQueries({ queryKey: getGetSuperHubsQueryKey() }); onClose(); } }); }} className="bg-red-600 hover:bg-red-700 text-white" disabled={deleteMutation.isPending}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSubDialog({ subId, superHubId, onClose }: { subId: string | null; superHubId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteSubHub();
  return (
    <Dialog open={!!subId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Sub Hub</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (!subId) return; deleteMutation.mutate({ id: subId }, { onSuccess: () => { toast({ title: "Deleted" }); queryClient.invalidateQueries({ queryKey: getGetSubHubsBySuperHubQueryKey(superHubId) }); queryClient.invalidateQueries({ queryKey: getGetSuperHubsQueryKey() }); onClose(); } }); }} className="bg-red-600 hover:bg-red-700 text-white" disabled={deleteMutation.isPending}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
