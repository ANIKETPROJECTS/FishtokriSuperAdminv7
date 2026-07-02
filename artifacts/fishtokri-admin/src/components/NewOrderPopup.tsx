import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { PopupOrder } from "@/hooks/use-new-order-popup";

interface Props {
  queue: PopupOrder[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDismiss: (id: string) => void;
}

function fmt(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "₹0";
  return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function timeAgo(d: Date) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function Badge({ text, color }: { text: string; color: string }) {
  const styles: Record<string, React.CSSProperties> = {
    green:  { background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" },
    red:    { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" },
    orange: { background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" },
    blue:   { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" },
    purple: { background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" },
    gray:   { background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" },
  };
  return (
    <span style={{
      ...(styles[color] ?? styles.gray),
      fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
      textTransform: "uppercase", letterSpacing: "0.04em", display: "inline-block",
    }}>
      {text}
    </span>
  );
}

function OrderCard({
  popupOrder,
  index,
  total,
  onAccept,
  onReject,
  onDismiss,
}: {
  popupOrder: PopupOrder;
  index: number;
  total: number;
  onAccept: () => void;
  onReject: () => void;
  onDismiss: () => void;
}) {
  const o = popupOrder.order;
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [tick, setTick]           = useState(0);

  // Re-render every second to update "X ago" timer
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const items: any[]    = Array.isArray(o.items) ? o.items : [];
  const payments: any[] = Array.isArray(o.payments) ? o.payments : [];
  const walletUsed      = payments
    .filter((p: any) => String(p?.mode || "").toLowerCase() === "wallet")
    .reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

  const payStatusColor = String(o.paymentStatus || "").toLowerCase() === "paid"    ? "green"
                       : String(o.paymentStatus || "").toLowerCase() === "partial"  ? "orange"
                       : "red";
  const ordStatusColor = String(o.status || "").toLowerCase() === "confirmed"       ? "green"
                       : String(o.status || "").toLowerCase() === "cancelled"        ? "red"
                       : String(o.status || "").toLowerCase() === "delivered"        ? "blue"
                       : "orange";

  const handleAccept = async () => {
    setAccepting(true);
    await Promise.resolve(); // allow re-render
    onAccept();
  };
  const handleReject = async () => {
    setRejecting(true);
    await Promise.resolve();
    onReject();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)",
      animation: "ftPopupIn 0.2s ease",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        width: "min(96vw, 580px)", maxHeight: "92vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "ftCardIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
      }}>

        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg,#162B4D 0%,#1e3a6e 100%)",
          padding: "16px 20px 14px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{
                background: "#ef4444", color: "#fff",
                fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                textTransform: "uppercase", letterSpacing: "0.06em",
                animation: "ftPulse 1s infinite",
              }}>
                🔔 New Order
              </span>
              {total > 1 && (
                <span style={{ color: "#94a3b8", fontSize: 12 }}>
                  {index + 1} of {total}
                </span>
              )}
            </div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1 }}>
              {o.invoiceNo ?? o.orderId ?? "—"}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
              Arrived {timeAgo(popupOrder.arrivedAt)}
              {o.createdAt && ` · ${new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
          </div>

          {/* Close × */}
          <button
            onClick={onDismiss}
            style={{
              background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer",
              color: "#fff", width: 32, height: 32, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, flexShrink: 0, marginTop: 2,
            }}
            title="Close popup (order stays pending)"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>

          {/* Customer */}
          <Section title="Customer">
            <Row label="Name"  value={<strong>{o.customerName || "—"}</strong>} />
            <Row label="Phone" value={o.phone || "—"} />
            {o.email && <Row label="Email" value={o.email} />}
          </Section>

          {/* Delivery */}
          <Section title="Delivery">
            <Row label="Type"     value={
              <Badge
                text={String(o.deliveryType || "delivery").replace(/_/g," ")}
                color={String(o.deliveryType||"").toLowerCase() === "takeaway" ? "purple" : "blue"}
              />
            } />
            {o.deliveryDate   && <Row label="Date"    value={o.deliveryDate} />}
            {o.timeslotLabel  && <Row label="Timeslot" value={o.timeslotLabel} />}
            {o.deliveryArea   && <Row label="Area"    value={o.deliveryArea} />}
            {o.address && (
              <Row label="Address" value={
                <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{o.address}</span>
              } />
            )}
          </Section>

          {/* Items */}
          <Section title={`Items (${items.length})`}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Item", "Qty", "Rate", "Amount"].map(h => (
                      <th key={h} style={{
                        padding: "7px 10px", textAlign: h === "Item" ? "left" : "right",
                        fontWeight: 600, color: "#6b7280", fontSize: 11,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        borderBottom: "1px solid #e5e7eb",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, i: number) => (
                    <tr key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 600, color: "#111" }}>{it.name}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#555" }}>{it.quantity} {it.unit || ""}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#555" }}>{fmt(it.price)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 600 }}>{fmt((it.price || 0) * (it.quantity || 1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Pricing */}
          <Section title="Pricing">
            <Row label="Subtotal"        value={fmt(o.subtotal)} />
            {Number(o.discount) > 0     && <Row label="Discount"         value={<span style={{ color: "#16a34a" }}>− {fmt(o.discount)}</span>} />}
            {Number(o.extraDiscount) > 0 && <Row label="Extra Discount"  value={<span style={{ color: "#16a34a" }}>− {fmt(o.extraDiscount)}</span>} />}
            {Number(o.slotCharge) > 0    && <Row label="Slot Charge"     value={fmt(o.slotCharge)} />}
            {Number(o.deliveryCharge) > 0 && <Row label="Delivery Charge" value={fmt(o.deliveryCharge)} />}
            <div style={{ borderTop: "2px solid #e5e7eb", marginTop: 6, paddingTop: 8 }}>
              <Row
                label={<strong style={{ fontSize: 14 }}>Total</strong>}
                value={<strong style={{ fontSize: 18, color: "#111" }}>{fmt(o.total)}</strong>}
              />
            </div>
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <Row label="Mode"   value={o.paymentMode || "—"} />
            <Row label="Status" value={<Badge text={o.paymentStatus || "—"} color={payStatusColor} />} />
            {Number(o.paidAmount) > 0   && <Row label="Paid"    value={fmt(o.paidAmount)} />}
            {Number(o.dueAmount) > 0    && <Row label="Due"     value={<span style={{ color: "#dc2626" }}>{fmt(o.dueAmount)}</span>} />}
            {walletUsed > 0             && <Row label="Wallet Used" value={<span style={{ color: "#7c3aed" }}>{fmt(walletUsed)}</span>} />}
          </Section>

          {/* Order Status */}
          <Section title="Status">
            <Row label="Order Status" value={<Badge text={String(o.status || "pending").replace(/_/g," ")} color={ordStatusColor} />} />
            {o.subHubName    && <Row label="Sub Hub"    value={o.subHubName} />}
            {o.superHubName  && <Row label="Super Hub"  value={o.superHubName} />}
            {o.assignedDeliveryPersonName && <Row label="Delivery Partner" value={o.assignedDeliveryPersonName} />}
          </Section>

          {/* Notes */}
          {o.notes && (
            <Section title="Notes">
              <p style={{ margin: 0, color: "#374151", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {o.notes}
              </p>
            </Section>
          )}
        </div>

        {/* ── Action buttons ── */}
        <div style={{
          padding: "14px 20px", borderTop: "1px solid #e5e7eb",
          display: "flex", gap: 10, flexShrink: 0, background: "#f9fafb",
        }}>
          <button
            onClick={handleReject}
            disabled={rejecting || accepting}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: rejecting || accepting ? "not-allowed" : "pointer",
              background: rejecting ? "#fca5a5" : "#fee2e2",
              color: "#dc2626", border: "2px solid #fca5a5",
              transition: "all 0.15s", opacity: accepting ? 0.5 : 1,
            }}
          >
            {rejecting ? "Rejecting…" : "✕ Reject"}
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting || rejecting}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: accepting || rejecting ? "not-allowed" : "pointer",
              background: accepting ? "#4ade80" : "linear-gradient(135deg,#16a34a,#15803d)",
              color: "#fff", border: "none",
              transition: "all 0.15s", opacity: rejecting ? 0.5 : 1,
              boxShadow: "0 4px 12px rgba(22,163,74,0.35)",
            }}
          >
            {accepting ? "Accepting…" : "✓ Accept Order"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ftPopupIn { from { opacity:0 } to { opacity:1 } }
        @keyframes ftCardIn  { from { opacity:0; transform:scale(0.92) translateY(16px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes ftPulse   { 0%,100% { opacity:1 } 50% { opacity:0.6 } }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: "#6b7280", textTransform: "uppercase",
        letterSpacing: "0.08em", marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ flex: 1, height: 1, background: "#e5e7eb", display: "block" }} />
        {title}
        <span style={{ flex: 1, height: 1, background: "#e5e7eb", display: "block" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
      <span style={{ color: "#6b7280", minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#111", flex: 1, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export function NewOrderPopup({ queue, onAccept, onReject, onDismiss }: Props) {
  if (queue.length === 0) return null;

  const current = queue[0];

  return createPortal(
    <OrderCard
      key={String(current.order._id)}
      popupOrder={current}
      index={0}
      total={queue.length}
      onAccept={() => onAccept(String(current.order._id))}
      onReject={() => onReject(String(current.order._id))}
      onDismiss={() => onDismiss(String(current.order._id))}
    />,
    document.body,
  );
}
