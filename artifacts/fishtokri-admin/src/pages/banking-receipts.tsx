import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, Plus, Pencil, Trash2, Search, ArrowUpDown, LayoutGrid, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PaginationBar } from "@/components/pagination-bar";
import { usePaginated } from "@/hooks/use-paginated";

type Receipt = {
  id: string;
  date: string;
  paymentMode: string;
  depositAccountName: string;
  oppositeAccountName: string;
  amount: number;
  notes: string;
  createdAt?: string;
};

type BankAccount = { id: string; accountName: string };

const PAYMENT_MODES = ["CASH", "CHEQUE", "NEFT", "RTGS", "IMPS", "GPAY", "GPAY B", "PAYTM", "PHONEPE", "CREDIT CARD", "DEBIT CARD", "UPI", "OTHER"];

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

const emptyForm = { date: "", paymentMode: "", depositAccountName: "", oppositeAccountName: "", amount: "", notes: "" };

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

function ReceiptModal({ open, receipt, accounts, onClose, onSaved }: { open: boolean; receipt: Receipt | null; accounts: BankAccount[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (receipt) {
      setForm({ date: receipt.date ? receipt.date.slice(0, 10) : "", paymentMode: receipt.paymentMode, depositAccountName: receipt.depositAccountName, oppositeAccountName: receipt.oppositeAccountName, amount: String(receipt.amount), notes: receipt.notes });
    } else {
      setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    }
  }, [receipt, open]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.date || !form.paymentMode || !form.depositAccountName || !form.oppositeAccountName || !form.amount) {
      toast({ title: "Validation", description: "Date, Payment Mode, Deposit Account, Opposite Account and Amount are required.", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) || 0 };
      if (receipt) {
        await apiFetch(`/api/banking/receipts/${receipt.id}`, { method: "PUT", body: JSON.stringify(payload) });
        toast({ title: "Updated", description: "Receipt updated." });
      } else {
        await apiFetch("/api/banking/receipts", { method: "POST", body: JSON.stringify(payload) });
        toast({ title: "Added", description: "Receipt added." });
      }
      onSaved();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{receipt ? "Edit Receipt" : "Add Receipt"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date <span className="text-red-500">*</span></Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Mode <span className="text-red-500">*</span></Label>
              <Select value={form.paymentMode} onValueChange={v => set("paymentMode", v)}>
                <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Deposit Account Name <span className="text-red-500">*</span></Label>
            {accounts.length > 0 ? (
              <Select value={form.depositAccountName} onValueChange={v => set("depositAccountName", v)}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.accountName}>{a.accountName}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input value={form.depositAccountName} onChange={e => set("depositAccountName", e.target.value)} placeholder="e.g. IndusInd Bank" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Opposite Account Name <span className="text-red-500">*</span></Label>
            <Input value={form.oppositeAccountName} onChange={e => set("oppositeAccountName", e.target.value)} placeholder="e.g. Rajani Nair" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹) <span className="text-red-500">*</span></Label>
            <Input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#1A56DB] hover:bg-[#1447B4]">
            {saving ? "Saving..." : receipt ? "Save Changes" : "Add Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BankingReceipts() {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "amt_high" | "amt_low">("newest");
  const [view, setView] = useState<"list" | "grid">("list");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([apiFetch("/api/banking/receipts"), apiFetch("/api/banking/accounts")]);
      setReceipts(r); setAccounts(a);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const uniqueModes = useMemo(() => [...new Set(receipts.map(r => r.paymentMode).filter(Boolean))].sort(), [receipts]);
  const uniqueAccounts = useMemo(() => [...new Set(receipts.map(r => r.depositAccountName).filter(Boolean))].sort(), [receipts]);

  const filtered = useMemo(() => {
    let list = receipts.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.paymentMode.toLowerCase().includes(q) || r.depositAccountName.toLowerCase().includes(q) || r.oppositeAccountName.toLowerCase().includes(q);
      const matchMode = modeFilter === "all" || r.paymentMode === modeFilter;
      const matchAccount = accountFilter === "all" || r.depositAccountName === accountFilter;
      return matchSearch && matchMode && matchAccount;
    });
    const sorts: Record<string, (a: Receipt, b: Receipt) => number> = {
      newest: (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      oldest: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      amt_high: (a, b) => b.amount - a.amount,
      amt_low: (a, b) => a.amount - b.amount,
    };
    return [...list].sort(sorts[sortBy]);
  }, [receipts, search, modeFilter, accountFilter, sortBy]);

  const pagedReceipts = usePaginated(filtered, 20, `${search}|${modeFilter}|${accountFilter}|${sortBy}`);

  const totalAmount = receipts.reduce((s, r) => s + (r.amount ?? 0), 0);
  const isFiltered = search || modeFilter !== "all" || accountFilter !== "all" || sortBy !== "newest";
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const handleDelete = async (rec: Receipt) => {
    if (!window.confirm("Delete this receipt? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/banking/receipts/${rec.id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Receipt deleted." }); load();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#162B4D]">Receipts</h1>
          <p className="text-sm text-gray-500 mt-1">Track all incoming payments and receipts.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="gap-2 bg-[#1A56DB] hover:bg-[#1447B4]">
          <Plus className="w-4 h-4" /> Add Receipt
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Receipts</p>
          <p className="text-3xl font-bold text-[#162B4D] mt-1">{receipts.length}</p>
          <p className="text-xs text-gray-400 mt-1">All recorded receipts</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Amount</p>
          <p className="text-3xl font-bold text-green-600 mt-1">₹{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">Sum of all receipts</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <h2 className="font-bold text-[#162B4D]">Receipts <span className="ml-1.5 text-gray-400 font-normal text-sm">{filtered.length} of {receipts.length}</span></h2>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipts..." className="pl-9 w-44" />
              </div>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All Modes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  {uniqueModes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All Accounts" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {uniqueAccounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-40">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-gray-400" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="amt_high">Amount High → Low</SelectItem>
                  <SelectItem value="amt_low">Amount Low → High</SelectItem>
                </SelectContent>
              </Select>
              {isFiltered && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setModeFilter("all"); setAccountFilter("all"); setSortBy("newest"); }} className="text-gray-400 hover:text-gray-600 px-2">Reset</Button>
              )}
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading receipts...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ArrowDownCircle className="w-10 h-10 mx-auto text-gray-300" />
            <p className="text-sm font-semibold text-gray-500 mt-3">{receipts.length === 0 ? "No receipts yet" : "No receipts match your filters"}</p>
            {receipts.length === 0 && (
              <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="mt-4 gap-2 bg-[#1A56DB] hover:bg-[#1447B4]">
                <Plus className="w-4 h-4" /> Add Receipt
              </Button>
            )}
          </div>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Mode</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deposit Account</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Opposite Account</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Amount</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedReceipts.pageItems.map(rec => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{fmtDate(rec.date)}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{rec.paymentMode}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{rec.depositAccountName}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{rec.oppositeAccountName}</td>
                    <td className="px-5 py-3 text-right font-semibold text-green-700">
                      ₹{rec.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(rec); setModalOpen(true); }} className="h-8 w-8 p-0"><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(rec)} className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagedReceipts.pageItems.map(rec => (
              <div key={rec.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 hover:bg-white hover:shadow-md transition-all flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                      <ArrowDownCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{fmtDate(rec.date)}</p>
                      <p className="font-bold text-[#162B4D] text-sm">{rec.oppositeAccountName}</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{rec.paymentMode}</span>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p><span className="text-gray-400">Deposit: </span>{rec.depositAccountName}</p>
                  {rec.notes && <p className="text-gray-400 italic">{rec.notes}</p>}
                </div>
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Amount</p>
                    <p className="text-lg font-bold text-green-700">₹{rec.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(rec); setModalOpen(true); }} className="h-8 gap-1 text-xs px-2"><Pencil className="w-3 h-3" /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(rec)} className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <PaginationBar
          page={pagedReceipts.page}
          pages={pagedReceipts.pages}
          total={pagedReceipts.total}
          onChange={pagedReceipts.setPage}
          label="receipts"
        />
      </div>

      <ReceiptModal open={modalOpen} receipt={editing} accounts={accounts} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); setEditing(null); load(); }} />
    </div>
  );
}
