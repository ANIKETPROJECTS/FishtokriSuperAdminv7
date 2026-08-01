import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, RefreshCw, Send, MessageSquare, Check, CheckCheck,
  Clock, X, ChevronLeft, Phone, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function getToken() { return localStorage.getItem("fishtokri_token") || ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

type ChatState = "ACTIVE" | "REQ" | "CLOSED" | "DOR" | string;

interface Contact {
  number: string;
  name: string;
  chatstate: ChatState;
  lastmessage?: {
    timestamp: string;
    template?: string;
    type?: string;
    text?: { body: string };
    status?: string;
    from?: string;
  };
  tags?: string[];
  interactions?: { active: string[]; closed: string[] };
}

interface Message {
  id: string;
  timestamp: string;
  // outbound template
  template?: string;
  status?: string;
  // inbound text
  type?: string;
  from?: string;
  from_user_id?: string;
  text?: { body: string };
  newMessage?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: string) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatFullTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function getInitials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-teal-500", "bg-purple-500", "bg-blue-500", "bg-green-500",
  "bg-amber-500", "bg-pink-500", "bg-indigo-500", "bg-rose-500",
];
function avatarColor(str: string) {
  let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function lastMessagePreview(c: Contact): string {
  const lm = c.lastmessage;
  if (!lm) return "";
  if (lm.template) return `📋 ${lm.template}`;
  if (lm.text?.body) return lm.text.body.slice(0, 60);
  return "";
}

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:  { label: "Active",    color: "text-green-700",  bg: "bg-green-100" },
  REQ:     { label: "Request",   color: "text-amber-700",  bg: "bg-amber-100" },
  CLOSED:  { label: "Closed",    color: "text-gray-600",   bg: "bg-gray-100"  },
  DOR:     { label: "DOR",       color: "text-blue-700",   bg: "bg-blue-100"  },
};
function stateMeta(s: string) {
  return STATE_META[s] ?? { label: s, color: "text-gray-600", bg: "bg-gray-100" };
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, contactName }: { msg: Message; contactName: string }) {
  const isInbound = !!msg.from || !!msg.from_user_id;
  const isTemplate = !!msg.template && !msg.from;
  const time = formatFullTime(msg.timestamp);

  if (isTemplate) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[75%]">
          <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Template</span>
            </div>
            <p className="text-[13px] text-gray-800 font-medium break-words">{msg.template}</p>
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[11px] text-gray-500">{time}</span>
              {msg.status === "delivered" || msg.status === "accepted" ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
              ) : msg.status === "sent" ? (
                <Check className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInbound) {
    return (
      <div className="flex items-end gap-2 mb-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${avatarColor(contactName)}`}>
          {getInitials(contactName)}
        </div>
        <div className="max-w-[75%]">
          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm border border-black/5">
            <p className="text-[13px] text-gray-800 break-words">{msg.text?.body || "—"}</p>
            <span className="text-[11px] text-gray-400 mt-1 block">{time}</span>
          </div>
        </div>
      </div>
    );
  }

  // Outbound text (non-template)
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[75%]">
        <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm">
          <p className="text-[13px] text-gray-800 break-words">{msg.text?.body || "—"}</p>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[11px] text-gray-500">{time}</span>
            {msg.status === "delivered" || msg.status === "read" ? (
              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Check className="w-3.5 h-3.5 text-gray-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = "ACTIVE" | "REQ" | "CLOSED";

export default function LiveChatPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [search, setSearch] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Contacts ──────────────────────────────────────────────────────────────
  const { data: contactsRaw = [], isLoading: loadingContacts, refetch: refetchContacts, isFetching: fetchingContacts } = useQuery<Contact[]>({
    queryKey: ["live-chat-contacts"],
    queryFn: () => apiFetch("/api/live-chat/contacts"),
    refetchInterval: 30_000,
  });

  // Sort by last-message timestamp desc
  const contactsSorted = useMemo(() => {
    return [...contactsRaw].sort((a, b) => {
      const ta = a.lastmessage?.timestamp ?? "";
      const tb = b.lastmessage?.timestamp ?? "";
      return tb.localeCompare(ta);
    });
  }, [contactsRaw]);

  const tabContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contactsSorted.filter((c) => {
      const matchTab =
        tab === "ACTIVE" ? c.chatstate === "ACTIVE" :
        tab === "REQ"    ? c.chatstate === "REQ" :
        /* CLOSED */        c.chatstate === "CLOSED" || c.chatstate === "DOR";
      if (!matchTab) return false;
      if (!q) return true;
      return (c.name || "").toLowerCase().includes(q) || c.number.includes(q);
    });
  }, [contactsSorted, tab, search]);

  const tabCounts = useMemo(() => ({
    ACTIVE: contactsSorted.filter((c) => c.chatstate === "ACTIVE").length,
    REQ:    contactsSorted.filter((c) => c.chatstate === "REQ").length,
    CLOSED: contactsSorted.filter((c) => c.chatstate === "CLOSED" || c.chatstate === "DOR").length,
  }), [contactsSorted]);

  const selectedContact = useMemo(
    () => contactsRaw.find((c) => c.number === selectedNumber) ?? null,
    [contactsRaw, selectedNumber],
  );

  // ── Messages ─────────────────────────────────────────────────────────────
  const { data: messagesData, isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
    queryKey: ["live-chat-messages", selectedNumber],
    queryFn: () => apiFetch(`/api/live-chat/messages/${selectedNumber}`),
    enabled: !!selectedNumber,
    refetchInterval: 15_000,
  });

  const messages: Message[] = messagesData?.messages ?? [];

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Send ─────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (body: { number: string; message: string }) =>
      apiFetch("/api/live-chat/send", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      setMessage("");
      setTimeout(() => refetchMessages(), 800);
      queryClient.invalidateQueries({ queryKey: ["live-chat-contacts"] });
    },
    onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    if (!selectedNumber || !message.trim()) return;
    sendMutation.mutate({ number: selectedNumber, message: message.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectContact = (c: Contact) => {
    setSelectedNumber(c.number);
    setMobileView("chat");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-[#F0F2F5]" style={{ fontFamily: "Poppins, sans-serif" }}>

      {/* ── Left panel: Contact List ────────────────────────────────────────── */}
      <div className={`flex flex-col w-full md:w-[340px] flex-shrink-0 bg-white border-r border-gray-200 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>

        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center">
                <MessageSquare className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Live Chat</h2>
                <p className="text-[11px] text-gray-400 font-medium">WhatsApp Business</p>
              </div>
            </div>
            <button
              onClick={() => { refetchContacts(); }}
              disabled={fetchingContacts}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${fetchingContacts ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full h-9 pl-9 pr-8 text-[13px] bg-[#F0F2F5] rounded-xl border-none outline-none text-gray-800 placeholder:text-gray-400 font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(["ACTIVE", "REQ", "CLOSED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[12px] font-bold uppercase tracking-wide transition-colors relative ${
                tab === t ? "text-[#25D366]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t === "ACTIVE" ? "Active" : t === "REQ" ? "Requests" : "Closed"}
              {tabCounts[t] > 0 && (
                <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  tab === t ? "bg-[#25D366] text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  {tabCounts[t]}
                </span>
              )}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />}
            </button>
          ))}
        </div>

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Loading chats…</p>
            </div>
          ) : tabContacts.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-medium">No conversations here</p>
            </div>
          ) : (
            tabContacts.map((c) => {
              const isSelected = c.number === selectedNumber;
              const preview = lastMessagePreview(c);
              const sm = stateMeta(c.chatstate);
              const hasNew = c.lastmessage?.from || (c.chatstate === "REQ");
              return (
                <button
                  key={c.number}
                  onClick={() => handleSelectContact(c)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-50 ${
                    isSelected ? "bg-[#F0FFF4]" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 ${avatarColor(c.name || c.number)}`}>
                    {getInitials(c.name || c.number)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[14px] font-semibold text-gray-900 truncate">{c.name || c.number}</span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 font-medium">
                        {c.lastmessage?.timestamp ? formatTime(c.lastmessage.timestamp) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <span className="text-[12px] text-gray-500 truncate flex-1">{preview}</span>
                      {hasNew && (
                        <span className="w-2 h-2 rounded-full bg-[#25D366] flex-shrink-0" />
                      )}
                    </div>
                    <div className="mt-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
                        {sm.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: Chat Window ─────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-5">
              <MessageSquare className="w-10 h-10 text-[#25D366] opacity-70" />
            </div>
            <h3 className="text-[18px] font-bold text-gray-700 mb-1">WhatsApp Business</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Select a conversation from the left to view messages and reply to customers.
            </p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setMobileView("list")}
                className="md:hidden p-1 -ml-1 rounded-full hover:bg-gray-100"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>

              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0 ${avatarColor(selectedContact.name || selectedContact.number)}`}>
                {getInitials(selectedContact.name || selectedContact.number)}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900 truncate">{selectedContact.name || selectedContact.number}</p>
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 text-gray-400" />
                  <span className="text-[12px] text-gray-500 font-medium">{selectedContact.number}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stateMeta(selectedContact.chatstate).bg} ${stateMeta(selectedContact.chatstate).color}`}>
                    {stateMeta(selectedContact.chatstate).label}
                  </span>
                </div>
              </div>

              <button
                onClick={() => refetchMessages()}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Refresh messages"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Messages area */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-0"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E\")", backgroundColor: "#E5DDD5" }}
            >
              {loadingMessages ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No messages yet</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} contactName={selectedContact.name || selectedContact.number} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Closed chat notice */}
            {(selectedContact.chatstate === "CLOSED" || selectedContact.chatstate === "DOR") ? (
              <div className="bg-white border-t border-gray-200 px-5 py-4 flex items-center gap-3">
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-400 text-center font-medium">
                  This chat is closed
                </div>
              </div>
            ) : (
              /* Input box */
              <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-end gap-3">
                <div className="flex-1 bg-[#F0F2F5] rounded-2xl px-4 py-2.5 min-h-[44px] flex items-end">
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type / to use canned messages… (Shift+Enter for new line)"
                    rows={1}
                    className="flex-1 w-full bg-transparent border-none outline-none text-[13px] text-gray-800 placeholder:text-gray-400 resize-none max-h-32 font-medium leading-5"
                    style={{ fontFamily: "Poppins, sans-serif" }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  className="w-11 h-11 rounded-full bg-[#25D366] hover:bg-[#20BA5A] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {sendMutation.isPending
                    ? <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
