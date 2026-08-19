import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function OrderQrScanner({ open, onOpenChange, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const activeRef = useRef(false);
  const handlingRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);
  const onSuccessRef = useRef(onSuccess);
  const toastRef = useRef(toast);
  const [starting, setStarting] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [retry, setRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  onOpenChangeRef.current = onOpenChange;
  onSuccessRef.current = onSuccess;
  toastRef.current = toast;

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let active = true;
    activeRef.current = true;
    handlingRef.current = false;
    setStarting(true);
    setCameraError("");
    setSubmitting(false);
    const scanner = new QrScanner(videoRef.current, async (result) => {
      if (!active || handlingRef.current) return;
      handlingRef.current = true;
      scanner.stop();
      setSubmitting(true);
      try {
        const token = localStorage.getItem("fishtokri_token") || "";
        const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
        const res = await fetch(`${base}/api/orders/dispatch-by-qr`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token: result.data }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Could not dispatch this order");
        toastRef.current({ title: "Order dispatched", description: "The order is now out for delivery." });
        onOpenChangeRef.current(false);
        onSuccessRef.current();
      } catch (error: any) {
        toastRef.current({ title: "Scan failed", description: error.message, variant: "destructive" });
        handlingRef.current = false;
        setSubmitting(false);
        if (active) scanner.start().catch(() => {
          setCameraError("The camera stopped. Tap Try again to restart it.");
        });
      }
    }, {
      preferredCamera: "environment",
      maxScansPerSecond: 5,
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });
    scannerRef.current = scanner;
    const startupTimeout = window.setTimeout(() => {
      if (!active) return;
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
      setStarting(false);
      setCameraError("Camera startup is taking too long. Check camera permission and try again.");
    }, 10000);
    scanner.start()
      .then(() => { if (active) { window.clearTimeout(startupTimeout); setStarting(false); } })
      .catch(() => {
        if (active) {
          window.clearTimeout(startupTimeout);
          setStarting(false);
          setCameraError("Camera access was blocked or is unavailable on this device.");
        }
      });
    return () => {
      active = false;
      activeRef.current = false;
      window.clearTimeout(startupTimeout);
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [open, retry]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5 text-[#1A56DB]" /> Scan order QR</DialogTitle>
        </DialogHeader>
        <div className="relative mx-5 mt-2 aspect-square overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {starting && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"><Loader2 className="h-7 w-7 animate-spin" /><span className="text-sm">Starting camera…</span></div>}
          {!starting && cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-8 text-center text-white">
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
        <p className="px-5 py-3 text-center text-sm text-black/55">Point the camera at the QR code printed at the bottom of the customer invoice.</p>
        <div className="flex justify-end border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="mr-1.5 h-4 w-4" />Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}