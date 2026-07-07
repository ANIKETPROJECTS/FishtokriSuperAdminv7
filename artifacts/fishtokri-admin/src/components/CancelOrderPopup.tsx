import { createPortal } from "react-dom";
import type { CancelledOrder } from "@/hooks/use-cancel-order-alert";

interface Props {
  queue: CancelledOrder[];
  onDismiss: (id: string) => void;
}

export function CancelOrderPopup({ queue, onDismiss }: Props) {
  if (queue.length === 0) return null;

  return createPortal(
    <div style={{
      position: "fixed", bottom: 24, left: 24, zIndex: 99999,
      display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start",
    }}>
      {queue.map(({ order }) => (
        <div
          key={String(order._id)}
          style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(220,38,38,0.18), 0 2px 8px rgba(0,0,0,0.10)",
            border: "1.5px solid #fca5a5",
            padding: "14px 18px",
            minWidth: 280,
            maxWidth: 340,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            animation: "ftCancelToastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Alert icon */}
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#dc2626,#b91c1c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            ❌
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#dc2626", marginBottom: 2 }}>
              Order Cancelled!
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace", marginBottom: 2 }}>
              {order.invoiceNo ?? order.orderId ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {order.customerName ?? "Customer"}
              {order.total != null ? ` · ₹${Number(order.total).toLocaleString("en-IN")}` : ""}
            </div>
            {order.cancellationReason ? (
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, fontStyle: "italic" }}>
                Reason: {order.cancellationReason}
              </div>
            ) : (
              <div style={{ marginBottom: 10 }} />
            )}
            <button
              onClick={() => onDismiss(String(order._id))}
              style={{
                background: "#dc2626", color: "#fff", border: "none",
                borderRadius: 8, padding: "6px 18px", fontSize: 12,
                fontWeight: 700, cursor: "pointer", width: "100%",
              }}
            >
              OK
            </button>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes ftCancelToastIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>,
    document.body,
  );
}
