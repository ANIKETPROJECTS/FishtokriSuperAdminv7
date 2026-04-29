import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Plus, ChevronRight, ChevronLeft, Pencil, X, CheckCircle2, Trash2, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function toInputDate(d: Date) {
  return d.toISOString().split("T")[0];
}

type VendorItem = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  itemType: string;
  categoryName: string;
  categoryId: string;
};

type VendorCategory = {
  id: string;
  name: string;
};

type AdjustmentItem = {
  itemId: string;
  itemName: string;
  unit: string;
  quantityBefore: number;
  newQuantity: number | string;
  quantityAdjusted: number;
};

type StockAdjustment = {
  id: string;
  date: string;
  superHubName?: string;
  subHubName?: string;
  voucherNumber: number;
  reason: string;
  notes: string;
  status: "draft" | "approved";
  createdBy: string;
  items: AdjustmentItem[];
};

type FormRow = {
  itemId: string;
  itemName: string;
  unit: string;
  quantityBefore: number;
  newQuantity: string;
  search: string;
  showDropdown: boolean;
};

const REASONS = [
  "Stock damaged",
  "Stock wastage",
  "Stocking New Inventory",
  "EXTRA SKU",
  "SKU TRANSFER",
  "Stock correction",
  "Other",
];

function ItemSelector({
  row,
  idx,
  allItems,
  categories,
  usedIds,
  onSelect,
  onClear,
  onSearchChange,
}: {
  row: FormRow;
  idx: number;
  allItems: VendorItem[];
  categories: VendorCategory[];
  usedIds: Set<string>;
  onSelect: (idx: number, item: VendorItem) => void;
  onClear: (idx: number) => void;
  onSearchChange: (idx: number, val: string, open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);

  const availableItems = allItems.filter(
    (item) => !(usedIds.has(item.id) && item.id !== row.itemId),
  );

  const grouped: Record<string, VendorItem[]> = {};
  for (const item of availableItems) {
    const cat = item.categoryName || "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const categoryNames = new Set<string>();
  for (const category of categories) {
    const name = category.name.trim();
    if (name) categoryNames.add(name);
  }
  for (const itemCategory of Object.keys(grouped)) {
    if (itemCategory.trim()) categoryNames.add(itemCategory);
  }
  const allCategories = Array.from(categoryNames).sort((a, b) => a.localeCompare(b));

  const q = row.search.trim().toLowerCase();
  const isSearching = q.length > 0;
  const searchResults = isSearching
    ? availableItems.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.categoryName.toLowerCase().includes(q),
      )
    : [];

  function doOpen() {
    if (!open) setSelectedCategory(null);
    setOpen(true);
  }

  function doClose() {
    setOpen(false);
    setSelectedCategory(null);
  }

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      doClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  let dropdownStyle: React.CSSProperties = { display: "none" };
  if (open && wrapperRef.current) {
    const r = wrapperRef.current.getBoundingClientRect();
    dropdownStyle = {
      position: "fixed",
      top: r.bottom + 4,
      left: r.left,
      width: isSearching ? Math.max(r.width, 272) : 560,
      zIndex: 9999,
    };
  }

  const dropdownContent = (
    <div
      ref={portalRef}
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
    >
      {isSearching ? (
        <>
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search results</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-400 text-center">No items found</div>
            ) : searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(idx, item); doClose(); }}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">{item.categoryName}</p>
                </div>
                <p className="text-xs font-semibold text-gray-500 flex-shrink-0">
                  {item.currentStock} <span className="font-normal text-gray-400">{item.unit}</span>
                </p>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-[260px_300px]">
          <div className="border-r border-gray-100">
            <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select Category</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {allCategories.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-400 text-center">No categories</div>
              ) : allCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onMouseEnter={() => setSelectedCategory(cat)}
                  onFocus={() => setSelectedCategory(cat)}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedCategory(cat); }}
                  className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-2 border-b border-gray-50 last:border-0 ${
                    selectedCategory === cat ? "bg-blue-50" : "hover:bg-blue-50"
                  }`}
                >
                  <span className="text-sm font-medium text-gray-800">{cat}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{grouped[cat]?.length ?? 0}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                {selectedCategory ?? "Hover a category"}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {selectedCategory === null ? (
                <div className="px-4 py-8 text-sm text-gray-400 text-center">Hover over a category to see items</div>
              ) : (grouped[selectedCategory] ?? []).length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-400 text-center">No items</div>
              ) : (grouped[selectedCategory] ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelect(idx, item); doClose(); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center justify-between gap-3 border-b border-gray-50 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.itemType || item.unit}</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-500 flex-shrink-0">
                    {item.currentStock} <span className="font-normal text-gray-400">{item.unit}</span>
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative w-full" onMouseEnter={doOpen}>
      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
      <input
        type="text"
        value={row.search}
        onChange={(e) => {
          onSearchChange(idx, e.target.value, true);
          setOpen(true);
        }}
        onFocus={doOpen}
        placeholder="Choose Item"
        className={`w-full h-9 pl-8 pr-8 text-sm border rounded-md outline-none transition-all
          focus:ring-2 focus:ring-blue-200 focus:border-blue-400
          ${row.itemId ? "bg-blue-50/40 border-blue-200 text-gray-800 font-medium" : "border-gray-200 bg-white text-gray-600"}
        `}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        {row.itemId ? (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onClear(idx); doClose(); }}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform pointer-events-none ${open ? "rotate-180" : ""}`} />
        )}
      </div>
      {open && createPortal(dropdownContent, document.body)}
    </div>
  );
}

export default function StockAdjustment() {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "form">("list");
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<VendorItem[]>([]);
  const [categories, setCategories] = useState<VendorCategory[]>([]);

  const [formDate, setFormDate] = useState(toInputDate(new Date()));
  const [formReason, setFormReason] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formRows, setFormRows] = useState<FormRow[]>([
    { itemId: "", itemName: "", unit: "", quantityBefore: 0, newQuantity: "", search: "", showDropdown: false },
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set("search", search);
      const data = await apiFetch(`/api/vendor-items/stock-adjustments?${params}`);
      setAdjustments(data.adjustments ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      toast({ title: "Failed to load stock adjustments", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, toast]);

  const loadItems = useCallback(async () => {
    try {
      const [itemData, categoryData] = await Promise.all([
        apiFetch("/api/vendor-items/items"),
        apiFetch("/api/vendor-items/categories"),
      ]);
      const loadedCategories: VendorCategory[] = (categoryData.categories ?? []).filter((c: any) => c.source === "master" || !c.source);
      const masterItems: VendorItem[] = (itemData.items ?? []).map((item: VendorItem) => ({ ...item }));
      setAllItems(masterItems);
      setCategories(loadedCategories);
    } catch {}
  }, []);

  useEffect(() => { loadAdjustments(); }, [loadAdjustments]);
  useEffect(() => { loadItems(); }, [loadItems]);

  function openAddForm() {
    setEditingId(null);
    setFormDate(toInputDate(new Date()));
    setFormReason("");
    setFormNotes("");
    setFormRows([{ itemId: "", itemName: "", unit: "", quantityBefore: 0, newQuantity: "", search: "", showDropdown: false }]);
    setView("form");
  }

  function openEditForm(adj: StockAdjustment) {
    setEditingId(adj.id);
    setFormDate(toInputDate(new Date(adj.date)));
    setFormReason(adj.reason);
    setFormNotes(adj.notes);
    setFormRows(
      adj.items.length > 0
        ? adj.items.map((it) => ({
            itemId: it.itemId,
            itemName: it.itemName,
            unit: it.unit,
            quantityBefore: it.quantityBefore,
            newQuantity: String(it.newQuantity),
            search: it.itemName,
            showDropdown: false,
          }))
        : [{ itemId: "", itemName: "", unit: "", quantityBefore: 0, newQuantity: "", search: "", showDropdown: false }],
    );
    setView("form");
  }

  function addRow() {
    setFormRows((rows) => [
      ...rows,
      { itemId: "", itemName: "", unit: "", quantityBefore: 0, newQuantity: "", search: "", showDropdown: false },
    ]);
  }

  function removeRow(index: number) {
    setFormRows((rows) => rows.filter((_, i) => i !== index));
  }

  function updateRow(index: number, patch: Partial<FormRow>) {
    setFormRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function selectItem(index: number, item: VendorItem) {
    setFormRows((rows) =>
      rows.map((r, i) =>
        i === index
          ? {
              ...r,
              itemId: item.id,
              itemName: item.name,
              unit: item.unit,
              quantityBefore: item.currentStock,
              search: item.name,
              showDropdown: false,
            }
          : r,
      ),
    );
  }

  function clearItem(index: number) {
    updateRow(index, { itemId: "", itemName: "", unit: "", quantityBefore: 0, search: "", showDropdown: false });
  }

  function onSearchChange(index: number, val: string, open: boolean) {
    updateRow(index, { search: val, showDropdown: open, itemId: "", itemName: "", unit: "", quantityBefore: 0 });
  }

  async function handleSave() {
    const validRows = formRows.filter((r) => r.itemId && r.newQuantity !== "");
    if (validRows.length === 0) {
      toast({ title: "Add at least one item", variant: "destructive" });
      return;
    }
    if (!formReason.trim()) {
      toast({ title: "Reason is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: formDate,
        reason: formReason,
        notes: formNotes,
        items: validRows.map((r) => ({
          itemId: r.itemId,
          source: "master",
          newQuantity: Number(r.newQuantity),
        })),
      };
      if (editingId) {
        await apiFetch(`/api/vendor-items/stock-adjustments/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Stock adjustment updated" });
      } else {
        await apiFetch("/api/vendor-items/stock-adjustments", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Stock adjustment saved" });
      }
      setView("list");
      loadAdjustments();
      loadItems();
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/vendor-items/stock-adjustments/${id}`, { method: "DELETE" });
      toast({ title: "Stock adjustment deleted" });
      setDeleteId(null);
      loadAdjustments();
      loadItems();
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    }
  }

  const usedIds = new Set(formRows.map((r) => r.itemId).filter(Boolean));

  if (view === "form") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("list")}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-bold text-[#162B4D]">
            {editingId ? "Edit Stock Adjustment" : "Add Stock Adjustment"}
          </h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Reason <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Enter reason"
                className="h-9"
                list="reason-datalist"
              />
              <datalist id="reason-datalist">
                {REASONS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Write notes here..."
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="w-full overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "38%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "6%" }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Item Details <span className="text-red-500">*</span>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty Available</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">New Qty On Hand</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty Adjusted</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formRows.map((row, idx) => {
                    const newQtyNum = row.newQuantity === "" ? NaN : Number(row.newQuantity);
                    const adjusted = isNaN(newQtyNum) ? null : newQtyNum - row.quantityBefore;

                    return (
                      <tr key={idx} className="hover:bg-gray-50/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <ItemSelector
                            row={row}
                            idx={idx}
                            allItems={allItems}
                            categories={categories}
                            usedIds={usedIds}
                            onSelect={selectItem}
                            onClear={clearItem}
                            onSearchChange={onSearchChange}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-sm text-gray-600 font-medium">
                            {row.unit || <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-sm text-gray-700">
                            {row.itemId ? row.quantityBefore : <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            value={row.newQuantity}
                            onChange={(e) => updateRow(idx, { newQuantity: e.target.value })}
                            placeholder="0"
                            disabled={!row.itemId}
                            min={0}
                            className={`w-full h-9 px-3 text-sm text-center border rounded-md outline-none transition-all
                              focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                              ${!row.itemId ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" : "border-gray-200 bg-white"}
                            `}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {adjusted !== null ? (
                            <span className={`text-sm font-bold ${adjusted > 0 ? "text-emerald-600" : adjusted < 0 ? "text-red-500" : "text-gray-400"}`}>
                              {adjusted > 0 ? `+${adjusted}` : adjusted}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={formRows.length === 1}
                            className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-[#1A56DB] hover:text-[#1447B4] font-medium px-1 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Row
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button variant="outline" onClick={() => setView("list")} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1A56DB] hover:bg-[#1447B4] min-w-[80px]"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#162B4D]">Stock Adjustment</h1>
          <p className="text-sm text-gray-500 mt-1">Increase or decrease stock levels for multiple items at once.</p>
        </div>
        <Button onClick={openAddForm} className="gap-2 bg-[#1A56DB] hover:bg-[#1447B4]">
          <Plus className="w-4 h-4" />
          Add Stock Adjustment
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-[#162B4D]">Stock Adjustments</h2>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{total}</span>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by reason..."
              className="pl-9 h-9 w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Voucher No</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created By</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading...</td>
                </tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    No stock adjustments found.{" "}
                    <button onClick={openAddForm} className="text-[#1A56DB] hover:underline">Add one now.</button>
                  </td>
                </tr>
              ) : (
                adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700">{formatDate(adj.date)}</td>
                    <td className="px-4 py-3 text-gray-700 font-mono">{adj.voucherNumber}</td>
                    <td className="px-4 py-3 text-gray-700">{adj.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {adj.items.slice(0, 3).map((it, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                            {it.itemName}
                            <span className={`ml-1 font-semibold ${it.quantityAdjusted > 0 ? "text-emerald-600" : it.quantityAdjusted < 0 ? "text-red-500" : "text-gray-400"}`}>
                              ({it.quantityAdjusted > 0 ? `+${it.quantityAdjusted}` : it.quantityAdjusted})
                            </span>
                          </span>
                        ))}
                        {adj.items.length > 3 && <span className="text-xs text-gray-400">+{adj.items.length - 3} more</span>}
                        {adj.items.length === 0 && <span className="text-gray-400 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{adj.createdBy}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEditForm(adj)} className="h-8 w-8 p-0" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteId(adj.id)} className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:border-red-200" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} Results</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p)}
                  className={`h-8 w-8 p-0 ${p === page ? "bg-[#162B4D] hover:bg-[#1e3a6e] text-white" : ""}`}
                >
                  {p}
                </Button>
              ))}
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 w-8 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Stock Adjustment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This will reverse all stock changes made by this adjustment. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
