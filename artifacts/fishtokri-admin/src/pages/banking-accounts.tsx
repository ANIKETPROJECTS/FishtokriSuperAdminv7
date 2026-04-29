import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Pencil, Trash2, Search, Landmark, ArrowUpDown, LayoutGrid, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";

type BankAccount = {
  id: string;
  accountName: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
  balance: number;
  createdAt?: string;
};

function getToken() { return localStorage.getItem("fishtokri_token") ?? ""; }

async function apiFetch(path: string, options: RequestInit = {}) {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data;
}

const emptyForm = { accountName: "", bankName: "", accountNo: "", ifscCode: "", balance: "" };

function ViewToggle({ view, onChange }: { view: "list" | "grid"; onChange: (v: "list" | "grid") => void }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
      {(["list", "grid"] as const).map((v) => (
        <button key={v} onClick={() => onChange(v)}
          className={`flex items-center justify-center w-8 h-8 transition-colors ${view === v ? "bg-[#162B4D] text-white" : "bg-white text-gray-400 hover:text-gray-700"}`}
          title={`${v === "list" ? "List" : "Grid"} view`}>
          {v === "list" ? <LayoutList className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      ))}
    </div>
  );
}

function AccountModal({ open, account, onClose, onSaved }: { open: boolean; account: BankAccount | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(account ? { accountName: account.accountName, bankName: account.bankName, accountNo: account.accountNo, ifscCode: account.ifscCode, balance: String(account.balance) } : emptyForm);
  }, [account, open]);

  const handleSave = async () => {
    if (!form.accountName.trim() || !form.bankName.trim()) {
      toast({ title: "Validation", description: "Account Name and Bank Name are required.", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, balance: parseFloat(form.balance) || 0 };
      if (account) {
        await apiFetch(`/api/banking/accounts/${account.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Updated", description: "Account updated successfully." });
      } else {
        await apiFetch("/api/banking/accounts", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Added", description: "Account added successfully." });
      }
      onSaved();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Account Name <span className="text-red-500">*</span></Label>
              <Input value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} placeholder="e.g. IndusInd Bank" />
            </div>
            <div className="space-y-1.5">
              <Label>Bank Name <span className="text-red-500">*</span></Label>
              <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="e.g. IndusInd Bank" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Account No.</Label>
              <Input value={form.accountNo} onChange={e => setForm(f => ({ ...f, accountNo: e.target.value }))} placeholder="e.g. 123456789" />
            </div>
            <div className="space-y-1.5">
              <Label>IFSC Code</Label>
              <Input value={form.ifscCode} onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value }))} placeholder="e.g. INDB0001234" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Opening Balance (₹)</Label>
            <Input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0.00" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1A56DB] hover:bg-[#1447B4]">
            {saving ? "Saving..." : account ? "Save Changes" : "Add Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BankingAccounts() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name_asc" | "name_desc" | "bal_high" | "bal_low">("newest");
  const [view, setView] = useState<"list" | "grid">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const load = async () => {
    setLoading(true);
    try { setAccounts(await apiFetch("/api/banking/accounts")); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const uniqueBanks = useMemo(() => [...new Set(accounts.map(a => a.bankName).filter(Boolean))].sort(), [accounts]);

  const filtered = useMemo(() => {
    let list = accounts.filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !q || a.accountName.toLowerCase().includes(q) || a.bankName.toLowerCase().includes(q) || a.accountNo.includes(q) || a.ifscCode.toLowerCase().includes(q);
      const matchBank = bankFilter === "all" || a.bankName === bankFilter;
      return matchSearch && matchBank;
    });
    const sorts: Record<string, (a: BankAccount, b: BankAccount) => number> = {
      newest: (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      oldest: (a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime(),
      name_asc: (a, b) => a.accountName.localeCompare(b.accountName),
      name_desc: (a, b) => b.accountName.localeCompare(a.accountName),
      bal_high: (a, b) => b.balance - a.balance,
      bal_low: (a, b) => a.balance - b.balance,
    };
    return [...list].sort(sorts[sortBy]);
  }, [accounts, search, bankFilter, sortBy]);

  const pagedAccounts = usePaginated(filtered, 20, `${search}|${bankFilter}|${sortBy}`);

  const totalBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const isFiltered = search || bankFilter !== "all" || sortBy !== "newest";

  const handleDelete = async (acc: BankAccount) => {
    if (!window.confirm(`Delete "${acc.accountName}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/banking/accounts/${acc.id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: `"${acc.accountName}" deleted.` });
      load();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#162B4D]">Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage bank accounts and petty cash.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-2 bg-[#1A56DB] hover:bg-[#1447B4]">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Accounts</p>
          <p className="text-3xl font-bold text-[#162B4D] mt-1">{accounts.length}</p>
          <p className="text-xs text-gray-400 mt-1">All registered accounts</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Balance</p>
          <p className="text-3xl font-bold text-[#162B4D] mt-1">₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">Combined balance across accounts</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h2 className="font-bold text-[#162B4D]">All Accounts</h2>
              <p className="text-xs text-gray-400 mt-0.5">{filtered.length} of {accounts.length} accounts</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="pl-9 w-48" />
              </div>
              <Select value={bankFilter} onValueChange={setBankFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All Banks" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banks</SelectItem>
                  {uniqueBanks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-44">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-gray-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name_asc">Name A → Z</SelectItem>
                  <SelectItem value="name_desc">Name Z → A</SelectItem>
                  <SelectItem value="bal_high">Balance High → Low</SelectItem>
                  <SelectItem value="bal_low">Balance Low → High</SelectItem>
                </SelectContent>
              </Select>
              {isFiltered && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setBankFilter("all"); setSortBy("newest"); }} className="text-gray-400 hover:text-gray-600 px-2">Reset</Button>
              )}
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading accounts...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Landmark className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-500 mt-3">{accounts.length === 0 ? "No accounts yet" : "No accounts match your filters"}</p>
            {accounts.length === 0 && (
              <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="mt-4 gap-2 bg-[#1A56DB] hover:bg-[#1447B4]">
                <Plus className="w-4 h-4" /> Add Account
              </Button>
            )}
          </div>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account No.</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IFSC Code</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Balance</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedAccounts.pageItems.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <p className="font-semibold text-[#162B4D]">{acc.accountName}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{acc.bankName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3 font-mono text-gray-600 text-xs">{acc.accountNo || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3 font-mono text-gray-600 text-xs">{acc.ifscCode || <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[#162B4D]">
                      ₹{(acc.balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(acc); setModalOpen(true); }} className="h-8 w-8 p-0"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(acc)} className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedAccounts.pageItems.map((acc) => (
              <div key={acc.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-white hover:shadow-md transition-all flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#162B4D] text-sm truncate">{acc.accountName}</p>
                      <p className="text-xs text-gray-400 truncate">{acc.bankName}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  {acc.accountNo && <p><span className="text-gray-400">Acct No: </span><span className="font-mono">{acc.accountNo}</span></p>}
                  {acc.ifscCode && <p><span className="text-gray-400">IFSC: </span><span className="font-mono">{acc.ifscCode}</span></p>}
                </div>
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Balance</p>
                    <p className="text-lg font-bold text-[#162B4D]">₹{(acc.balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(acc); setModalOpen(true); }} className="flex-1 h-8 gap-1.5 text-xs">
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(acc)} className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <PaginationBar
          page={pagedAccounts.page}
          pages={pagedAccounts.pages}
          total={pagedAccounts.total}
          onChange={pagedAccounts.setPage}
          label="accounts"
        />
      </div>

      <AccountModal open={modalOpen} account={editing} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); setEditing(null); load(); }} />
    </div>
  );
}
