import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Tags, FolderOpen, Search, Plus, Trash2, Edit2, X,
  RefreshCw, ChevronDown, Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
function getToken() { return localStorage.getItem("fishtokri_token") || ""; }
async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, ...(opts?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface WaContact {
  number: string;
  name: string;
  chatstate: string;
  tags: string[];
  campaigns: string[];
  groups: string[];
  interactions: { active: string[]; closed: string[] };
  lastmessage?: { timestamp: string };
}
interface WaGroup { _id: string; name: string; members: string[]; createdAt: string }
interface WaTag   { _id: string; name: string; color: string; createdAt: string }

// ── Chat state badge ──────────────────────────────────────────────────────────
const STATE_STYLE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  REQ:    "bg-amber-100 text-amber-700",
  CLOSED: "bg-gray-100 text-gray-600",
  DOR:    "bg-blue-100 text-blue-700",
};
function ChatStateBadge({ state }: { state: string }) {
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${STATE_STYLE[state] ?? "bg-gray-100 text-gray-500"}`}>
      {state}
    </span>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-[15px] font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-[13px] text-gray-600 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-red-500 hover:bg-red-600">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Contact modal ─────────────────────────────────────────────────────────
function EditContactModal({ contact, onClose, onSave }: {
  contact: WaContact; onClose: () => void; onSave: (number: string, name: string) => void;
}) {
  const [name, setName] = useState(contact.name === "Unknown" ? "" : contact.name);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-gray-900">Edit Contact</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <p className="text-[12px] text-gray-400 mb-1">Phone Number</p>
        <p className="text-[13px] font-medium text-gray-700 mb-3">{contact.number}</p>
        <label className="block text-[12px] text-gray-500 mb-1">Name</label>
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Enter contact name"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] outline-none focus:ring-2 focus:ring-[#25D366]/30 mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(contact.number, name.trim())} className="px-4 py-2 rounded-lg text-[13px] font-medium text-white bg-[#25D366] hover:bg-[#20BA5A]">Save</button>
        </div>
      </div>
    </div>
  );
}

// ── CONTACTS tab ──────────────────────────────────────────────────────────────
function ContactsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [editContact, setEditContact] = useState<WaContact | null>(null);
  const [deleteContact, setDeleteContact] = useState<WaContact | null>(null);

  const { data: contacts = [], isLoading, refetch, isFetching } = useQuery<WaContact[]>({
    queryKey: ["wa-contacts"],
    queryFn: () => apiFetch("/api/live-chat/wa-contacts"),
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c => {
      if (stateFilter !== "ALL" && c.chatstate !== stateFilter) return false;
      if (!q) return true;
      return c.number.includes(q) || (c.name || "").toLowerCase().includes(q);
    });
  }, [contacts, search, stateFilter]);

  const editMutation = useMutation({
    mutationFn: ({ number, name }: { number: string; name: string }) =>
      apiFetch("/api/live-chat/wa-contacts/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, name }) }),
    onSuccess: () => { toast({ title: "Contact updated" }); qc.invalidateQueries({ queryKey: ["wa-contacts"] }); setEditContact(null); },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (number: string) =>
      apiFetch("/api/live-chat/wa-contacts/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number }) }),
    onSuccess: () => { toast({ title: "Contact deleted" }); qc.invalidateQueries({ queryKey: ["wa-contacts"] }); setDeleteContact(null); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const STATES = ["ALL", "ACTIVE", "REQ", "CLOSED", "DOR"];

  return (
    <>
      {editContact && (
        <EditContactModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onSave={(number, name) => editMutation.mutate({ number, name })}
        />
      )}
      {deleteContact && (
        <ConfirmDialog
          title="Delete Contact"
          message={`Delete contact ${deleteContact.name !== "Unknown" ? deleteContact.name : ""} (${deleteContact.number})?`}
          onConfirm={() => deleteMutation.mutate(deleteContact.number)}
          onCancel={() => setDeleteContact(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full h-9 pl-8 pr-3 text-[12px] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#25D366]/20 bg-white"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3 h-3 text-gray-400" /></button>}
        </div>
        {/* State filter */}
        <div className="flex gap-1 flex-wrap">
          {STATES.map(s => (
            <button key={s} onClick={() => setStateFilter(s)}
              className={`px-3 h-9 rounded-lg text-[11px] font-bold transition-colors ${stateFilter === s ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="h-9 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-1.5 text-[12px]">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
        <span className="text-[12px] text-gray-400 ml-auto">{filtered.length} contacts</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Phone Number</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Chat State</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Interactions</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Campaigns</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Tags</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-300" />Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">No contacts found</td></tr>
              ) : filtered.map(c => (
                <tr key={c.number} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.number}</td>
                  <td className="px-4 py-3 text-gray-700">{c.name || "Unknown"}</td>
                  <td className="px-4 py-3"><ChatStateBadge state={c.chatstate} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-[10px] font-bold">{c.interactions?.active?.length ?? 0}</span>
                        <span className="text-[9px] text-gray-400 mt-0.5">ACTIVE</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-400 text-white text-[10px] font-bold">{c.interactions?.closed?.length ?? 0}</span>
                        <span className="text-[9px] text-gray-400 mt-0.5">CLOSED</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.campaigns?.length ? c.campaigns.join(", ") : "No campaigns"}</td>
                  <td className="px-4 py-3">
                    {c.tags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map(t => (
                          <span key={t} className="inline-block bg-blue-100 text-blue-700 text-[9px] font-semibold px-1.5 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    ) : <span className="text-gray-400">No tags</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => setEditContact(c)}
                        className="px-2.5 py-1 rounded border border-[#25D366] text-[#25D366] text-[11px] font-bold hover:bg-[#25D366]/10 transition-colors">
                        EDIT
                      </button>
                      <button onClick={() => setDeleteContact(c)}
                        className="px-2.5 py-1 rounded border border-red-400 text-red-500 text-[11px] font-bold hover:bg-red-50 transition-colors">
                        DELETE
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── GROUPS tab ────────────────────────────────────────────────────────────────
function GroupsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [deleteGroup, setDeleteGroup] = useState<WaGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: raw, isLoading, refetch } = useQuery<{ groups: WaGroup[] }>({
    queryKey: ["wa-groups"],
    queryFn: () => apiFetch("/api/live-chat/wa-groups"),
  });
  const groups = raw?.groups ?? [];

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/live-chat/wa-groups/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
    onSuccess: () => { toast({ title: "Group created" }); qc.invalidateQueries({ queryKey: ["wa-groups"] }); setNewName(""); setCreating(false); },
    onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/live-chat/wa-groups/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
    onSuccess: () => { toast({ title: "Group deleted" }); qc.invalidateQueries({ queryKey: ["wa-groups"] }); setDeleteGroup(null); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      {deleteGroup && (
        <ConfirmDialog
          title="Delete Group"
          message={`Delete group "${deleteGroup.name}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(deleteGroup.name)}
          onCancel={() => setDeleteGroup(null)}
        />
      )}
      <div className="max-w-2xl">
        {/* Create form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">Create New Group</h3>
          {creating ? (
            <div className="flex gap-2">
              <input
                type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Group name…"
                className="flex-1 h-9 px-3 text-[13px] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#25D366]/20"
                onKeyDown={e => e.key === "Enter" && newName.trim() && createMutation.mutate(newName.trim())}
                autoFocus
              />
              <button onClick={() => createMutation.mutate(newName.trim())} disabled={!newName.trim() || createMutation.isPending}
                className="h-9 px-4 rounded-lg bg-[#25D366] text-white text-[12px] font-bold hover:bg-[#20BA5A] disabled:opacity-50 flex items-center gap-1.5">
                {createMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Create
              </button>
              <button onClick={() => { setCreating(false); setNewName(""); }} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[12px]">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setCreating(true)}
              className="h-9 px-4 rounded-lg bg-[#25D366] text-white text-[12px] font-bold hover:bg-[#20BA5A] flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Group
            </button>
          )}
        </div>

        {/* Groups list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-bold text-gray-800">Groups <span className="text-gray-400 font-normal">({groups.length})</span></h3>
            <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100"><RefreshCw className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
          {isLoading ? (
            <div className="py-10 text-center text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-300" />Loading…</div>
          ) : groups.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <FolderOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              No groups yet
            </div>
          ) : groups.map(g => (
            <div key={g._id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 hover:bg-gray-50/50">
              <div>
                <p className="text-[13px] font-semibold text-gray-800">{g.name}</p>
                <p className="text-[11px] text-gray-400">{g.members?.length ?? 0} members · {new Date(g.createdAt).toLocaleDateString("en-IN")}</p>
              </div>
              <button onClick={() => setDeleteGroup(g)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── TAGS tab ──────────────────────────────────────────────────────────────────
const TAG_COLORS = ["#4caf50","#2196f3","#f44336","#ff9800","#9c27b0","#00bcd4","#e91e63","#607d8b","#795548","#ffc107"];

function TagsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [deleteTag, setDeleteTag] = useState<WaTag | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: raw, isLoading, refetch } = useQuery<{ tags: WaTag[] }>({
    queryKey: ["wa-tags"],
    queryFn: () => apiFetch("/api/live-chat/wa-tags"),
  });
  const tags = raw?.tags ?? [];

  const createMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      apiFetch("/api/live-chat/wa-tags/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, color }) }),
    onSuccess: () => { toast({ title: "Tag created" }); qc.invalidateQueries({ queryKey: ["wa-tags"] }); setNewName(""); setCreating(false); },
    onError: (e: any) => toast({ title: "Create failed", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch("/api/live-chat/wa-tags/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }),
    onSuccess: () => { toast({ title: "Tag deleted" }); qc.invalidateQueries({ queryKey: ["wa-tags"] }); setDeleteTag(null); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      {deleteTag && (
        <ConfirmDialog
          title="Delete Tag"
          message={`Delete tag "${deleteTag.name}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate(deleteTag.name)}
          onCancel={() => setDeleteTag(null)}
        />
      )}
      <div className="max-w-2xl">
        {/* Create form */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">Create New Tag</h3>
          {creating ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Tag name…"
                  className="flex-1 h-9 px-3 text-[13px] border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#25D366]/20"
                  autoFocus
                />
              </div>
              <div>
                <p className="text-[11px] text-gray-500 mb-2">Choose colour</p>
                <div className="flex flex-wrap gap-2">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${newColor === c ? "border-gray-800 scale-110" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-gray-400">
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="opacity-0 absolute w-0 h-0" />
                    <Plus className="w-3 h-3 text-gray-400" />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => createMutation.mutate({ name: newName.trim(), color: newColor })}
                  disabled={!newName.trim() || createMutation.isPending}
                  className="h-9 px-4 rounded-lg bg-[#25D366] text-white text-[12px] font-bold hover:bg-[#20BA5A] disabled:opacity-50 flex items-center gap-1.5">
                  {createMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Create
                </button>
                <button onClick={() => { setCreating(false); setNewName(""); setNewColor(TAG_COLORS[0]); }}
                  className="h-9 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-[12px]">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreating(true)}
              className="h-9 px-4 rounded-lg bg-[#25D366] text-white text-[12px] font-bold hover:bg-[#20BA5A] flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Tag
            </button>
          )}
        </div>

        {/* Tags list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-bold text-gray-800">Tags <span className="text-gray-400 font-normal">({tags.length})</span></h3>
            <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:bg-gray-100"><RefreshCw className="w-3.5 h-3.5 text-gray-400" /></button>
          </div>
          {isLoading ? (
            <div className="py-10 text-center text-gray-400"><RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-300" />Loading…</div>
          ) : tags.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Tags className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              No tags yet
            </div>
          ) : tags.map(t => (
            <div key={t._id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 hover:bg-gray-50/50">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <div>
                  <p className="text-[13px] font-semibold text-gray-800">{t.name}</p>
                  <p className="text-[11px] text-gray-400">{new Date(t.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
              </div>
              <button onClick={() => setDeleteTag(t)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type Tab = "contacts" | "groups" | "tags";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "contacts", label: "Contacts",      icon: Users },
  { id: "groups",   label: "Manage Groups", icon: FolderOpen },
  { id: "tags",     label: "Manage Tags",   icon: Tags },
];

export default function WaContactsPage() {
  const [tab, setTab] = useState<Tab>("contacts");

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* Section header + tabs */}
      <div className="bg-white border-b border-gray-100 px-6 pt-4 pb-0 flex-shrink-0">
        <div className="flex items-center gap-6">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 pb-3 text-[13px] font-semibold border-b-2 transition-colors relative ${
                  active ? "border-[#25D366] text-[#25D366]" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description banner */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex-shrink-0">
        <p className="text-[12px] text-blue-700">
          {tab === "contacts" && "The Contacts section displays a detailed list of individual contacts. Each row shows the phone number, name, chat state (REQ / DOR / ACTIVE / CLOSED), interactions, campaigns, tags, and actions."}
          {tab === "groups" && "Manage Groups lets you organise contacts into named groups for bulk messaging and segmentation."}
          {tab === "tags" && "Manage Tags lets you create colour-coded tags to categorise and filter contacts efficiently."}
        </p>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === "contacts" && <ContactsTab />}
        {tab === "groups"   && <GroupsTab />}
        {tab === "tags"     && <TagsTab />}
      </div>
    </div>
  );
}
