import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch, getCurrentAdminScope } from "@/lib/api";

const CHANNEL_NAME  = "fishtokri-order-alert";
const POLL_MS       = 5000;

export interface PopupOrder {
  order: any;
  arrivedAt: Date;
}

export interface NewOrderPopupState {
  queue: PopupOrder[];
  acceptOrder: (id: string) => Promise<void>;
  rejectOrder: (id: string) => Promise<void>;
  dismissOrder: (id: string) => void;
}

/**
 * Polls for new pending orders every 5 s.
 * When a genuinely new order appears it is pushed onto a popup queue
 * and the alert sound loops until every queued order is acted upon.
 * Syncs across tabs via BroadcastChannel so only one tab shows the popup.
 */
export function useNewOrderPopup(): NewOrderPopupState {
  const [queue, setQueue] = useState<PopupOrder[]>([]);

  const knownIdsRef     = useRef<Set<string>>(new Set());
  const initializedRef  = useRef(false);
  const channelRef      = useRef<BroadcastChannel | null>(null);
  const audioRef        = useRef<HTMLAudioElement | null>(null);

  // Keep audio looping while the queue is non-empty
  useEffect(() => {
    if (queue.length > 0) {
      if (!audioRef.current) {
        const audio = new Audio("/order-alert.wav");
        audio.loop  = true;
        audioRef.current = audio;
      }
      audioRef.current.play().catch(() => {});
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [queue.length]);

  // BroadcastChannel — sync handled-IDs across tabs
  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;

    ch.onmessage = (e: MessageEvent) => {
      if (e.data?.type === "new-orders" && Array.isArray(e.data.ids)) {
        for (const id of e.data.ids as string[]) {
          knownIdsRef.current.add(id);
        }
        // Remove any popups that another tab already showed
        setQueue(q => q.filter(p => !e.data.ids.includes(String(p.order._id))));
      }
      if (e.data?.type === "order-acted" && e.data.id) {
        setQueue(q => q.filter(p => String(p.order._id) !== String(e.data.id)));
      }
    };

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => { ch.close(); channelRef.current = null; };
  }, []);

  // Polling
  useEffect(() => {
    const poll = async () => {
      try {
        const scope = getCurrentAdminScope();
        if (!scope.role) return;

        const now    = new Date();
        const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
        const today  = istNow.toISOString().slice(0, 10);

        const params = new URLSearchParams({ status: "pending", date: today, limit: "200" });
        if (scope.role !== "master_admin") {
          if (scope.subHubIds.length > 0)   params.set("subHubId",   scope.subHubIds[0]);
          else if (scope.superHubIds.length > 0) params.set("superHubId", scope.superHubIds[0]);
        }

        const data   = await apiFetch(`/api/orders?${params}`);
        const orders: any[] = data.orders ?? [];

        if (!initializedRef.current) {
          for (const o of orders) knownIdsRef.current.add(String(o._id));
          initializedRef.current = true;
          return;
        }

        const newOrders: any[] = [];
        for (const o of orders) {
          const id = String(o._id);
          if (!knownIdsRef.current.has(id)) {
            newOrders.push(o);
            knownIdsRef.current.add(id);
          }
        }

        if (newOrders.length === 0) return;

        // Tell other tabs these IDs are now known
        channelRef.current?.postMessage({
          type: "new-orders",
          ids: newOrders.map(o => String(o._id)),
        });

        // Show browser notification when tab is hidden
        if (
          document.visibilityState !== "visible" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          new Notification("🔔 New Order!", {
            body: newOrders.length === 1
              ? `New order from ${newOrders[0].customerName ?? "a customer"}`
              : `${newOrders.length} new orders arrived`,
            icon: "/favicon.ico",
            tag: "fishtokri-new-order",
            renotify: true,
          });
        }

        setQueue(q => [
          ...q,
          ...newOrders.map(o => ({ order: o, arrivedAt: new Date() })),
        ]);
      } catch {
        // Silently ignore — never disrupt the UI
      }
    };

    const id = setInterval(poll, POLL_MS);
    poll(); // immediate first run
    return () => clearInterval(id);
  }, []);

  const removeFromQueue = useCallback((orderId: string) => {
    setQueue(q => q.filter(p => String(p.order._id) !== orderId));
    channelRef.current?.postMessage({ type: "order-acted", id: orderId });
  }, []);

  const acceptOrder = useCallback(async (id: string) => {
    try {
      const queueEntry = queue.find(p => String(p.order._id) === id);
      console.log(
        `[WhatsApp] popup acceptOrder → orderId=${queueEntry?.order?.orderId || id} ` +
        `customer=${queueEntry?.order?.customerName} phone=${queueEntry?.order?.phone} ` +
        `→ confirmed | WA template: fishtokri_order_confirmed`
      );
      await apiFetch(`/api/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "confirmed" }),
      });
    } catch {
      // Best-effort — popup still closes
    }
    removeFromQueue(id);
  }, [removeFromQueue, queue]);

  const rejectOrder = useCallback(async (id: string) => {
    try {
      const queueEntry = queue.find(p => String(p.order._id) === id);
      console.log(
        `[WhatsApp] popup rejectOrder → orderId=${queueEntry?.order?.orderId || id} ` +
        `customer=${queueEntry?.order?.customerName} phone=${queueEntry?.order?.phone} ` +
        `→ cancelled | WA template: fishtokri_order_cancelled | reason="Rejected by admin"`
      );
      await apiFetch(`/api/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: "cancelled", cancellationReason: "Rejected by admin" }),
      });
    } catch {
      // Best-effort
    }
    removeFromQueue(id);
  }, [removeFromQueue, queue]);

  const dismissOrder = useCallback((id: string) => {
    removeFromQueue(id);
  }, [removeFromQueue]);

  return { queue, acceptOrder, rejectOrder, dismissOrder };
}
