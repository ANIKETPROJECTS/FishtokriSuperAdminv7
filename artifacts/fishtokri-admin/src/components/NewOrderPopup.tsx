import { createPortal } from "react-dom";
import type { PopupOrder } from "@/hooks/use-new-order-popup";

interface Props {
  queue: PopupOrder[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function NewOrderPopup({ queue, onDismiss }: Props) {
  if (queue.length === 0) return null;

  return createPortal(
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 99999,
      display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end",
    }}>
      {queue.map(({ order }) => (
        <div
          key={String(order._id)}
          style={{
            background: "#fff",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)",
            border: "1.5px solid #e5e7eb",
            padding: "14px 18px",
            minWidth: 280,
            maxWidth: 340,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            animation: "ftToastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Bell icon */}
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#162B4D,#1e3a6e)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>
            🔔
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#111", marginBottom: 2 }}>
              New Order Arrived!
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace", marginBottom: 2 }}>
              {order.invoiceNo ?? order.orderId ?? "—"}
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {order.customerName ?? "Customer"}
              {order.total != null ? ` · ₹${Number(order.total).toLocaleString("en-IN")}` : ""}
            </div>
            <button
              onClick={() => onDismiss(String(order._id))}
              style={{
                background: "#162B4D", color: "#fff", border: "none",
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
        @keyframes ftToastIn {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>,
    document.body,
  );
}
