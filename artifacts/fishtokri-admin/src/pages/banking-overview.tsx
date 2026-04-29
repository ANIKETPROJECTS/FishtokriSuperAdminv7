import { useEffect, useState } from "react";
import { Landmark, Building2, ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getToken() { return localStorage.getItem("fishtokri_token") ?? ""; }

async function apiFetch(path: string) {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data;
}

type BankAccount = { id: string; accountName: string; bankName: string; balance: number; createdAt?: string };
type Tx = { id: string; date: string; paymentMode: string; depositAccountName: string; oppositeAccountName: string; amount: number };

const PAYMENT_MODE_COLORS: Record<string, string> = {
  CASH: "bg-green-100 text-green-700",
  GPAY: "bg-blue-100 text-blue-700",
  "GPAY B": "bg-blue-100 text-blue-700",
  PAYTM: "bg-indigo-100 text-indigo-700",
  PHONEPE: "bg-purple-100 text-purple-700",
  NEFT: "bg-amber-100 text-amber-700",
  RTGS: "bg-amber-100 text-amber-700",
  IMPS: "bg-orange-100 text-orange-700",
  CHEQUE: "bg-gray-100 text-gray-700",
  "CREDIT CARD": "bg-rose-100 text-rose-700",
  "DEBIT CARD": "bg-rose-100 text-rose-700",
  UPI: "bg-cyan-100 text-cyan-700",
};

function modeColor(mode: string) { return PAYMENT_MODE_COLORS[mode] ?? "bg-gray-100 text-gray-600"; }

function StatCard({ label, value, sub, icon: Icon, iconBg, valueColor = "text-[#162B4D]" }: { label: string; value: string; sub?: string; icon: any; iconBg: string; valueColor?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function BankingOverview() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [receipts, setReceipts] = useState<Tx[]>([]);
  const [payments, setPayments] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, r, p] = await Promise.all([
          apiFetch("/api/banking/accounts"),
          apiFetch("/api/banking/receipts"),
          apiFetch("/api/banking/payments"),
        ]);
        setAccounts(a); setReceipts(r); setPayments(p);
      } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
      finally { setLoading(false); }
    })();
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const totalReceipts = receipts.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalPayments = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const netFlow = totalReceipts - totalPayments;

  const fmtAmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const recentReceipts = [...receipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const recentPayments = [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const receiptsByMode = receipts.reduce<Record<string, number>>((acc, r) => { acc[r.paymentMode] = (acc[r.paymentMode] ?? 0) + r.amount; return acc; }, {});
  const paymentsByMode = payments.reduce<Record<string, number>>((acc, p) => { acc[p.paymentMode] = (acc[p.paymentMode] ?? 0) + p.amount; return acc; }, {});
  const topReceiptModes = Object.entries(receiptsByMode).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topPaymentModes = Object.entries(paymentsByMode).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Landmark className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">Loading banking overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#162B4D]">Banking</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of accounts, receipts and payments.</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Accounts" value={String(accounts.length)} sub="Registered bank accounts" icon={Building2} iconBg="bg-blue-50 text-blue-600" />
        <StatCard label="Total Balance" value={fmtAmt(totalBalance)} sub="Across all accounts" icon={Wallet} iconBg="bg-indigo-50 text-indigo-600" />
        <StatCard label="Total Receipts" value={fmtAmt(totalReceipts)} sub={`${receipts.length} transactions`} icon={ArrowDownCircle} iconBg="bg-green-50 text-green-600" valueColor="text-green-700" />
        <StatCard label="Total Payments" value={fmtAmt(totalPayments)} sub={`${payments.length} transactions`} icon={ArrowUpCircle} iconBg="bg-red-50 text-red-500" valueColor="text-red-600" />
      </div>

      {/* Net flow card */}
      <div className={`rounded-xl border shadow-sm p-5 flex items-center gap-4 ${netFlow >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${netFlow >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
          {netFlow >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Net Cash Flow (Receipts − Payments)</p>
          <p className={`text-2xl font-bold mt-0.5 ${netFlow >= 0 ? "text-green-700" : "text-red-600"}`}>
            {netFlow >= 0 ? "+" : ""}{fmtAmt(netFlow)}
          </p>
        </div>
      </div>

      {/* Accounts + Mode breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Accounts list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#162B4D]">Bank Accounts</h2>
            <p className="text-xs text-gray-400 mt-0.5">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
          </div>
          {accounts.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No accounts yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {accounts.map(acc => (
                <div key={acc.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#162B4D] truncate">{acc.accountName}</p>
                      <p className="text-xs text-gray-400 truncate">{acc.bankName}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#162B4D] flex-shrink-0">{fmtAmt(acc.balance ?? 0)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Receipt breakdown by mode */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#162B4D]">Receipts by Mode</h2>
            <p className="text-xs text-gray-400 mt-0.5">Top payment modes for receipts</p>
          </div>
          {topReceiptModes.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No receipts yet</div>
          ) : (
            <div className="p-5 space-y-3">
              {topReceiptModes.map(([mode, amt]) => {
                const pct = totalReceipts > 0 ? Math.round((amt / totalReceipts) * 100) : 0;
                return (
                  <div key={mode}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${modeColor(mode)}`}>{mode}</span>
                      <span className="text-xs font-semibold text-gray-700">{fmtAmt(amt)} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payment breakdown by mode */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#162B4D]">Payments by Mode</h2>
            <p className="text-xs text-gray-400 mt-0.5">Top payment modes for payments</p>
          </div>
          {topPaymentModes.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No payments yet</div>
          ) : (
            <div className="p-5 space-y-3">
              {topPaymentModes.map(([mode, amt]) => {
                const pct = totalPayments > 0 ? Math.round((amt / totalPayments) * 100) : 0;
                return (
                  <div key={mode}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${modeColor(mode)}`}>{mode}</span>
                      <span className="text-xs font-semibold text-gray-700">{fmtAmt(amt)} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Receipts + Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#162B4D]">Recent Receipts</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest 5 incoming transactions</p>
            </div>
            <ArrowDownCircle className="w-4 h-4 text-green-500" />
          </div>
          {recentReceipts.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No receipts yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentReceipts.map(rec => (
                <div key={rec.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#162B4D] truncate">{rec.oppositeAccountName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${modeColor(rec.paymentMode)}`}>{rec.paymentMode}</span>
                      <span className="text-xs text-gray-400">{fmtDate(rec.date)}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-green-700 flex-shrink-0">{fmtAmt(rec.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#162B4D]">Recent Payments</h2>
              <p className="text-xs text-gray-400 mt-0.5">Latest 5 outgoing transactions</p>
            </div>
            <ArrowUpCircle className="w-4 h-4 text-red-400" />
          </div>
          {recentPayments.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No payments yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentPayments.map(pay => (
                <div key={pay.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#162B4D] truncate">{pay.oppositeAccountName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${modeColor(pay.paymentMode)}`}>{pay.paymentMode}</span>
                      <span className="text-xs text-gray-400">{fmtDate(pay.date)}</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-red-600 flex-shrink-0">{fmtAmt(pay.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
