import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch, getCurrentAdminScope } from "@/lib/api";

const POLL_MS = 5000;

export interface CancelledOrder {
  order: any;
  detectedAt: Date;
}

export interface CancelOrderAlertState {
  queue: CancelledOrder[];
  dismiss: (id: string) => void;
}

/**
 * Polls for newly-cancelled orders every 5 s.
 * When a new cancellation is detected, it is pushed onto a queue and the
 * cancel buzzer loops until the user clicks OK on every queued popup.
 */
export function useCancelOrderAlert(): CancelOrderAlertState {
  const [queue, setQueue] = useState<CancelledOrder[]>([]);

  const knownIdsRef    = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const audioRef       = useRef<HTMLAudioElement | null>(null);

  // Loop the cancel buzzer while there are unacknowledged cancellations
  useEffect(() => {
    if (queue.length > 0) {
      if (!audioRef.current) {
        const audio = new Audio("/cancel-alert.wav");
        audio.loop = true;
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

  // Polling for cancelled orders
  useEffect(() => {
    const poll = async () => {
      try {
        const scope = getCurrentAdminScope();
        if (!scope.role) return;

        const now    = new Date();
        const istNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
        const today  = istNow.toISOString().slice(0, 10);

        const params = new URLSearchParams({
          status: "cancelled",
          date: today,
          limit: "200",
        });

        if (scope.role !== "master_admin") {
          if (scope.subHubIds.length > 0)
            params.set("subHubId", scope.subHubIds[0]);
          else if (scope.superHubIds.length > 0)
            params.set("superHubId", scope.superHubIds[0]);
        }

        const data = await apiFetch(`/api/orders?${params}`);
        const orders: any[] = data.orders ?? [];

        if (!initializedRef.current) {
          // Seed existing cancelled orders so we don't alert for old ones
          for (const o of orders) knownIdsRef.current.add(String(o._id));
          initializedRef.current = true;
          return;
        }

        const newCancelled: any[] = [];
        for (const o of orders) {
          const id = String(o._id);
          if (!knownIdsRef.current.has(id)) {
            newCancelled.push(o);
            knownIdsRef.current.add(id);
          }
        }

        if (newCancelled.length === 0) return;

        setQueue(q => [
          ...q,
          ...newCancelled.map(o => ({ order: o, detectedAt: new Date() })),
        ]);
      } catch {
        // Silent — never disrupt the UI
      }
    };

    const id = setInterval(poll, POLL_MS);
    poll();
    return () => clearInterval(id);
  }, []);

  const dismiss = useCallback((orderId: string) => {
    setQueue(q => q.filter(p => String(p.order._id) !== orderId));
  }, []);

  return { queue, dismiss };
}
