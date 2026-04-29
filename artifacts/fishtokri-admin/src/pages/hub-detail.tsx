import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, MapPin, Plus, Edit2, Trash2, LayoutDashboard, X, Layers, Search, ArrowUpDown, SlidersHorizontal, LayoutGrid, LayoutList, Database,
} from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import {
  useGetSuperHubs,
  getGetSuperHubsQueryKey,
  useGetSubHubsBySuperHub,
  getGetSubHubsBySuperHubQueryKey,
  useCreateSubHub,
  useUpdateSubHub,
  useDeleteSubHub,
  useToggleSubHubStatus,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = "name_asc" | "name_desc" | "pincodes_asc" | "pincodes_desc" | "status";

function getAdminRole() {
  try {
    const raw = localStorage.getItem("fishtokri_admin");
    return raw ? JSON.parse(raw)?.role : null;
  } catch {
    return null;
  }
}

export default function HubDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const superHubId = params.id;
  const role = getAdminRole();
  const isSuperHub = role === "super_hub";

  const { data: superHubsData } = useGetSuperHubs(undefined, {
    query: { queryKey: getGetSuperHubsQueryKey() },
  });
  const superHub = superHubsData?.superHubs.find((h) => h.id === superHubId);

  const { data, isLoading } = useGetSubHubsBySuperHub(superHubId, {
    query: { queryKey: getGetSubHubsBySuperHubQueryKey(superHubId) },
  });

  const subHubs = data?.subHubs || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubHub, setEditingSubHub] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");
  const [sort, setSort] = useState<SortOption>("name_asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const stats = {
    total: subHubs.length,
    active: subHubs.filter((s) => s.status === "Active").length,
    totalPins: subHubs.reduce((acc, s) => acc + ((s as any).pincodes?.length ?? 0), 0),
  };

  const filtered = subHubs
    .filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.location || "").toLowerCase().includes(q) ||
        ((s as any).pincodes || []).some((p: string) => p.toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name);
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "pincodes_asc") return ((a as any).pincodes?.length ?? 0) - ((b as any).pincodes?.length ?? 0);
      if (sort === "pincodes_desc") return ((b as any).pincodes?.length ?? 0) - ((a as any).pincodes?.length ?? 0);
      if (sort === "status") return a.status.localeCompare(b.status);
      return 0;
    });

  const pagedSubs = usePaginated(filtered, 20, `${search}|${statusFilter}|${sort}`);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        {!isSuperHub && (
          <button
            onClick={() => setLocation("/hubs")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#162B4D] transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {superHub ? (
            <>
              <h2 className="text-2xl font-bold text-[#162B4D] flex items-center gap-2">
                {superHub.name}
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${superHub.status === "Active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {superHub.status}
                </span>
              </h2>
              <p className="text-gray-500 text-sm flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                {superHub.location || "Location not set"}
              </p>
            </>
          ) : (
            <Skeleton className="h-8 w-48" />
          )}
        </div>
        <Button
          onClick={() => { setEditingSubHub(null); setIsModalOpen(true); }}
          className="bg-[#1A56DB] hover:bg-[#1447B4] text-white h-9 px-4 text-sm font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Sub Hub
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sub Hubs", value: stats.total, color: "text-[#162B4D]" },
          { label: "Active", value: stats.active, color: "text-green-600" },
          { label: "Total Pincodes", value: stats.totalPins, color: "text-[#1A56DB]" },
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
            placeholder="Search by name, location or pincode..."
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
              <SelectItem value="pincodes_desc">Pincodes (Most)</SelectItem>
              <SelectItem value="pincodes_asc">Pincodes (Least)</SelectItem>
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
            {filtered.length} of {subHubs.length} sub hub{subHubs.length !== 1 ? "s" : ""}
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

      {/* Sub Hub Grid / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-20 text-center">
          <Layers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search || statusFilter !== "all" ? "No sub hubs match your filters" : "No sub hubs yet"}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {search || statusFilter !== "all" ? "Try adjusting your search or filters" : 'Click "Add Sub Hub" to create one'}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagedSubs.pageItems.map((sub) => (
              <SubHubCard
                key={sub.id}
                sub={sub as any}
                onEdit={() => { setEditingSubHub(sub); setIsModalOpen(true); }}
                onDelete={() => setDeleteId(sub.id)}
              />
            ))}
          </div>
          <PaginationBar
            page={pagedSubs.page}
            pages={pagedSubs.pages}
            total={pagedSubs.total}
            onChange={pagedSubs.setPage}
            label="sub hubs"
          />
        </>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {pagedSubs.pageItems.map((sub, i) => (
              <SubHubRow
                key={sub.id}
                sub={sub as any}
                isLast={i === pagedSubs.pageItems.length - 1}
                onEdit={() => { setEditingSubHub(sub); setIsModalOpen(true); }}
                onDelete={() => setDeleteId(sub.id)}
              />
            ))}
          </div>
          <PaginationBar
            page={pagedSubs.page}
            pages={pagedSubs.pages}
            total={pagedSubs.total}
            onChange={pagedSubs.setPage}
            label="sub hubs"
          />
        </>
      )}

      <SubHubModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        subHub={editingSubHub}
        superHubId={superHubId}
      />
      <DeleteSubDialog subId={deleteId} superHubId={superHubId} onClose={() => setDeleteId(null)} />
    </div>
  );
}

function SubHubCard({ sub, onEdit, onDelete }: { sub: any; onEdit: () => void; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="h-40 w-full relative bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden flex-shrink-0">
        {sub.imageUrl ? (
          <img src={sub.imageUrl} alt={sub.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className="w-10 h-10 text-blue-200" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-3 left-4">
          <h3 className="text-white text-base font-bold drop-shadow">{sub.name}</h3>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/90 shadow-sm ${sub.status === "Active" ? "text-green-600" : "text-red-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sub.status === "Active" ? "bg-green-500" : "bg-red-500"}`} />
            {sub.status}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center text-gray-500 text-xs mb-3">
          <MapPin className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
          <span className="truncate">{sub.location || "Location not set"}</span>
        </div>

        {sub.pincodes?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {sub.pincodes.slice(0, 4).map((p: string) => (
              <span key={p} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                {p}
              </span>
            ))}
            {sub.pincodes.length > 4 && (
              <span className="text-[10px] text-gray-400 px-1 py-0.5">+{sub.pincodes.length - 4} more</span>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-gray-100 space-y-2">
          <Button
            onClick={() => setLocation(`/sub-hub-menu/${sub.id}`)}
            className="w-full h-8 text-xs font-semibold bg-[#162B4D] hover:bg-[#1E3A5F] text-white gap-2"
            size="sm"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-[#1A56DB] hover:border-blue-200 hover:bg-blue-50 transition-colors">
                <Edit2 className="w-3 h-3" />
              </button>
              <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <Switch
              checked={sub.status === "Active"}
              onCheckedChange={handleToggle}
              className="data-[state=checked]:bg-[#1A56DB] scale-90"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SubHubRow({ sub, isLast, onEdit, onDelete }: { sub: any; isLast: boolean; onEdit: () => void; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
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
    <div className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50/50 transition-colors ${!isLast ? "border-b border-gray-100" : ""}`}>
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-50 to-indigo-100">
        {sub.imageUrl ? (
          <img src={sub.imageUrl} alt={sub.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers className="w-5 h-5 text-blue-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#162B4D] text-sm truncate">{sub.name}</p>
        <div className="flex items-center gap-1 text-gray-400 text-xs mt-0.5">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{sub.location || "Location not set"}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 max-w-[180px]">
        {(sub.pincodes || []).slice(0, 3).map((p: string) => (
          <span key={p} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">{p}</span>
        ))}
        {(sub.pincodes || []).length > 3 && (
          <span className="text-[10px] text-gray-400">+{sub.pincodes.length - 3}</span>
        )}
      </div>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${sub.status === "Active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${sub.status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
        {sub.status}
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={() => setLocation(`/sub-hub-menu/${sub.id}`)}
          className="h-7 px-2 flex items-center gap-1 rounded border border-[#162B4D] bg-[#162B4D] text-white text-xs font-semibold hover:bg-[#1E3A5F] transition-colors"
        >
          <LayoutDashboard className="w-3 h-3" />
          Dashboard
        </button>
        <Switch checked={sub.status === "Active"} onCheckedChange={handleToggle} className="data-[state=checked]:bg-[#1A56DB] scale-75" />
        <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-[#1A56DB] hover:border-blue-200 hover:bg-blue-50 transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
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
  const [dbName, setDbName] = useState("");

  function computeDbName(n: string) {
    return n.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  }

  useEffect(() => {
    if (isOpen) {
      if (subHub) {
        setName(subHub.name); setLocation(subHub.location || "");
        setImageUrl((subHub as any).imageUrl || "");
        setPincodes(subHub.pincodes || []); setIsActive(subHub.status === "Active");
        setDbName((subHub as any).dbName || "");
      } else {
        setName(""); setLocation(""); setImageUrl(""); setPincodes([]); setIsActive(true); setDbName("");
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
    const payload = { name, location, imageUrl, pincodes, status: isActive ? "Active" : ("Inactive" as const), dbName: isEditing ? dbName : undefined };
    if (isEditing) {
      updateMutation.mutate({ id: subHub.id, data: payload as any }, {
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
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
              <Database className="w-3 h-3" />
              Database Name
            </Label>
            {isEditing ? (
              <Input value={dbName} onChange={(e) => setDbName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} placeholder="e.g. Thane" className="h-9 font-mono text-sm" />
            ) : (
              <div className="h-9 px-3 flex items-center rounded-md border border-gray-200 bg-gray-50 text-sm font-mono text-gray-500">
                {computeDbName(name) || <span className="text-gray-400 italic">auto-generated from name</span>}
              </div>
            )}
            <p className="text-[11px] text-gray-400">
              {isEditing ? "Only edit this if you need to link to an existing database (e.g. \"Thane\" for Thane)." : "Automatically set from the sub hub name. Cannot be changed after creation."}
            </p>
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
