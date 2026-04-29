import { useEffect, useState } from "react";
import { KeyRound, Check, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type ResetRequest = {
  id: string;
  email: string;
  name: string;
  role: string;
  note: string;
  status: "pending" | "resolved" | "rejected";
  createdAt: string;
  resolvedAt?: string | null;
  resolvedByEmail?: string;
};

function getToken() {
  return localStorage.getItem("fishtokri_token") || "";
}
function getBase() {
  return import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${getBase()}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const ROLE_LABEL: Record<string, string> = {
  super_hub: "Super Hub",
  sub_hub: "Sub Hub",
  delivery_person: "Delivery Partner",
};

export default function PasswordResetInbox() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const [resolveTarget, setResolveTarget] = useState<ResetRequest | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api("/api/auth/password-reset-requests");
      setRequests(data.requests || []);
    } catch (err: any) {
      toast({ title: "Could not load requests", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = requests.filter((r) => (showResolved ? true : r.status === "pending"));
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const openResolve = (r: ResetRequest) => {
    setResolveTarget(r);
    setNewPassword("");
    setConfirmPassword("");
  };

  const submitResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveTarget) return;
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/auth/password-reset-requests/${resolveTarget.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      toast({
        title: "Password reset",
        description: `${resolveTarget.email} can now sign in with the new password. Share it with them securely.`,
      });
      setResolveTarget(null);
      load();
    } catch (err: any) {
      toast({ title: "Could not reset", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async (r: ResetRequest) => {
    if (!window.confirm(`Reject password reset request from ${r.email}?`)) return;
    try {
      await api(`/api/auth/password-reset-requests/${r.id}/reject`, { method: "POST" });
      toast({ title: "Request rejected" });
      load();
    } catch (err: any) {
      toast({ title: "Could not reject", description: err.message, variant: "destructive" });
    }
  };

  const remove = async (r: ResetRequest) => {
    if (!window.confirm("Delete this request from the inbox?")) return;
    try {
      await api(`/api/auth/password-reset-requests/${r.id}`, { method: "DELETE" });
      toast({ title: "Deleted" });
      load();
    } catch (err: any) {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#162B4D]">Password reset requests</div>
            <div className="text-xs text-gray-500">
              {pendingCount > 0
                ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"} from hub users`
                : "No pending requests"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              Show resolved & rejected
            </label>
            <button
              onClick={load}
              className="text-xs text-gray-500 hover:text-[#0D1F3C]"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-6">
              {loading ? "Loading…" : "Nothing here. New requests will appear automatically."}
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-gray-100 hover:border-gray-200 bg-gray-50/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#162B4D] truncate">
                        {r.name || r.email}
                      </span>
                      {r.role && (
                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                          {ROLE_LABEL[r.role] || r.role}
                        </span>
                      )}
                      {r.status === "resolved" && (
                        <span className="text-[10px] font-semibold bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                          Resolved
                        </span>
                      )}
                      {r.status === "rejected" && (
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          Rejected
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{r.email}</div>
                    {r.note && (
                      <div className="text-xs text-gray-600 mt-1 italic">"{r.note}"</div>
                    )}
                    <div className="text-[10px] text-gray-400 mt-1">
                      Requested {formatDate(r.createdAt)}
                      {r.resolvedAt ? ` • Closed ${formatDate(r.resolvedAt)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => openResolve(r)}
                          className="h-8 bg-[#0D1F3C] hover:bg-[#162B4D] text-white text-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Set password
                        </Button>
                        <button
                          onClick={() => reject(r)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => remove(r)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!resolveTarget} onOpenChange={(open) => !open && setResolveTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set new password</DialogTitle>
            <DialogDescription>
              Set a new password for <span className="font-semibold">{resolveTarget?.email}</span>.
              Share the new password with them through a secure channel.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitResolve} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">New password</Label>
              <Input
                type="text"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10"
                placeholder="At least 6 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Confirm new password</Label>
              <Input
                type="text"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10"
                placeholder="Re-enter password"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setResolveTarget(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[#0D1F3C] hover:bg-[#162B4D] text-white"
              >
                {submitting ? "Saving…" : "Save & resolve"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
