import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

type FtwOrderVerification = {
  status: "matched" | "missing" | "suppressed" | "not_applicable";
  orderIds: string[];
  suppressedAt?: string;
};

type RazorpayPayment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  created_at?: number;
  contact?: string;
  email?: string;
  order_id?: string | null;
  invoice_id?: string | null;
  description?: string | null;
  refund_status?: string | null;
  amount_refunded?: number;
  captured?: boolean;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
  acquirer_data?: {
    rrn?: string;
    bank_transaction_id?: string;
  };
  ftwOrderVerification?: FtwOrderVerification;
};

type PaymentsResponse = {
  items: RazorpayPayment[];
  count: number;
  skip: number;
  pageSize: number;
  hasMore: boolean;
};

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ["all", "created", "authorized", "captured", "refunded", "failed"];

function toEpochStart(date: string) {
  if (!date) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function toEpochEnd(date: string) {
  const start = toEpochStart(date);
  return start === undefined ? undefined : start + 86_399;
}

function formatAmount(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((Number(amount) || 0) / 100);
}

function formatDate(timestamp?: number) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case "captured":
      return "bg-emerald-50 text-emerald-700";
    case "refunded":
      return "bg-violet-50 text-violet-700";
    case "failed":
      return "bg-red-50 text-red-700";
    case "authorized":
      return "bg-blue-50 text-blue-700";
    default:
      return "bg-amber-50 text-amber-700";
  }
}

export default function RazorpayPayments() {
  const [items, setItems] = useState<RazorpayPayment[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedDates, setAppliedDates] = useState({ from: "", to: "" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [minimumAmount, setMinimumAmount] = useState("");
  const [maximumAmount, setMaximumAmount] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [expandedId, setExpandedId] = useState("");
  const [alertActionPaymentId, setAlertActionPaymentId] = useState("");
  const [alertActionError, setAlertActionError] = useState("");

  const loadPayments = useCallback(async (pageIndex: number, dates = appliedDates) => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      count: String(PAGE_SIZE),
      skip: String(pageIndex * PAGE_SIZE),
    });
    const from = toEpochStart(dates.from);
    const to = toEpochEnd(dates.to);
    if (from !== undefined) query.set("from", String(from));
    if (to !== undefined) query.set("to", String(to));

    try {
      const result = await apiFetch(`/api/razorpay-payments?${query.toString()}`) as PaymentsResponse;
      setItems(Array.isArray(result.items) ? result.items : []);
      setHasMore(Boolean(result.hasMore));
      setPage(pageIndex);
      setExpandedId("");
    } catch (err) {
      setItems([]);
      setHasMore(false);
      setError(err instanceof Error ? err.message : "Could not load Razorpay transactions.");
    } finally {
      setLoading(false);
    }
  }, [appliedDates]);

  useEffect(() => {
    void loadPayments(0);
  }, [loadPayments]);

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    const minValue = minimumAmount === "" ? NaN : Number(minimumAmount);
    const maxValue = maximumAmount === "" ? NaN : Number(maximumAmount);
    const minPaise = Number.isFinite(minValue) ? minValue * 100 : undefined;
    const maxPaise = Number.isFinite(maxValue) ? maxValue * 100 : undefined;
    const filtered = items.filter((payment) => {
      const matchesStatus = status === "all" || payment.status?.toLowerCase() === status;
      const matchesMethod = method === "all" || (payment.method || "other") === method;
      const amount = Number(payment.amount) || 0;
      const matchesAmount =
        (minPaise === undefined || amount >= minPaise) &&
        (maxPaise === undefined || amount <= maxPaise);
      const searchable = [
        payment.id,
        payment.order_id,
        payment.invoice_id,
        payment.contact,
        payment.email,
        payment.method,
        payment.description,
        payment.acquirer_data?.rrn,
        payment.acquirer_data?.bank_transaction_id,
      ].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesMethod && matchesAmount && (!term || searchable.includes(term));
    });
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (a.created_at || 0) - (b.created_at || 0);
        case "amount-high":
          return (Number(b.amount) || 0) - (Number(a.amount) || 0);
        case "amount-low":
          return (Number(a.amount) || 0) - (Number(b.amount) || 0);
        default:
          return (b.created_at || 0) - (a.created_at || 0);
      }
    });
  }, [items, search, status, method, minimumAmount, maximumAmount, sortBy]);

  const capturedAmount = visibleItems
    .filter((payment) => payment.status?.toLowerCase() === "captured")
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const refundedPayments = visibleItems.filter((payment) =>
    payment.status?.toLowerCase() === "refunded" || Number(payment.amount_refunded) > 0
  );
  const refundedAmount = refundedPayments.reduce((sum, payment) => sum + (Number(payment.amount_refunded) || 0), 0);
  const paymentMethods = [...new Set([
    ...items.map((payment) => payment.method || "other"),
    ...(method === "all" ? [] : [method]),
  ])].sort();
  const amountRangeInvalid =
    minimumAmount !== "" &&
    maximumAmount !== "" &&
    Number.isFinite(Number(minimumAmount)) &&
    Number.isFinite(Number(maximumAmount)) &&
    Number(minimumAmount) > Number(maximumAmount);
  const hasActiveFilters = Boolean(
    search ||
    status !== "all" ||
    method !== "all" ||
    minimumAmount ||
    maximumAmount ||
    sortBy !== "newest" ||
    appliedDates.from ||
    appliedDates.to ||
    fromDate ||
    toDate
  );

  const applyDateFilter = () => {
    if (fromDate && toDate && fromDate > toDate) {
      setError("The start date must be before the end date.");
      return;
    }
    const dates = { from: fromDate, to: toDate };
    setAppliedDates(dates);
  };

  const clearAllFilters = () => {
    setFromDate("");
    setToDate("");
    setAppliedDates({ from: "", to: "" });
    setSearch("");
    setStatus("all");
    setMethod("all");
    setMinimumAmount("");
    setMaximumAmount("");
    setSortBy("newest");
  };

  const updateAlertSuppression = async (paymentId: string, suppress: boolean) => {
    setAlertActionPaymentId(paymentId);
    setAlertActionError("");
    try {
      await apiFetch(`/api/razorpay-payments/${encodeURIComponent(paymentId)}/suppression`, {
        method: suppress ? "POST" : "DELETE",
      });
      setItems((current) =>
        current.map((payment) =>
          payment.id === paymentId
            ? {
                ...payment,
                ftwOrderVerification: suppress
                  ? { status: "suppressed", orderIds: [], suppressedAt: new Date().toISOString() }
                  : { status: "missing", orderIds: [] },
              }
            : payment,
        ),
      );
    } catch (err) {
      setAlertActionError(err instanceof Error ? err.message : "Could not update the FTW order alert.");
    } finally {
      setAlertActionPaymentId("");
    }
  };

  const lastItemNumber = page * PAGE_SIZE + items.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#162B4D]">Razorpay Payments</h1>
          <p className="mt-1 text-sm text-gray-500">Read-only view of transactions from your Razorpay account.</p>
        </div>
        <Button
          onClick={() => void loadPayments(page)}
          disabled={loading}
          variant="outline"
          className="gap-2 border-gray-200 bg-white"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Matching transactions</p>
          <p className="mt-1 text-3xl font-bold text-[#162B4D]">{visibleItems.length}</p>
          <p className="mt-1 text-xs text-gray-400">On the loaded page, after filters</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Captured amount</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">{formatAmount(capturedAmount)}</p>
          <p className="mt-1 text-xs text-gray-400">Matching captured payments on this page</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Refunded amount</p>
          <p className="mt-1 text-3xl font-bold text-violet-700">{formatAmount(refundedAmount)}</p>
          <p className="mt-1 text-xs text-gray-400">{refundedPayments.length} matching refunded or partially refunded payments</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="space-y-4 border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-[#162B4D]">Transactions</h2>
              <p className="mt-1 text-xs text-gray-500">
                {items.length > 0
                  ? `Showing ${page * PAGE_SIZE + 1}–${lastItemNumber} · ${visibleItems.length} match your current filters`
                  : "Transactions are loaded directly from Razorpay"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative">
                <span className="sr-only">Search payment details on this page</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ID, customer, RRN..."
                  className="h-9 w-52 pl-9"
                />
              </label>
              <label className="sr-only" htmlFor="razorpay-status-filter">Filter by status</label>
              <select
                id="razorpay-status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All statuses" : option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs font-medium text-gray-500">
              From
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-9 w-40 text-sm" />
            </label>
            <label className="space-y-1 text-xs font-medium text-gray-500">
              To
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-9 w-40 text-sm" />
            </label>
            <Button onClick={applyDateFilter} disabled={loading} size="sm" className="h-9 bg-[#1A56DB] hover:bg-[#1447B4]">
              Apply date range
            </Button>
            <label className="space-y-1 text-xs font-medium text-gray-500">
              Payment method
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="block h-9 min-w-36 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              >
                <option value="all">All methods</option>
                {paymentMethods.map((paymentMethod) => (
                  <option key={paymentMethod} value={paymentMethod}>
                    {paymentMethod === "other" ? "Other" : paymentMethod[0].toUpperCase() + paymentMethod.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-gray-500">
              Minimum amount (₹)
              <Input
                type="number"
                min="0"
                step="0.01"
                value={minimumAmount}
                onChange={(event) => setMinimumAmount(event.target.value)}
                placeholder="No minimum"
                className="h-9 w-32 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-gray-500">
              Maximum amount (₹)
              <Input
                type="number"
                min="0"
                step="0.01"
                value={maximumAmount}
                onChange={(event) => setMaximumAmount(event.target.value)}
                placeholder="No maximum"
                className="h-9 w-32 text-sm"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-gray-500">
              Sort by
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="block h-9 min-w-40 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount-high">Amount: high to low</option>
                <option value="amount-low">Amount: low to high</option>
              </select>
            </label>
            {amountRangeInvalid && (
              <p className="pb-2 text-xs font-medium text-red-600">
                Minimum amount must not exceed maximum amount.
              </p>
            )}
            {hasActiveFilters && (
              <Button onClick={clearAllFilters} disabled={loading} variant="ghost" size="sm" className="h-9 text-gray-500">
                Clear all filters
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Date range is applied to Razorpay results. Search, status, method, amount, sorting, and FTW checks apply to the loaded page of up to 25 transactions.
          </p>
          {alertActionError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {alertActionError}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-gray-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading Razorpay transactions…
          </div>
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center">
            <XCircle className="h-8 w-8 text-red-400" />
            <p className="font-medium text-gray-700">{error}</p>
            {error.includes("credentials") && (
              <p className="max-w-lg text-xs text-gray-500">
                Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Replit Secrets, then refresh this page.
              </p>
            )}
            <Button onClick={() => void loadPayments(page)} variant="outline" size="sm" className="mt-2">
              Try again
            </Button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
            <CreditCard className="h-9 w-9 text-gray-300" />
            <p className="font-semibold text-gray-600">
              {items.length === 0 ? "No Razorpay transactions found" : "No transactions match these filters"}
            </p>
            <p className="text-sm text-gray-400">
              {items.length === 0 ? "Try another date range or refresh the list." : "Try a different search or status."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment ID</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">FTW order check</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Bank RRN</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Method</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Created on</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleItems.map((payment) => {
                  const expanded = expandedId === payment.id;
                  const customer = payment.contact || payment.email || "—";
                  const rrn = payment.acquirer_data?.rrn || payment.acquirer_data?.bank_transaction_id || "—";
                  return (
                    <FragmentRow
                      key={payment.id}
                      payment={payment}
                      expanded={expanded}
                      customer={customer}
                      rrn={rrn}
                      alertActionPending={alertActionPaymentId === payment.id}
                      onSuppressAlert={() => void updateAlertSuppression(payment.id, true)}
                      onRestoreAlert={() => void updateAlertSuppression(payment.id, false)}
                      onToggle={() => setExpandedId(expanded ? "" : payment.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
          <span className="text-xs text-gray-500">
            Page {page + 1} · {items.length} transactions loaded
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page === 0}
              onClick={() => void loadPayments(page - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !hasMore}
              onClick={() => void loadPayments(page + 1)}
              className="gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FragmentRow({
  payment,
  expanded,
  customer,
  rrn,
  alertActionPending,
  onSuppressAlert,
  onRestoreAlert,
  onToggle,
}: {
  payment: RazorpayPayment;
  expanded: boolean;
  customer: string;
  rrn: string;
  alertActionPending: boolean;
  onSuppressAlert: () => void;
  onRestoreAlert: () => void;
  onToggle: () => void;
}) {
  const status = payment.status || "unknown";
  const verification = payment.ftwOrderVerification;
  return (
    <>
      <tr className="transition-colors hover:bg-gray-50">
        <td className="whitespace-nowrap px-5 py-3 font-medium text-[#162B4D]">{payment.id}</td>
        <td className="min-w-64 px-5 py-3">
          {verification?.status === "matched" ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="text-xs font-semibold text-emerald-700">FTW order found</p>
                <p className="mt-0.5 font-mono text-xs text-gray-600">
                  {verification.orderIds[0]}
                  {verification.orderIds.length > 1 ? ` +${verification.orderIds.length - 1} more` : ""}
                </p>
              </div>
            </div>
          ) : verification?.status === "missing" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> No FTW order
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={alertActionPending}
                onClick={onSuppressAlert}
                className="h-7 px-2 text-xs"
                title="Suppress this alert if the missing order has been resolved"
              >
                {alertActionPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Suppress"}
              </Button>
            </div>
          ) : verification?.status === "suppressed" ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                <BellOff className="h-3.5 w-3.5" /> Alert suppressed
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={alertActionPending}
                onClick={onRestoreAlert}
                className="h-7 px-2 text-xs text-blue-700"
              >
                {alertActionPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Restore"}
              </Button>
            </div>
          ) : verification?.status === "not_applicable" ? (
            <span className="text-xs text-gray-400">Payment not captured</span>
          ) : (
            <span className="text-xs text-gray-400">Checking…</span>
          )}
        </td>
        <td className="whitespace-nowrap px-5 py-3 text-gray-600">{rrn}</td>
        <td className="whitespace-nowrap px-5 py-3 capitalize text-gray-600">{payment.method || "—"}</td>
        <td className="px-5 py-3">
          <div className="font-medium text-gray-700">{customer}</div>
          {payment.email && payment.contact && <div className="text-xs text-gray-400">{payment.email}</div>}
        </td>
        <td className="whitespace-nowrap px-5 py-3 text-gray-600">{formatDate(payment.created_at)}</td>
        <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-[#162B4D]">
          {formatAmount(payment.amount, payment.currency)}
        </td>
        <td className="px-5 py-3">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(status)}`}>
            {status === "captured" ? <CheckCircle2 className="h-3 w-3" /> : null}
            {status}
          </span>
        </td>
        <td className="px-5 py-3 text-right">
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 px-2 text-xs text-blue-700 hover:text-blue-800">
            {expanded ? "Hide" : "View"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={9} className="px-5 py-4">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Payment method" value={payment.method} />
              <Detail label="Contact" value={payment.contact} />
              <Detail label="Email" value={payment.email} />
              <Detail label="Razorpay order ID" value={payment.order_id} />
              <Detail label="Invoice ID" value={payment.invoice_id} />
              <Detail label="Refunded" value={payment.amount_refunded ? formatAmount(payment.amount_refunded, payment.currency) : "—"} />
              <Detail label="Fee" value={payment.fee != null ? formatAmount(payment.fee, payment.currency) : "—"} />
              <Detail label="Description" value={payment.description} />
              {payment.error_description && <Detail label="Failure reason" value={payment.error_description} />}
              {payment.error_code && <Detail label="Failure code" value={payment.error_code} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="break-words text-sm text-gray-700">{value || "—"}</p>
    </div>
  );
}