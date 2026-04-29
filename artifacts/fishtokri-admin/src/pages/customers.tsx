import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Plus, Search, Edit2, Trash2, Mail, Phone, Calendar,
  ArrowUpDown, SlidersHorizontal, X, LayoutGrid, LayoutList,
  MapPin, ShoppingBag, ChevronLeft, ChevronRight, Users,
  Eye, Home, Clock, CheckCircle2, ClipboardList, Package,
  CreditCard, Truck, UserRound, ChevronDown, ChevronUp, Tag,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function getToken() {
  return localStorage.getItem("fishtokri_token") || "";
}

function getBase() {
  return import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
}

const CUSTOMERS_QUERY_KEY = ["customers"] as const;
const ACTIVE_ORDER_STATUSES = new Set(["pending", "confirmed", "preparing", "out_for_delivery"]);

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  dateOfBirth: string;
  gender?: string;
  notes?: string;
  addresses: any[];
  orders: any[];
  usedCoupons?: any[];
  currentOrders?: any[];
  orderHistory?: any[];
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

interface CustomersResponse {
  customers: Customer[];
  total: number;
  page: number;
  limit: number;
}

async function fetchCustomers(params: {
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<CustomersResponse> {
  const base = getBase();
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`${base}/api/customers?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

async function fetchCustomer(id: string): Promise<Customer> {
  const base = getBase();
  const res = await fetch(`${base}/api/customers/${id}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Failed to fetch customer");
  return json.customer;
}

async function createCustomer(data: Partial<Customer>): Promise<Customer> {
  const base = getBase();
  const res = await fetch(`${base}/api/customers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to create customer");
  return json.customer;
}

async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
  const base = getBase();
  const res = await fetch(`${base}/api/customers/${id}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to update customer");
  return json.customer;
}

async function deleteCustomer(id: string): Promise<void> {
  const base = getBase();
  const res = await fetch(`${base}/api/customers/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.message || "Failed to delete customer");
  }
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
}

function formatDate(dateStr: any) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(dateStr);
  }
}

function formatDateTime(dateStr: any) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(dateStr);
  }
}

function formatRupees(value: any) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString("en-IN")}`;
}

function normalize(value: any) {
  return String(value ?? "").trim().toLowerCase();
}

function getOrderId(order: any) {
  return String(order?._id ?? order?.id ?? order?.orderId ?? order?.orderNumber ?? "");
}

function getOrderTotal(order: any) {
  if (order?.total !== undefined) return Number(order.total) || 0;
  if (order?.totalAmount !== undefined) return Number(order.totalAmount) || 0;
  if (order?.amount !== undefined) return Number(order.amount) || 0;
  return (order?.items ?? []).reduce((sum: number, item: any) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
}

function getStatusStyle(status: any) {
  const value = normalize(status);
  if (["delivered", "completed", "paid"].includes(value)) return "bg-green-50 text-green-700 border-green-200";
  if (["cancelled", "canceled", "failed", "rejected"].includes(value)) return "bg-red-50 text-red-700 border-red-200";
  if (["out_for_delivery", "shipped", "dispatch", "dispatched"].includes(value)) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (["confirmed", "preparing", "processing"].includes(value)) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function splitOrders(customer: Customer) {
  const orders = Array.isArray(customer.orders) ? customer.orders : [];
  const current = Array.isArray(customer.currentOrders) ? customer.currentOrders : orders.filter((o) => ACTIVE_ORDER_STATUSES.has(normalize(o?.status)));
  const history = Array.isArray(customer.orderHistory) ? customer.orderHistory : orders.filter((o) => !ACTIVE_ORDER_STATUSES.has(normalize(o?.status)));
  return { current, history, all: orders };
}

function stringifyValue(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function addressText(address: any) {
  if (!address) return "—";
  if (typeof address === "string") return address;
  const parts = [
    address.name,
    address.label,
    address.type,
    address.houseNo,
    address.house,
    address.flatNo,
    address.apartment,
    address.building,
    address.street,
    address.addressLine1,
    address.addressLine2,
    address.area,
    address.landmark,
    address.city,
    address.state,
    address.pincode,
    address.zipCode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : JSON.stringify(address, null, 2);
}

function statusLabel(status: any) {
  return String(status || "unknown").replace(/_/g, " ");
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState("createdAt_desc");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const LIMIT = 20;
  const searchTimeout = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (searchTimeout[0]) clearTimeout(searchTimeout[0]);
    searchTimeout[1](
      setTimeout(() => {
        setDebouncedSearch(val);
        setPage(1);
      }, 400)
    );
  }, [searchTimeout]);

  const queryKey = [...CUSTOMERS_QUERY_KEY, debouncedSearch, sort, page];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchCustomers({ search: debouncedSearch, sort, page, limit: LIMIT }),
  });

  const customers = data?.customers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      toast({ title: "Customer deleted" });
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
      setDeleteCustomerId(null);
      setSelectedCustomer(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const hasFilters = debouncedSearch || sort !== "createdAt_desc";

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSort("createdAt_desc");
    setPage(1);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#162B4D]">Customers</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage all registered customers with saved addresses, current orders and order history. {total > 0 && <span className="font-medium text-[#162B4D]">{total} total</span>}
          </p>
        </div>
        <Button
          onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
          className="bg-[#1A56DB] hover:bg-[#1447B4] text-white h-9 px-4 text-sm font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 bg-white border-gray-200 h-9 text-sm"
          />
          {search && (
            <button onClick={() => handleSearchChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-44 text-sm border-gray-200 bg-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt_desc">Newest first</SelectItem>
              <SelectItem value="createdAt_asc">Oldest first</SelectItem>
              <SelectItem value="name_asc">Name (A → Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z → A)</SelectItem>
              <SelectItem value="email_asc">Email (A → Z)</SelectItem>
              <SelectItem value="email_desc">Email (Z → A)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-[#1A56DB] hover:underline font-medium flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">{customers.length} of {total}</span>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button onClick={() => setViewMode("list")} className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`} title="List view">
              <LayoutList className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setViewMode("grid")} className={`w-8 h-8 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`} title="Grid view">
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {viewMode === "grid" ? (
        isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState search={debouncedSearch} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customers.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                onView={() => setSelectedCustomer(c)}
                onEdit={() => openEdit(c)}
                onDelete={() => setDeleteCustomerId(c.id)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">Customer</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">Contact</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">Date of Birth</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">Addresses</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">Current</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">History</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">Joined</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider py-3">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-gray-400 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-gray-300" />
                        <p>No customers found{debouncedSearch ? ` for "${debouncedSearch}"` : ""}.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => {
                    const { current, history } = splitOrders(c);
                    return (
                      <TableRow key={c.id} className="hover:bg-gray-50/40 border-gray-100">
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 flex-shrink-0">
                              <AvatarFallback className={`text-sm font-bold ${getAvatarColor(c.name || "?")}`}>
                                {c.name ? getInitials(c.name) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-[#162B4D] text-sm">{c.name || "—"}</p>
                              <p className="text-[11px] text-gray-400">ID: {c.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="space-y-0.5">
                            {c.email && <div className="flex items-center gap-1 text-gray-500 text-xs"><Mail className="w-3 h-3 flex-shrink-0" /><span>{c.email}</span></div>}
                            {c.phone && <div className="flex items-center gap-1 text-gray-400 text-xs"><Phone className="w-3 h-3 flex-shrink-0" /><span>{c.phone}</span></div>}
                          </div>
                        </TableCell>
                        <TableCell className="py-4"><div className="flex items-center gap-1 text-gray-500 text-xs"><Calendar className="w-3 h-3 flex-shrink-0" /><span>{c.dateOfBirth || "—"}</span></div></TableCell>
                        <TableCell className="py-4"><CounterBadge icon={MapPin} count={c.addresses?.length ?? 0} className="bg-blue-50 text-blue-700" /></TableCell>
                        <TableCell className="py-4"><CounterBadge icon={Clock} count={current.length} className="bg-indigo-50 text-indigo-700" /></TableCell>
                        <TableCell className="py-4"><CounterBadge icon={ShoppingBag} count={history.length} className="bg-amber-50 text-amber-700" /></TableCell>
                        <TableCell className="py-4 text-xs text-gray-500">{formatDate(c.createdAt)}</TableCell>
                        <TableCell className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setSelectedCustomer(c)} className="w-8 h-8 flex items-center justify-center rounded border border-blue-200 text-[#1A56DB] hover:bg-blue-50 transition-colors" title="View everything">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEdit(c)} className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-[#1A56DB] hover:border-blue-200 hover:bg-blue-50 transition-colors" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteCustomerId(c.id)} className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {!isLoading && total > LIMIT && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {totalPages} &mdash; {total} customers</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-8 px-3 text-sm">
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-8 px-3 text-sm">
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <CustomerDetailDialog
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onEdit={(customer) => openEdit(customer)}
        onDelete={(customer) => setDeleteCustomerId(customer.id)}
      />
      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={editingCustomer}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })}
      />
      <DeleteCustomerDialog
        customerId={deleteCustomerId}
        onClose={() => setDeleteCustomerId(null)}
        onConfirm={() => { if (deleteCustomerId) deleteMutation.mutate(deleteCustomerId); }}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function CounterBadge({ icon: Icon, count, className }: { icon: any; count: number; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      <Icon className="w-3 h-3" />
      {count}
    </span>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 py-20 text-center">
      <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 font-medium">{search ? `No customers match "${search}"` : "No customers yet."}</p>
    </div>
  );
}

function CustomerCard({ customer: c, onView, onEdit, onDelete }: { customer: Customer; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const { current, history } = splitOrders(c);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className={`text-sm font-bold ${getAvatarColor(c.name || "?")}`}>{c.name ? getInitials(c.name) : "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#162B4D] text-sm truncate">{c.name || "—"}</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.createdAt)}</p>
        </div>
      </div>
      <div className="space-y-1">
        {c.email && <div className="flex items-center gap-1.5 text-gray-500 text-xs"><Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.email}</span></div>}
        {c.phone && <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Phone className="w-3 h-3 flex-shrink-0" /><span>{c.phone}</span></div>}
        {c.dateOfBirth && <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Calendar className="w-3 h-3 flex-shrink-0" /><span>{c.dateOfBirth}</span></div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Addresses" value={c.addresses?.length ?? 0} icon={MapPin} />
        <MiniStat label="Current" value={current.length} icon={Clock} />
        <MiniStat label="History" value={history.length} icon={ShoppingBag} />
      </div>
      <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-1.5">
        <button onClick={onView} className="h-7 px-2 flex items-center gap-1 rounded border border-blue-200 text-[#1A56DB] bg-blue-50 hover:bg-blue-100 transition-colors text-xs font-semibold">
          <Eye className="w-3.5 h-3.5" /> View all
        </button>
        <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-[#1A56DB] hover:border-blue-200 hover:bg-blue-50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 mb-1" />
      <p className="text-sm font-bold text-[#162B4D]">{value}</p>
      <p className="text-[10px] text-gray-400 truncate">{label}</p>
    </div>
  );
}

function CustomerDetailDialog({ customer, onClose, onEdit, onDelete }: { customer: Customer | null; onClose: () => void; onEdit: (customer: Customer) => void; onDelete: (customer: Customer) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["customer", customer?.id],
    queryFn: () => fetchCustomer(customer!.id),
    enabled: !!customer?.id,
    initialData: customer ?? undefined,
  });

  const fullCustomer = data ?? customer;
  const { current, history, all } = useMemo(() => fullCustomer ? splitOrders(fullCustomer) : { current: [], history: [], all: [] }, [fullCustomer]);
  const totalSpend = all.reduce((sum: number, order: any) => sum + getOrderTotal(order), 0);

  return (
    <Dialog open={!!customer} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-6xl max-h-[92vh] overflow-y-auto">
        {fullCustomer && (
          <>
            <DialogHeader>
              <DialogTitle className="text-[#162B4D] flex items-center gap-2">
                <UserRound className="w-5 h-5" />
                Customer Details
              </DialogTitle>
              <DialogDescription>Complete customer profile, saved addresses, current orders and order history.</DialogDescription>
            </DialogHeader>

            {isLoading && <Skeleton className="h-2 w-full" />}
            {error && <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm p-3">Showing cached customer data because the latest details could not be loaded.</div>}

            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-gradient-to-r from-blue-50 to-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-14 w-14">
                      <AvatarFallback className={`text-lg font-bold ${getAvatarColor(fullCustomer.name || "?")}`}>{fullCustomer.name ? getInitials(fullCustomer.name) : "?"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold text-[#162B4D]">{fullCustomer.name || "Unnamed customer"}</h3>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1"><Phone className="w-4 h-4 text-gray-400" />{fullCustomer.phone || "No phone"}</span>
                        <span className="inline-flex items-center gap-1"><Mail className="w-4 h-4 text-gray-400" />{fullCustomer.email || "No email"}</span>
                        <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4 text-gray-400" />DOB: {fullCustomer.dateOfBirth || "—"}</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">Customer ID: {fullCustomer.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(fullCustomer)} className="gap-1.5"><Edit2 className="w-3.5 h-3.5" />Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete(fullCustomer)} className="gap-1.5 text-red-600 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" />Delete</Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SummaryCard label="Addresses" value={fullCustomer.addresses?.length ?? 0} icon={Home} color="text-blue-600" />
                <SummaryCard label="Current Orders" value={current.length} icon={Clock} color="text-indigo-600" />
                <SummaryCard label="Order History" value={history.length} icon={CheckCircle2} color="text-green-600" />
                <SummaryCard label="All Orders" value={all.length} icon={ClipboardList} color="text-amber-600" />
                <SummaryCard label="Total Spend" value={formatRupees(totalSpend)} icon={CreditCard} color="text-emerald-600" />
              </div>

              <DetailSection title="Personal & Account Details" icon={UserRound}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoRow label="Name" value={fullCustomer.name} />
                  <InfoRow label="Email" value={fullCustomer.email} />
                  <InfoRow label="Phone" value={fullCustomer.phone} />
                  <InfoRow label="Date of Birth" value={fullCustomer.dateOfBirth} />
                  <InfoRow label="Created" value={formatDateTime(fullCustomer.createdAt)} />
                  <InfoRow label="Updated" value={formatDateTime(fullCustomer.updatedAt)} />
                </div>
              </DetailSection>

              <DetailSection title={`Saved Addresses (${fullCustomer.addresses?.length ?? 0})`} icon={MapPin}>
                {fullCustomer.addresses?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fullCustomer.addresses.map((address: any, index: number) => (
                      <AddressCard key={index} address={address} index={index} />
                    ))}
                  </div>
                ) : <EmptyPanel text="No saved addresses found for this customer." />}
              </DetailSection>

              <CollapsibleDetailSection title={`Current Orders (${current.length})`} icon={Clock} defaultOpen={current.length > 0 && current.length <= 5}>
                <OrderList orders={current} empty="No current or active orders found for this customer." />
              </CollapsibleDetailSection>

              <CollapsibleDetailSection title={`Order History (${history.length})`} icon={ShoppingBag} defaultOpen={false}>
                <OrderList orders={history} empty="No completed, cancelled or past orders found for this customer." />
              </CollapsibleDetailSection>

              <CollapsibleDetailSection title={`Used Coupons (${fullCustomer.usedCoupons?.length ?? 0})`} icon={Tag} defaultOpen={true}>
                <UsedCouponsList coupons={fullCustomer.usedCoupons ?? []} />
              </CollapsibleDetailSection>

            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: any; icon: any; color: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <p className="text-lg font-bold text-[#162B4D]">{value}</p>
      <p className="text-xs text-gray-400 font-medium">{label}</p>
    </div>
  );
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
      <h4 className="flex items-center gap-2 text-sm font-bold text-[#162B4D] mb-3"><Icon className="w-4 h-4 text-[#1A56DB]" />{title}</h4>
      {children}
    </section>
  );
}

function CollapsibleDetailSection({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left"
      >
        <h4 className="flex items-center gap-2 text-sm font-bold text-[#162B4D]">
          <Icon className="w-4 h-4 text-[#1A56DB]" />
          {title}
        </h4>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function UsedCouponsList({ coupons }: { coupons: any[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("used_desc");
  const [locationFilter, setLocationFilter] = useState("all");
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const allLocations = useMemo(() => {
    const s = new Set<string>();
    coupons.forEach((c) => { const loc = c.location || c.subHub || c.area || ""; if (loc) s.add(loc); });
    return Array.from(s);
  }, [coupons]);

  const filtered = useMemo(() => {
    let result = coupons;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((c) => {
        const code = (c.code || c.couponCode || "").toLowerCase();
        const loc = (c.location || c.subHub || c.area || "").toLowerCase();
        return code.includes(q) || loc.includes(q);
      });
    }
    if (locationFilter !== "all") {
      result = result.filter((c) => (c.location || c.subHub || c.area || "") === locationFilter);
    }
    result = [...result].sort((a, b) => {
      const aUsed = a.usedCount ?? a.used ?? 0;
      const bUsed = b.usedCount ?? b.used ?? 0;
      if (sort === "used_asc") return aUsed - bUsed;
      if (sort === "code_asc") return (a.code || "").localeCompare(b.code || "");
      if (sort === "recent") return new Date(b.lastUsedAt || 0).getTime() - new Date(a.lastUsedAt || 0).getTime();
      return bUsed - aUsed;
    });
    return result;
  }, [coupons, search, sort, locationFilter]);

  if (!coupons.length) return <EmptyPanel text="No coupons used by this customer." />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search coupons..."
            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#1A56DB] focus:border-[#1A56DB]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-7 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 outline-none focus:ring-1 focus:ring-[#1A56DB]"
        >
          <option value="used_desc">Most used</option>
          <option value="used_asc">Least used</option>
          <option value="recent">Recently used</option>
          <option value="code_asc">Code (A → Z)</option>
        </select>
        {allLocations.length > 0 && (
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="h-7 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 outline-none focus:ring-1 focus:ring-[#1A56DB]"
          >
            <option value="all">All locations</option>
            {allLocations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        )}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white ml-auto">
          <button
            onClick={() => setLayout("grid")}
            className={`w-7 h-7 flex items-center justify-center transition-colors ${layout === "grid" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`}
            title="Grid view"
          >
            <LayoutGrid className="w-3 h-3" />
          </button>
          <button
            onClick={() => setLayout("list")}
            className={`w-7 h-7 flex items-center justify-center transition-colors ${layout === "list" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`}
            title="List view"
          >
            <LayoutList className="w-3 h-3" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyPanel text="No coupons match your search or filters." />
      ) : (
        <div className={layout === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2"}>
          {filtered.map((coupon: any, index: number) => {
            const code = coupon.code || coupon.couponCode || "—";
            const usedCount = coupon.usedCount ?? coupon.used ?? 0;
            const maxAllowed = coupon.maxAllowed ?? coupon.maxUses ?? null;
            const location = coupon.location || coupon.subHub || coupon.area || "";
            const lastUsedAt = coupon.lastUsedAt || coupon.lastUsed || "";
            const couponId = String(coupon.couponId || coupon._id || "");
            return (
              <div key={index} className="rounded-xl border border-gray-100 bg-white p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Tag className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-block bg-green-50 text-green-700 text-sm font-bold px-2.5 py-1 rounded-lg tracking-wider font-mono border border-green-100">
                      {code}
                    </span>
                    <span className="inline-block bg-gray-50 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full border border-gray-100">
                      Used {usedCount} time{usedCount !== 1 ? "s" : ""}
                      {maxAllowed !== null ? ` / ${maxAllowed} max` : ""}
                    </span>
                  </div>
                  {location && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span>{location}</span>
                    </div>
                  )}
                  {lastUsedAt && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>Last used: {formatDateTime(lastUsedAt)}</span>
                    </div>
                  )}
                  {couponId && (
                    <p className="text-[10px] text-gray-300 font-mono">ID: {couponId}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length < coupons.length && (
        <p className="text-xs text-gray-400 text-center">Showing {filtered.length} of {coupons.length} coupons</p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-medium text-[#162B4D] mt-1 break-words whitespace-pre-wrap">{stringifyValue(value)}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-gray-200 bg-white py-8 text-center text-sm text-gray-400">{text}</div>;
}

function AddressCard({ address, index }: { address: any; index: number }) {
  if (!address) return null;
  if (typeof address === "string") {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><MapPin className="w-4 h-4 text-blue-600" /></div>
        <p className="text-sm text-gray-700">{address}</p>
      </div>
    );
  }
  const label = address.label || address.type || `Address ${index + 1}`;
  const contactName = address.name || address.contactName || "";
  const phone = address.phone || address.contactPhone || address.mobile || "";
  const houseNo = address.houseNo || address.flatNo || address.house || address.apartment || "";
  const building = address.building || address.buildingName || address.society || "";
  const street = address.street || address.streetName || address.road || address.addressLine1 || "";
  const area = address.area || address.locality || address.neighbourhood || "";
  const landmark = address.landmark || "";
  const city = address.city || "";
  const state = address.state || "";
  const pincode = address.pincode || address.zipCode || address.zip || "";
  const instructions = address.instructions || address.deliveryInstructions || "";

  const addressLines = [
    [houseNo, building].filter(Boolean).join(", "),
    [street, area].filter(Boolean).join(", "),
    landmark ? `Near ${landmark}` : "",
    [city, state, pincode].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <MapPin className="w-4 h-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full mb-2 capitalize">{label}</span>
          {contactName && <p className="text-sm font-semibold text-[#162B4D]">{contactName}</p>}
          {phone && <p className="text-xs text-gray-500 mt-0.5">{phone}</p>}
          <div className="mt-2 space-y-0.5">
            {addressLines.map((line, i) => (
              <p key={i} className="text-sm text-gray-700">{line}</p>
            ))}
          </div>
          {instructions && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-100">
              Delivery note: {instructions}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const ORDER_SORT_OPTIONS = [
  { value: "date_desc", label: "Newest first" },
  { value: "date_asc", label: "Oldest first" },
  { value: "amount_desc", label: "Highest amount" },
  { value: "amount_asc", label: "Lowest amount" },
  { value: "status_asc", label: "Status (A → Z)" },
];

function OrderList({ orders, empty }: { orders: any[]; empty: string }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [layout, setLayout] = useState<"list" | "grid">("list");

  const allStatuses = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => { if (o.status) s.add(normalize(o.status)); });
    return Array.from(s);
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((o) => {
        const ref = shortOrderRef(o, 0).toLowerCase();
        const items = (Array.isArray(o.items) ? o.items : []).map((i: any) => (i.name || i.productName || "").toLowerCase()).join(" ");
        const addr = addressText(o.deliveryAddress || o.address || "").toLowerCase();
        return ref.includes(q) || items.includes(q) || addr.includes(q) || normalize(o.status).includes(q);
      });
    }
    if (statusFilter !== "all") {
      result = result.filter((o) => normalize(o.status) === statusFilter);
    }
    result = [...result].sort((a, b) => {
      if (sort === "date_asc") return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (sort === "amount_desc") return getOrderTotal(b) - getOrderTotal(a);
      if (sort === "amount_asc") return getOrderTotal(a) - getOrderTotal(b);
      if (sort === "status_asc") return normalize(a.status).localeCompare(normalize(b.status));
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return result;
  }, [orders, search, sort, statusFilter]);

  if (!orders.length) return <EmptyPanel text={empty} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-[#1A56DB] focus:border-[#1A56DB]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-7 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 outline-none focus:ring-1 focus:ring-[#1A56DB]"
        >
          {ORDER_SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-7 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 outline-none focus:ring-1 focus:ring-[#1A56DB]"
        >
          <option value="all">All statuses</option>
          {allStatuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white ml-auto">
          <button
            onClick={() => setLayout("list")}
            className={`w-7 h-7 flex items-center justify-center transition-colors ${layout === "list" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`}
            title="List view"
          >
            <LayoutList className="w-3 h-3" />
          </button>
          <button
            onClick={() => setLayout("grid")}
            className={`w-7 h-7 flex items-center justify-center transition-colors ${layout === "grid" ? "bg-[#162B4D] text-white" : "text-gray-400 hover:bg-gray-50"}`}
            title="Grid view"
          >
            <LayoutGrid className="w-3 h-3" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyPanel text="No orders match your search or filters." />
      ) : layout === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((order, index) => (
            <OrderCardCompact key={getOrderId(order) || index} order={order} index={index} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order, index) => (
            <OrderCard key={getOrderId(order) || index} order={order} index={index} />
          ))}
        </div>
      )}

      {filtered.length < orders.length && (
        <p className="text-xs text-gray-400 text-center">Showing {filtered.length} of {orders.length} orders</p>
      )}
    </div>
  );
}

function OrderCardCompact({ order, index }: { order: any; index: number }) {
  const ref = shortOrderRef(order, index);
  const items = Array.isArray(order.items) ? order.items : [];
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-bold text-[#162B4D] text-xs flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-gray-400" />{ref}
        </p>
        <span className={`inline-flex border items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${getStatusStyle(order.status)}`}>
          {statusLabel(order.status)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400">{formatDateTime(order.createdAt || order.orderDate)}</p>
        <span className="text-xs font-bold text-[#162B4D]">{formatRupees(getOrderTotal(order))}</span>
      </div>
      {items.length > 0 && (
        <p className="text-[10px] text-gray-500 mt-1.5 truncate">
          {items.map((i: any) => i.name || i.productName || "Item").join(", ")}
        </p>
      )}
    </div>
  );
}

function shortOrderRef(order: any, index: number) {
  const id = getOrderId(order);
  if (order.orderNumber) return `#${order.orderNumber}`;
  if (id && id.length >= 8) return `#${id.slice(-8).toUpperCase()}`;
  return `Order ${index + 1}`;
}

function OrderCard({ order, index }: { order: any; index: number }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const ref = shortOrderRef(order, index);
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-bold text-[#162B4D] flex items-center gap-2"><Package className="w-4 h-4 text-gray-400" />{ref}</p>
          <p className="text-xs text-gray-400 mt-1">{formatDateTime(order.createdAt || order.orderDate || order.date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex border items-center px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusStyle(order.status)}`}>{statusLabel(order.status)}</span>
          <span className="inline-flex border border-gray-200 bg-gray-50 text-gray-600 items-center px-2 py-1 rounded-full text-xs font-semibold">{formatRupees(getOrderTotal(order))}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="space-y-2">
          <OrderMeta icon={Truck} label="Delivery" value={[order.deliveryType, order.timeslotLabel, order.deliveryArea].filter(Boolean).join(" · ") || "—"} />
          <OrderMeta icon={MapPin} label="Address" value={order.address || addressText(order.deliveryAddress) || "—"} />
          <OrderMeta icon={CreditCard} label="Payment" value={[order.paymentMethod, order.paymentStatus].filter(Boolean).join(" · ") || "—"} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Items ({items.length})</p>
          {items.length ? (
            <div className="space-y-1.5">
              {items.map((item: any, itemIndex: number) => (
                <div key={itemIndex} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                  <span className="font-medium text-[#162B4D] break-words">{item.name || item.productName || item.title || `Item ${itemIndex + 1}`}</span>
                  <span className="text-gray-500 whitespace-nowrap">x{item.quantity ?? 1} · {formatRupees(item.price ?? item.total ?? 0)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-400">No item details saved.</p>}
        </div>
      </div>
      {order.notes && <p className="mt-3 rounded-lg bg-amber-50 text-amber-700 text-xs p-2">Notes: {order.notes}</p>}
    </div>
  );
}

function OrderMeta({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-start gap-2 text-gray-600">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm text-[#162B4D] whitespace-pre-wrap break-words">{stringifyValue(value)}</p>
      </div>
    </div>
  );
}

type AddressDraft = {
  label: string;
  type: string;
  name: string;
  phone: string;
  building: string;
  street: string;
  area: string;
  pincode: string;
  instructions: string;
  isDefault: boolean;
};

function emptyAddress(): AddressDraft {
  return {
    label: "Home", type: "house",
    name: "", phone: "",
    building: "", street: "", area: "",
    pincode: "", instructions: "", isDefault: false,
  };
}

function addressFromExisting(a: any): AddressDraft {
  const existingHouse = a?.houseNo ?? a?.flatNo ?? a?.house ?? a?.apartment ?? "";
  const existingBuilding = a?.building ?? a?.buildingName ?? a?.society ?? "";
  const combinedBuilding = [existingHouse, existingBuilding].filter(Boolean).join(", ");
  return {
    label: a?.label ?? a?.type ?? "Home",
    type: a?.type ?? "house",
    name: a?.name ?? a?.contactName ?? "",
    phone: a?.phone ?? a?.contactPhone ?? a?.mobile ?? "",
    building: combinedBuilding,
    street: a?.street ?? a?.streetName ?? a?.road ?? a?.addressLine1 ?? "",
    area: a?.area ?? a?.locality ?? a?.neighbourhood ?? "",
    pincode: a?.pincode ?? a?.zipCode ?? a?.zip ?? "",
    instructions: a?.instructions ?? a?.deliveryInstructions ?? "",
    isDefault: !!a?.isDefault,
  };
}

function CustomerModal({
  isOpen, onClose, customer, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onSuccess: () => void;
}) {
  const isEditing = !!customer;
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [addresses, setAddresses] = useState<AddressDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = useCallback(() => {
    setName(customer?.name ?? "");
    setEmail(customer?.email ?? "");
    setPhone(customer?.phone ?? "");
    setDob(customer?.dateOfBirth ?? "");
    setAddresses(
      Array.isArray(customer?.addresses) && customer!.addresses.length
        ? customer!.addresses.map(addressFromExisting)
        : []
    );
    setErrors({});
  }, [customer]);

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, reset]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Customer>) => createCustomer(data),
    onSuccess: () => {
      toast({ title: "Customer created successfully" });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Customer>) => updateCustomer(customer!.id, data),
    onSuccess: () => {
      toast({ title: "Customer updated successfully" });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateAddress = (idx: number, patch: Partial<AddressDraft>) => {
    setAddresses((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const setDefaultAddress = (idx: number) => {
    setAddresses((prev) => prev.map((a, i) => ({ ...a, isDefault: i === idx })));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!phone.trim()) e.phone = "Phone is required";
    else if (!/^\d{10}$/.test(phone.trim())) e.phone = "Phone must be exactly 10 digits";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Invalid email format";
    if (dob.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) e.dob = "Use YYYY-MM-DD format";
    addresses.forEach((a, i) => {
      const hasAny = a.name || a.phone || a.building || a.street || a.area || a.pincode;
      if (hasAny) {
        if (!a.name.trim()) e[`addr_${i}_name`] = "Full name is required";
        if (!a.phone.trim()) e[`addr_${i}_phone`] = "Phone is required";
        else if (!/^\d{10}$/.test(a.phone.trim())) e[`addr_${i}_phone`] = "Phone must be 10 digits";
        if (!a.building.trim()) e[`addr_${i}_building`] = "Building / Flat No is required";
        if (!a.area.trim()) e[`addr_${i}_area`] = "Area / Suburb is required";
        if (!a.pincode.trim()) e[`addr_${i}_pincode`] = "Pincode required";
        else if (!/^\d{6}$/.test(a.pincode.trim())) e[`addr_${i}_pincode`] = "Pincode must be 6 digits";
      }
    });
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast({ title: "Please fix the highlighted errors", variant: "destructive" });
      return;
    }
    const cleanAddresses = addresses
      .map((a) => {
        const out: Record<string, any> = {};
        (Object.keys(a) as (keyof AddressDraft)[]).forEach((k) => {
          const v = a[k];
          if (typeof v === "string") { if (v.trim()) out[k] = v.trim(); }
          else if (v) out[k] = v;
        });
        return out;
      })
      .filter((a) => Object.keys(a).filter((k) => k !== "label" && k !== "type").length > 0);

    const payload: any = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      dateOfBirth: dob.trim(),
      addresses: cleanAddresses,
    };
    if (isEditing) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#162B4D]">{isEditing ? "Edit Customer" : "Add Customer"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the customer's profile, contact info and saved addresses." : "Capture the customer's full profile, contact info and one or more delivery addresses."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
            <h4 className="text-sm font-bold text-[#162B4D] mb-3 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-[#1A56DB]" />Personal details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Full name" required error={errors.name}>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={errors.name ? "border-red-400" : ""} />
              </Field>
              <Field label="Phone" required error={errors.phone}>
                <Input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" className={errors.phone ? "border-red-400" : ""} />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={errors.email ? "border-red-400" : ""} />
              </Field>
              <Field label="Date of birth" error={errors.dob}>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={errors.dob ? "border-red-400" : ""} />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#162B4D] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#1A56DB]" />
                Addresses ({addresses.length})
              </h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAddresses((prev) => [...prev, emptyAddress()])}
                className="h-8 gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add address
              </Button>
            </div>

            {addresses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-white py-6 text-center text-xs text-gray-400">
                No addresses yet. Click "Add address" to add one or more delivery locations.
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((a, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Address {i + 1}</span>
                        {a.isDefault && (
                          <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!a.isDefault && (
                          <button
                            type="button"
                            onClick={() => setDefaultAddress(i)}
                            className="text-[11px] text-[#1A56DB] hover:underline font-medium"
                          >
                            Make default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setAddresses((prev) => prev.filter((_, j) => j !== i))}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                          title="Remove address"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Full Name" required={!!(a.name || a.phone || a.building || a.street || a.area || a.pincode)} error={errors[`addr_${i}_name`]}>
                        <Input
                          value={a.name}
                          onChange={(e) => updateAddress(i, { name: e.target.value })}
                          placeholder="Recipient name"
                          className={errors[`addr_${i}_name`] ? "border-red-400" : ""}
                        />
                      </Field>
                      <Field label="Phone" required={!!(a.name || a.phone || a.building || a.street || a.area || a.pincode)} error={errors[`addr_${i}_phone`]}>
                        <Input
                          value={a.phone}
                          onChange={(e) => updateAddress(i, { phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                          placeholder="10-digit mobile"
                          className={errors[`addr_${i}_phone`] ? "border-red-400" : ""}
                        />
                      </Field>
                      <Field label="Building / Flat No" required={!!(a.name || a.phone || a.building || a.street || a.area || a.pincode)} error={errors[`addr_${i}_building`]}>
                        <Input
                          value={a.building}
                          onChange={(e) => updateAddress(i, { building: e.target.value })}
                          placeholder="Wing A, Flat 302, Building Name"
                          className={errors[`addr_${i}_building`] ? "border-red-400" : ""}
                        />
                      </Field>
                      <Field label="Street / Locality">
                        <Input value={a.street} onChange={(e) => updateAddress(i, { street: e.target.value })} placeholder="Street name or society" />
                      </Field>
                      <Field label="Area / Suburb" required={!!(a.name || a.phone || a.building || a.street || a.area || a.pincode)} error={errors[`addr_${i}_area`]}>
                        <Input
                          value={a.area}
                          onChange={(e) => updateAddress(i, { area: e.target.value })}
                          placeholder="e.g. Thane West"
                          className={errors[`addr_${i}_area`] ? "border-red-400" : ""}
                        />
                      </Field>
                      <Field label="Pincode" required={!!(a.name || a.phone || a.building || a.street || a.area || a.pincode)} error={errors[`addr_${i}_pincode`]}>
                        <Input
                          value={a.pincode}
                          onChange={(e) => updateAddress(i, { pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                          placeholder="6-digit pincode"
                          className={errors[`addr_${i}_pincode`] ? "border-red-400" : ""}
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Address Type">
                          <Select value={a.label || "Home"} onValueChange={(v) => updateAddress(i, { label: v, type: v.toLowerCase() })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Home">Home</SelectItem>
                              <SelectItem value="Work">Work</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <div className="md:col-span-2">
                        <Field label="Delivery Instructions">
                          <Input value={a.instructions} onChange={(e) => updateAddress(i, { instructions: e.target.value })} placeholder="Leave at door, ring bell twice, etc." />
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); reset(); }} disabled={isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending} className="bg-[#1A56DB] hover:bg-[#1447B4] text-white">
            {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function DeleteCustomerDialog({
  customerId, onClose, onConfirm, isPending,
}: {
  customerId: string | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={!!customerId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[#162B4D]">Delete Customer</DialogTitle>
          <DialogDescription>This will permanently remove the customer. This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>{isPending ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
