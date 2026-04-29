import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FolderPlus, Pencil, Trash2, Search, Boxes, ArrowUpDown, LayoutGrid, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";

type VendorCategory = {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive";
  createdAt?: string;
  source: "master" | "subhub";
  subHubs: string[];
  subHubCount: number;
};

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

export default function VendorCategories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<VendorCategory[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"name_asc" | "name_desc" | "newest" | "oldest" | "items_high" | "items_low">("name_asc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VendorCategory | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [catData, itemData] = await Promise.all([
        apiFetch("/api/vendor-items/categories"),
        apiFetch("/api/vendor-items/items"),
      ]);
      const cats: VendorCategory[] = (catData.categories ?? []).filter((c: VendorCategory) => c.source === "master");
      setCategories(cats);
      const counts: Record<string, number> = {};
      for (const cat of cats) counts[cat.id] = 0;
      for (const item of itemData.items ?? []) {
        if (counts[item.categoryId] !== undefined) counts[item.categoryId]++;
      }
      setItemCounts(counts);
    } catch (err: any) {
      toast({ title: "Failed to load categories", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = categories.filter((c) => {
      const matchSearch = !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest": return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
        case "oldest": return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
        case "name_asc": return a.name.localeCompare(b.name);
        case "name_desc": return b.name.localeCompare(a.name);
        case "items_high": return (itemCounts[b.id] ?? 0) - (itemCounts[a.id] ?? 0);
        case "items_low": return (itemCounts[a.id] ?? 0) - (itemCounts[b.id] ?? 0);
        default: return 0;
      }
    });
    return result;
  }, [categories, search, statusFilter, sortBy, itemCounts]);

  const pagedCategories = usePaginated(filtered, 20, `${search}|${statusFilter}|${sortBy}`);

  const handleDelete = async (cat: VendorCategory) => {
    const count = itemCounts[cat.id] ?? 0;
    if (count > 0) {
      toast({ title: "Cannot delete", description: `Move or delete the ${count} item(s) in "${cat.name}" first.`, variant: "destructive" });
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await apiFetch(`/api/vendor-items/categories/${cat.id}`, { method: "DELETE" });
      toast({ title: "Category deleted" });
      load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const hasActiveFilters = search || statusFilter !== "all" || sortBy !== "name_asc";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#162B4D]">Vendor Item Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage categories for vendor items in Vendor Management.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-2 bg-[#1A56DB] hover:bg-[#1447B4]">
          <FolderPlus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Total Categories</p>
          <p className="text-2xl font-bold text-[#162B4D] mt-2">{categories.length}</p>
          <p className="text-xs text-gray-500 mt-1">Created here</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Total Items</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{Object.values(itemCounts).reduce((a, b) => a + b, 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Across all categories</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h2 className="font-bold text-[#162B4D]">All Categories</h2>
            <p className="text-xs text-gray-400 mt-0.5">{filtered.length} of {categories.length} categories</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="pl-9 w-48"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-40">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name A → Z</SelectItem>
                <SelectItem value="name_desc">Name Z → A</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="items_high">Most Items</SelectItem>
                <SelectItem value="items_low">Fewest Items</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setStatusFilter("all"); setSortBy("name_asc"); }}
                className="text-gray-400 hover:text-gray-600 px-2"
              >
                Reset
              </Button>
            )}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center justify-center w-8 h-8 transition-colors ${viewMode === "list" ? "bg-[#162B4D] text-white" : "bg-white text-gray-400 hover:text-gray-700"}`}
                title="List view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center w-8 h-8 transition-colors ${viewMode === "grid" ? "bg-[#162B4D] text-white" : "bg-white text-gray-400 hover:text-gray-700"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading categories...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FolderOpen className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-500 mt-3">
              {categories.length === 0 ? "No categories yet" : "No categories match your filters"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {categories.length === 0 ? "Add your first vendor item category to get started." : "Try adjusting the search or filters."}
            </p>
            {categories.length === 0 && (
              <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="mt-4 gap-2 bg-[#1A56DB] hover:bg-[#1447B4]">
                <FolderPlus className="w-4 h-4" /> Add Category
              </Button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date Added</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedCategories.pageItems.map((cat) => {
                  const dateAdded = cat.createdAt ? new Date(cat.createdAt) : null;
                  const dateLabel = dateAdded ? dateAdded.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                  const timeLabel = dateAdded ? dateAdded.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
                  return (
                    <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600">
                            <FolderOpen className="w-4 h-4" />
                          </div>
                          <p className="font-semibold text-[#162B4D]">{cat.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs">
                        {cat.description || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Boxes className="w-3.5 h-3.5 text-gray-400" />
                          <span>{itemCounts[cat.id] ?? 0}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-sm text-gray-700">{dateLabel}</p>
                        {timeLabel && <p className="text-xs text-gray-400 mt-0.5">{timeLabel}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cat.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {cat.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(cat); setModalOpen(true); }} className="h-8 w-8 p-0">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(cat)} className="h-8 w-8 p-0 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedCategories.pageItems.map((cat) => {
              const dateAdded = cat.createdAt ? new Date(cat.createdAt) : null;
              const dateLabel = dateAdded ? dateAdded.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
              const timeLabel = dateAdded ? dateAdded.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
              const count = itemCounts[cat.id] ?? 0;
              return (
                <div key={cat.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-white hover:shadow-md transition-all flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-50 text-amber-600">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-[#162B4D] text-sm leading-tight truncate">{cat.name}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                      {cat.status}
                    </span>
                  </div>

                  {cat.description ? (
                    <p className="text-xs text-gray-500 line-clamp-2">{cat.description}</p>
                  ) : (
                    <p className="text-xs text-gray-300 italic">No description</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-3 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-gray-400" />
                      <span>{count} item{count !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">{dateLabel}</p>
                      {timeLabel && <p className="text-gray-400">{timeLabel}</p>}
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-gray-100 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditing(cat); setModalOpen(true); }}
                      className="flex-1 h-8 gap-1.5 text-xs"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(cat)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <PaginationBar
          page={pagedCategories.page}
          pages={pagedCategories.pages}
          total={pagedCategories.total}
          onChange={pagedCategories.setPage}
          label="categories"
        />
      </div>

      <CategoryModal
        open={modalOpen}
        category={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function CategoryModal({ open, category, onClose, onSaved }: {
  open: boolean;
  category: VendorCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setStatus(category?.status ?? "active");
  }, [open, category]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim(), linkedSubHubCategoryNames: [], status };
      if (category) {
        await apiFetch(`/api/vendor-items/categories/${category.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Category updated" });
      } else {
        await apiFetch("/api/vendor-items/categories", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Category created" });
      }
      onSaved();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Category Name *</Label>
            <Input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Raw Chicken, Whole Fish, Packaging"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1A56DB] resize-none"
              rows={3}
              placeholder="What type of vendor items belong here?"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: "active" | "inactive") => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#1A56DB] hover:bg-[#1447B4]">
              {saving ? "Saving..." : category ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
