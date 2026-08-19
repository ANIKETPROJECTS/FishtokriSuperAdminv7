import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { AlertTriangle, Camera, Loader2, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SCANNER_ID = "fishtokri-order-qr-reader";

function extractOrderQrToken(decodedText: string): string {
  const text = decodedText.trim();
  try {
    const url = new URL(text);
    return url.searchParams.get("order_qr") || text;
  } catch {
    // Keep accepting previously printed token-only QR codes.
    return text;
  }
}

export function OrderQrScanner({ open, onOpenChange, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  const onSuccessRef = useRef(onSuccess);
  const toastRef = useRef<ReturnType<typeof useToast>["toast"]>();
  const { toast } = useToast();
  const [starting, setStarting] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [retry, setRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [assignedMessage, setAssignedMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  onOpenChangeRef.current = onOpenChange;
  onSuccessRef.current = onSuccess;
  toastRef.current = toast;

  useEffect(() => {
    if (!open) return;
    // Radix renders DialogContent through a portal. On the first effect pass
    // the scanner host may not exist yet, so wait for the portal before
    // constructing Html5Qrcode (it throws if the element ID is missing).
    if (!document.getElementById(SCANNER_ID)) {
      const mountRetry = window.setTimeout(() => setRetry((value) => value + 1), 50);
      return () => window.clearTimeout(mountRetry);
    }
    let active = true;
    handlingRef.current = false;
    setStarting(true);
    setCameraError("");
    setSubmitting(false);

    const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false });
    scannerRef.current = scanner;
    const startupTimeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      scannerRef.current = null;
      scanner.stop().catch(() => undefined).then(() => {
        try { if (document.getElementById(SCANNER_ID)) scanner.clear(); } catch { /* already unmounted */ }
      });
      setStarting(false);
      setCameraError("Camera startup timed out. Allow camera access, then try again.");
    }, 8000);

    const handleDecoded = async (decodedText: string) => {
      if (!active || handlingRef.current) return;
      handlingRef.current = true;
      setSubmitting(true);
      await scanner.stop().catch(() => undefined);
      if (scannerRef.current === scanner) scannerRef.current = null;
      try { if (document.getElementById(SCANNER_ID)) scanner.clear(); } catch { /* dialog may be closing */ }
      try {
        const token = localStorage.getItem("fishtokri_token") || "";
        const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
        const res = await fetch(`${base}/api/orders/dispatch-by-qr`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token: extractOrderQrToken(decodedText) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.error === "AlreadyAssigned") {
            active = false;
            setSubmitting(false);
            onOpenChangeRef.current(false);
            window.setTimeout(() => {
              setAssignedMessage(
                data.message || `This order is already assigned to ${data.assignedDeliveryPersonName || "another delivery partner"}`,
              );
            }, 180);
            return;
          }
          if (data.error === "Unavailable" && data.orderStatus) {
            active = false;
            setSubmitting(false);
            onOpenChangeRef.current(false);
            window.setTimeout(() => {
              setStatusMessage(data.message || `This order is already ${data.orderStatus}.`);
            }, 180);
            return;
          }
          throw new Error(data.message || "Could not dispatch this order");
        }
        toastRef.current?.({ title: "Order dispatched", description: "The order is now out for delivery." });
        active = false;
        onOpenChangeRef.current(false);
        // Let Radix finish unmounting the camera portal before refreshing the list.
        window.setTimeout(() => onSuccessRef.current(), 0);
      } catch (error: any) {
        toastRef.current?.({ title: "Scan failed", description: error.message, variant: "destructive" });
        if (active) {
          handlingRef.current = false;
          setSubmitting(false);
          scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
            handleDecoded,
            () => undefined,
          ).catch(() => setCameraError("The camera stopped. Tap Try again to restart it."));
        }
      }
    };

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
      handleDecoded,
      () => undefined,
    ).then(() => {
      if (active) {
        window.clearTimeout(startupTimeout);
        setStarting(false);
      }
    }).catch(() => {
      if (active) {
        window.clearTimeout(startupTimeout);
        setStarting(false);
        setCameraError("Camera access was blocked or is unavailable on this device.");
      }
    });

    return () => {
      active = false;
      window.clearTimeout(startupTimeout);
      // A successful decode already stopped and disposed this instance.
      // Do not call html5-qrcode cleanup a second time during portal unmount.
      if (scannerRef.current !== scanner) return;
      scannerRef.current = null;
      scanner.stop().catch(() => undefined).then(() => {
        try { if (document.getElementById(SCANNER_ID)) scanner.clear(); } catch { /* already unmounted */ }
      });
    };
  }, [open, retry]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#1A56DB]" /> Scan order QR
          </DialogTitle>
        </DialogHeader>
        <div className="relative mx-5 mt-2 aspect-square overflow-hidden rounded-2xl bg-black">
          <div id={SCANNER_ID} className="h-full w-full [& video]:h-full [& video]:w-full [& video]:object-cover" />
          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black text-white">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-sm">Opening camera…</span>
            </div>
          )}
          {!starting && cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-8 text-center text-white">
              <Camera className="h-9 w-9 text-white/80" />
              <p className="text-sm">{cameraError}</p>
              <Button onClick={() => setRetry((value) => value + 1)} className="gap-2 bg-white text-black hover:bg-white/90">
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          )}
          {submitting && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 text-white">
              <Loader2 className="h-7 w-7 animate-spin" />
              <span className="text-sm">Assigning order…</span>
            </div>
          )}
        </div>
        <p className="px-5 py-3 text-center text-sm text-black/55">
          Point the camera at the QR code printed at the bottom of the customer invoice.
        </p>
        <div className="flex justify-end border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-1.5 h-4 w-4" />Cancel
          </Button>
        </div>
      </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(assignedMessage)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setAssignedMessage(""); }}
      >
        <DialogContent className="max-w-sm overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-amber-50 via-white to-orange-50 px-6 pb-6 pt-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-8 ring-amber-50">
              <AlertTriangle className="h-7 w-7 text-amber-600" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-bold text-gray-900">Order already assigned</DialogTitle>
              <DialogDescription className="text-base leading-6 text-gray-600">
                {assignedMessage}
              </DialogDescription>
            </DialogHeader>
            <Button
              className="mt-5 w-full rounded-xl bg-[#1A56DB] py-5 font-semibold hover:bg-[#1447B4]"
              onClick={() => setAssignedMessage("")}
            >
              Okay, got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(statusMessage)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setStatusMessage(""); }}
      >
        <DialogContent className="max-w-sm overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-red-50 via-white to-rose-50 px-6 pb-6 pt-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 ring-8 ring-red-50">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-bold text-gray-900">Order unavailable</DialogTitle>
              <DialogDescription className="text-base leading-6 text-gray-600">
                {statusMessage}
              </DialogDescription>
            </DialogHeader>
            <Button
              className="mt-5 w-full rounded-xl bg-[#1A56DB] py-5 font-semibold hover:bg-[#1447B4]"
              onClick={() => setStatusMessage("")}
            >
              Okay, got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}