import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { Camera, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function OrderQrScanner({ open, onOpenChange, onSuccess }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [starting, setStarting] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !videoRef.current) return;
    let active = true;
    setStarting(true);
    const scanner = new QrScanner(videoRef.current, async (result) => {
      if (!active) return;
      active = false;
      scanner.stop();
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
        toast({ title: "Order dispatched", description: "The order is now out for delivery." });
        onOpenChange(false);
        onSuccess();
      } catch (error: any) {
        toast({ title: "Scan failed", description: error.message, variant: "destructive" });
        if (active) scanner.start().catch(() => undefined);
      }
    }, { highlightScanRegion: true, highlightCodeOutline: true });
    scannerRef.current = scanner;
    scanner.start()
      .then(() => { if (active) setStarting(false); })
      .catch(() => {
        if (active) {
          setStarting(false);
          toast({ title: "Camera unavailable", description: "Allow camera access and try again.", variant: "destructive" });
        }
      });
    return () => {
      active = false;
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [open, onOpenChange, onSuccess, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5 text-[#1A56DB]" /> Scan order QR</DialogTitle>
        </DialogHeader>
        <div className="relative mx-5 mt-2 aspect-square overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {starting && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"><Loader2 className="h-7 w-7 animate-spin" /><span className="text-sm">Starting camera…</span></div>}
        </div>
        <p className="px-5 py-3 text-center text-sm text-black/55">Point the camera at the QR code printed at the bottom of the customer invoice.</p>
        <div className="flex justify-end border-t px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="mr-1.5 h-4 w-4" />Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}