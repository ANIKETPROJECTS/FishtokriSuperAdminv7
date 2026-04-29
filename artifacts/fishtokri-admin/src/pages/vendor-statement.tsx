import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, FileText, Printer, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, formatRupees, formatDateDDMMYYYY } from "@/lib/api";

type Vendor = {
  id: string; name: string; phone: string; email: string;
  address: string; category: string;
};

type Invoice = {
  id: string; invoiceNumber: string; purchaseDate: string;
  totalAmount: number; status: string;
};

type Receipt = {
  id: string; date: string; invoiceNumber: string;
  paymentMode: string; depositTo: string; receivedFrom: string;
  amount: number; reference: string; remarks: string;
};

type StatementRow =
  | { kind: "invoice"; date: string; ref: string; description: string; debit: number; credit: 0; balance: number }
  | { kind: "receipt"; date: string; ref: string; description: string; debit: 0; credit: number; balance: number };

export default function VendorStatement() {
  const { toast } = useToast();
  const [, params] = useRoute("/vendor-statement/:vendorId");
  const vendorId = params?.vendorId || "";

  const [loading, setLoading] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [totals, setTotals] = useState({ invoiced: 0, received: 0, outstanding: 0 });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const qs = params.toString();
      const data = await apiFetch(`/api/vendors/${vendorId}/statement${qs ? `?${qs}` : ""}`);
      setVendor(data.vendor);
      setInvoices(data.invoices || []);
      setReceipts(data.receipts || []);
      setTotals(data.totals || { invoiced: 0, received: 0, outstanding: 0 });
    } catch (e: any) {
      toast({ title: "Failed to load statement", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [vendorId]);

  const ledger = useMemo<StatementRow[]>(() => {
    const items: Array<{ when: number; row: StatementRow }> = [];
    invoices.forEach(i => {
      const t = new Date(i.purchaseDate).getTime();
      items.push({
        when: t,
        row: {
          kind: "invoice",
          date: i.purchaseDate,
          ref: i.invoiceNumber || "—",
          description: `Invoice ${i.invoiceNumber || ""}`.trim(),
          debit: Number(i.totalAmount || 0),
          credit: 0,
          balance: 0,
        },
      });
    });
    receipts.forEach(r => {
      const t = new Date(r.date).getTime();
      items.push({
        when: t,
        row: {
          kind: "receipt",
          date: r.date,
          ref: r.reference || r.paymentMode || "—",
          description: `Receipt${r.invoiceNumber ? ` for ${r.invoiceNumber}` : ""}${r.paymentMode ? ` • ${r.paymentMode}` : ""}`,
          debit: 0,
          credit: Number(r.amount || 0),
          balance: 0,
        },
      });
    });
    items.sort((a, b) => a.when - b.when);
    let bal = 0;
    return items.map(({ row }) => {
      bal += row.debit - row.credit;
      return { ...row, balance: bal };
    });
  }, [invoices, receipts]);

  const handlePrint = () => window.print();

  const handleDownloadCSV = () => {
    const header = ["Date", "Type", "Reference", "Description", "Debit", "Credit", "Balance"];
    const rows = ledger.map(r => [
      formatDateDDMMYYYY(r.date),
      r.kind === "invoice" ? "Invoice" : "Receipt",
      r.ref,
      r.description,
      r.debit ? r.debit.toFixed(2) : "",
      r.credit ? r.credit.toFixed(2) : "",
      r.balance.toFixed(2),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${vendor?.name || "vendor"}-statement.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/vendors">
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Back to Vendors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="w-9 h-9 rounded-lg bg-[#162B4D] text-white flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#162B4D]">Vendor Statement</h1>
            <p className="text-xs text-gray-500">{vendor?.name || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button variant="outline" className="h-9 gap-1.5" onClick={handleDownloadCSV}>
            <Download className="w-4 h-4" /> CSV
          </Button>
          <Button className="h-9 bg-[#1A56DB] hover:bg-[#1e40af] text-white gap-1.5" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 flex items-end gap-3 flex-wrap print:hidden">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 w-40" />
        </div>
        <Button onClick={load} className="h-9 bg-[#162B4D] hover:bg-[#0f1f38] text-white">Apply</Button>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); setTimeout(load, 0); }} className="h-9 text-gray-500">Clear</Button>
        )}
      </div>

      {/* Vendor card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Vendor</p>
          <p className="text-base font-bold text-[#162B4D] mt-0.5">{vendor?.name || "—"}</p>
          <p className="text-xs text-gray-500">{vendor?.category || ""}</p>
          {vendor?.phone && <p className="text-xs text-gray-500 mt-1">{vendor.phone}</p>}
          {vendor?.email && <p className="text-xs text-gray-500">{vendor.email}</p>}
          {vendor?.address && <p className="text-xs text-gray-500 mt-1">{vendor.address}</p>}
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Total Invoiced</p>
          <p className="text-xl font-bold text-[#162B4D] mt-1">{formatRupees(totals.invoiced)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-[11px] uppercase tracking-wider text-green-600">Total Received</p>
          <p className="text-xl font-bold text-green-700 mt-1">{formatRupees(totals.received)}</p>
          <p className="text-[11px] text-green-600 mt-0.5">{receipts.length} receipt{receipts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className={`rounded-lg p-3 ${totals.outstanding > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
          <p className={`text-[11px] uppercase tracking-wider ${totals.outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${totals.outstanding > 0 ? "text-red-700" : "text-emerald-700"}`}>{formatRupees(Math.abs(totals.outstanding))}</p>
          <p className={`text-[11px] mt-0.5 ${totals.outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>{totals.outstanding > 0 ? "Due to vendor" : totals.outstanding < 0 ? "Advance paid" : "All settled"}</p>
        </div>
      </div>

      {/* Ledger */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#162B4D]">Account Ledger</h2>
          <p className="text-xs text-gray-500">{ledger.length} entries</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-gray-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left">Date</th>
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-left">Reference</th>
                <th className="px-3 py-2.5 text-left">Description</th>
                <th className="px-3 py-2.5 text-right">Debit</th>
                <th className="px-3 py-2.5 text-right">Credit</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">Loading statement…</td></tr>
              ) : ledger.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-gray-400">No transactions for this vendor.</td></tr>
              ) : ledger.map((r, idx) => (
                <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDateDDMMYYYY(r.date)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.kind === "invoice" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                      {r.kind === "invoice" ? "Invoice" : "Receipt"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.ref}</td>
                  <td className="px-3 py-2 text-gray-600">{r.description}</td>
                  <td className="px-3 py-2 text-right text-blue-700">{r.debit ? formatRupees(r.debit) : ""}</td>
                  <td className="px-3 py-2 text-right text-green-700">{r.credit ? formatRupees(r.credit) : ""}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.balance > 0 ? "text-red-700" : r.balance < 0 ? "text-emerald-700" : "text-gray-600"}`}>
                    {formatRupees(Math.abs(r.balance))}{r.balance < 0 ? " Cr" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
            {ledger.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-[#162B4D]">
                  <td colSpan={4} className="px-3 py-2.5 text-right">Totals</td>
                  <td className="px-3 py-2.5 text-right text-blue-700">{formatRupees(totals.invoiced)}</td>
                  <td className="px-3 py-2.5 text-right text-green-700">{formatRupees(totals.received)}</td>
                  <td className={`px-3 py-2.5 text-right ${totals.outstanding > 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {formatRupees(Math.abs(totals.outstanding))}{totals.outstanding < 0 ? " Cr" : ""}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
