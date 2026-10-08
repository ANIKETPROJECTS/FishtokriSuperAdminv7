import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, RefreshCw, Send, MessageSquare, Check, CheckCheck,
  Clock, X, ChevronLeft, Phone, AlertCircle, Paperclip,
  Image, Video, FileText, Music2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function getToken() { return localStorage.getItem("fishtokri_token") || ""; }

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiBlobFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.blob();
}

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateVariables = Record<string, unknown> | unknown[] | string;

interface MessageMedia {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
  url?: string;
  cloudUrl?: string;
}

interface MessageReaction {
  emoji?: string;
  message_id?: string;
  messageId?: string;
}

interface Contact {
  number: string;
  name: string;
  chatstate: string;
  lastmessage?: {
    timestamp: string;
    template?: string;
    type?: string;
    text?: { body: string };
    variables?: TemplateVariables;
    image?: MessageMedia;
    video?: MessageMedia;
    audio?: MessageMedia;
    document?: MessageMedia;
    sticker?: MessageMedia;
    reaction?: MessageReaction | string;
    emoji?: string;
    status?: string;
    from?: string;
  };
}

interface Message {
  id: string;
  timestamp: string;
  template?: string;
  status?: string;
  type?: string;
  from?: string;
  from_user_id?: string;
  text?: { body: string };
  variables?: TemplateVariables;
  image?: MessageMedia;
  video?: MessageMedia;
  document?: MessageMedia;
  audio?: MessageMedia;
  sticker?: MessageMedia;
  reaction?: MessageReaction | string;
  emoji?: string;
  cloudUrl?: string;
  cloudId?: string;
  newMessage?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: string) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
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

function parseTemplateVariables(variables?: TemplateVariables): Record<string, unknown> | unknown[] {
  if (Array.isArray(variables)) return variables;
  if (typeof variables === "string") {
    try {
      const parsed = JSON.parse(variables);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return variables && typeof variables === "object" ? variables : {};
}

function renderTemplateBody(body: string | undefined, variables?: TemplateVariables): string | null {
  if (!body) return null;

  const parsedVariables = parseTemplateVariables(variables);
  const rendered = body.replace(/\{\{\s*(?:body)?(\d+)\s*\}\}/gi, (placeholder, index: string) => {
    const value = Array.isArray(parsedVariables)
      ? parsedVariables[Number(index) - 1]
      : parsedVariables[`body${index}`] ?? parsedVariables[index];
    return value === undefined || value === null ? placeholder : String(value);
  });

  // If Admark has no saved values for a placeholder, don't show template syntax
  // to agents; the caller can fall back to the template name instead.
  return /\{\{\s*(?:body)?\d+\s*\}\}/i.test(rendered) ? null : rendered;
}

function getReactionEmoji(reaction?: MessageReaction | string, fallbackEmoji?: string): string {
  if (typeof reaction === "string") return reaction;
  return reaction?.emoji || fallbackEmoji || "";
}

const AVATAR_COLORS = [
  "bg-teal-500", "bg-purple-500", "bg-blue-500", "bg-green-500",
  "bg-amber-500", "bg-pink-500", "bg-indigo-500", "bg-rose-500",
];
function avatarColor(str: string) {
  let h = 0; for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function lastMessagePreview(c: Contact, templateMap: Record<string, string> = {}): string {
  const lm = c.lastmessage;
  if (!lm) return "";
  if (lm.text?.body) {
    const renderedBody = renderTemplateBody(lm.text.body, lm.variables);
    if (renderedBody) return renderedBody.slice(0, 55);
    if (lm.template) return `📋 ${lm.template}`;
  }
  const type = (lm.type || "").toLowerCase();
  if (type === "reaction" || lm.reaction) {
    return `Reacted ${getReactionEmoji(lm.reaction, lm.emoji) || "to a message"}`;
  }
  if (type === "image") return "📷 Image";
  if (type === "video") return "🎥 Video";
  if (type === "audio") return "🎵 Audio";
  if (type === "document") return `📄 ${lm.document?.filename || "Document"}`;
  if (type === "sticker") return "🖼️ Sticker";
  if (lm.template) {
    const body = renderTemplateBody(templateMap[lm.template], lm.variables);
    if (body) return body.split("\n")[0].slice(0, 55); // first line of rendered template body
    return `📋 ${lm.template}`;
  }
  return "";
}

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Active",   color: "text-green-700", bg: "bg-green-100" },
  REQ:    { label: "Request",  color: "text-amber-700", bg: "bg-amber-100" },
  CLOSED: { label: "Closed",   color: "text-gray-600",  bg: "bg-gray-100"  },
  DOR:    { label: "DOR",      color: "text-blue-700",  bg: "bg-blue-100"  },
};
function sm(s: string) { return STATE_META[s] ?? { label: s, color: "text-gray-600", bg: "bg-gray-100" }; }

// ── Tick badge ────────────────────────────────────────────────────────────────

function Ticks({ status }: { status?: string }) {
  if (status === "delivered" || status === "read" || status === "accepted")
    return <CheckCheck className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />;
  if (status === "sent")
    return <Check className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
  return <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
}

type MediaKind = "image" | "video" | "document" | "audio" | "sticker";

function getMediaKind(msg: Message): MediaKind | null {
  const type = (msg.type || "").toLowerCase();
  if (msg.sticker || type === "sticker") return "sticker";
  if (msg.image || type === "image") return "image";
  if (msg.video || type === "video") return "video";
  if (msg.audio || type === "audio") return "audio";
  if (msg.document || type === "document") return "document";
  return null;
}

function getMediaDescriptor(msg: Message, kind: MediaKind): MessageMedia | undefined {
  if (kind === "image") return msg.image;
  if (kind === "video") return msg.video;
  if (kind === "audio") return msg.audio;
  if (kind === "document") return msg.document;
  return msg.sticker;
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MediaPreview({ msg }: { msg: Message }) {
  const kind = getMediaKind(msg);
  const media = kind ? getMediaDescriptor(msg, kind) : undefined;
  const mediaId = media?.id || msg.cloudId;
  const cloudUrl = media?.cloudUrl || msg.cloudUrl || "";
  const directUrl = media?.url || cloudUrl;
  const caption = media?.caption || "";
  const filename = media?.filename || "Document";
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!("IntersectionObserver" in window)) {
      setIsNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport || !mediaId) return;
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setLoadError(false);
    setMediaUrl(null);
    const cloudUrlQuery = cloudUrl ? `?cloudUrl=${encodeURIComponent(cloudUrl)}` : "";
    apiBlobFetch(`/api/live-chat/media/${encodeURIComponent(mediaId)}${cloudUrlQuery}`)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setMediaUrl(objectUrl);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isNearViewport, mediaId, cloudUrl]);

  if (!kind) return null;
  const isImage = kind === "image" || kind === "sticker";
  const displayedUrl = mediaUrl || (loadError ? directUrl : (!mediaId ? directUrl : ""));
  const label = kind === "image" ? "Image" : kind === "video" ? "Video" : kind === "audio" ? "Audio" : kind === "sticker" ? "Sticker" : filename;
  const Icon = kind === "image" || kind === "sticker" ? Image
    : kind === "video" ? Video
      : kind === "audio" ? Music2
        : FileText;

  return (
    <div ref={containerRef} className="max-w-[260px]">
      {displayedUrl && isImage && (
        <img
          src={displayedUrl}
          alt={kind === "sticker" ? "WhatsApp sticker" : "Image"}
          loading="lazy"
          className={kind === "sticker" ? "max-w-[180px] max-h-[180px] object-contain" : "max-w-[240px] max-h-[320px] rounded-lg object-contain"}
        />
      )}
      {displayedUrl && kind === "video" && (
        <video src={displayedUrl} controls preload="metadata" className="max-w-[240px] max-h-[320px] rounded-lg" />
      )}
      {displayedUrl && kind === "audio" && (
        <audio src={displayedUrl} controls preload="none" className="max-w-[240px]" />
      )}
      {displayedUrl && kind === "document" && (
        <a href={displayedUrl} download={filename} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2">
          <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-[12px] text-blue-700 underline break-all">{filename}</span>
        </a>
      )}
      {!displayedUrl && (
        <div className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2">
          <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-[12px] text-gray-700">
            {loading ? `Loading ${label.toLowerCase()}…` : loadError ? `${label} unavailable` : label}
          </span>
        </div>
      )}
      {caption && <p className="text-[12px] text-gray-700 mt-1 break-words">{caption}</p>}
    </div>
  );
}

function MessageBubble({ msg, contactName, templateMap = {} }: { msg: Message; contactName: string; templateMap?: Record<string, string> }) {
  const isInbound = !!msg.from || !!msg.from_user_id;
  const isTemplate = !!msg.template && !msg.from;
  const hasMedia = !!getMediaKind(msg);
  const time = formatFullTime(msg.timestamp);
  const isReaction = (msg.type || "").toLowerCase() === "reaction" || !!msg.reaction;
  const reactionEmoji = getReactionEmoji(msg.reaction, msg.emoji);

  if (isReaction) {
    return (
      <div className={isInbound ? "flex items-end gap-2 mb-2" : "flex justify-end mb-2"}>
        {isInbound && (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 ${avatarColor(contactName)}`}>
            {getInitials(contactName)}
          </div>
        )}
        <div className="max-w-[72%]">
          <div className={`${isInbound ? "bg-white rounded-tl-sm border border-black/5" : "bg-[#DCF8C6] rounded-tr-sm"} rounded-2xl px-3.5 py-2 shadow-sm`}>
            <span data-testid={`live-chat-reaction-${msg.id}`} className="text-[28px] leading-none" aria-label={reactionEmoji ? `Reaction ${reactionEmoji}` : "Reaction"}>
              {reactionEmoji || "Reaction"}
            </span>
            <div className={`flex items-center gap-1 mt-1 ${isInbound ? "justify-start" : "justify-end"}`}>
              <span className="text-[10px] text-gray-500">{time}</span>
              {!isInbound && <Ticks status={msg.status} />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isTemplate) {
    const bodyText = renderTemplateBody(
      msg.text?.body || (msg.template ? templateMap[msg.template] : undefined),
      msg.variables,
    );
    return (
      <div className="flex justify-end mb-2">
        <div className="max-w-[72%]">
          <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-3.5 py-2 shadow-sm">
            {bodyText ? (
              <p data-testid={`live-chat-message-body-${msg.id}`} className="text-[13px] text-gray-800 break-words whitespace-pre-wrap">{bodyText}</p>
            ) : (
              <>
                <span className="text-[9px] font-bold text-green-700 uppercase tracking-wide block mb-0.5">Template</span>
                <p className="text-[13px] text-gray-800 font-medium break-words">{msg.template}</p>
              </>
            )}
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-gray-500">{time}</span>
              <Ticks status={msg.status} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isInbound) {
    return (
      <div className="flex items-end gap-2 mb-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 ${avatarColor(contactName)}`}>
          {getInitials(contactName)}
        </div>
        <div className="max-w-[72%]">
          <div className="bg-white rounded-2xl rounded-tl-sm px-3.5 py-2 shadow-sm border border-black/5">
            {hasMedia && <MediaPreview msg={msg} />}
            {msg.text?.body && <p className="text-[13px] text-gray-800 break-words">{msg.text.body}</p>}
            <span className="text-[10px] text-gray-400 mt-1 block">{time}</span>
          </div>
        </div>
      </div>
    );
  }

  // Outbound text or media
  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-[72%]">
        <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-3.5 py-2 shadow-sm">
          {hasMedia && <MediaPreview msg={msg} />}
          {msg.text?.body && <p className="text-[13px] text-gray-800 break-words">{msg.text.body}</p>}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-gray-500">{time}</span>
            <Ticks status={msg.status} />
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollNumberRef = useRef<string | null>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const videoInputRef  = useRef<HTMLInputElement>(null);
  const docInputRef    = useRef<HTMLInputElement>(null);
  const attachRef      = useRef<HTMLDivElement>(null);

  // Close attach menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Templates (fetch once for body text lookup) ───────────────────────────
  const { data: templatesList = [] } = useQuery<{ name: string; body: string | null; footer: string | null }[]>({
    queryKey: ["live-chat-templates"],
    queryFn: () => apiFetch("/api/live-chat/templates"),
    staleTime: 10 * 60 * 1000,
  });
  const templateMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of templatesList) { if (t.body) m[t.name] = t.body; }
    return m;
  }, [templatesList]);

  // ── Contacts ──────────────────────────────────────────────────────────────
  const { data: contactsRaw = [], isLoading: loadingContacts, refetch: refetchContacts, isFetching: fetchingContacts } =
    useQuery<Contact[]>({
      queryKey: ["live-chat-contacts"],
      queryFn: () => apiFetch("/api/live-chat/contacts"),
      refetchInterval: 30_000,
    });

  const contactsSorted = useMemo(
    () => [...contactsRaw].sort((a, b) => (b.lastmessage?.timestamp ?? "").localeCompare(a.lastmessage?.timestamp ?? "")),
    [contactsRaw],
  );

  const tabContacts = useMemo(() => {
    const q = search.toLowerCase();
    return contactsSorted.filter((c) => {
      const matchTab =
        tab === "ACTIVE" ? c.chatstate === "ACTIVE" :
        tab === "REQ"    ? c.chatstate === "REQ" :
        c.chatstate === "CLOSED" || c.chatstate === "DOR";
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

  const messages: Message[] = useMemo(() => messagesData?.messages ?? [], [messagesData]);

  useEffect(() => {
    initialScrollNumberRef.current = null;
  }, [selectedNumber]);

  // Match WhatsApp: jump to the latest message once when a chat opens.
  // Do not smooth-scroll on every message refresh, otherwise opening a long
  // chat visibly animates from the top to the bottom and can interrupt
  // someone who is reading older messages.
  useEffect(() => {
    if (!selectedNumber) {
      initialScrollNumberRef.current = null;
      return;
    }
    if (loadingMessages || initialScrollNumberRef.current === selectedNumber) return;

    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      initialScrollNumberRef.current = selectedNumber;
    }
  }, [selectedNumber, loadingMessages]);

  // ── Send text ─────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (body: { number: string; message: string }) =>
      apiFetch("/api/live-chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setMessage("");
      setTimeout(() => refetchMessages(), 1000);
      queryClient.invalidateQueries({ queryKey: ["live-chat-contacts"] });
    },
    onError: (e: any) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    if (!selectedNumber || !message.trim()) return;
    sendMutation.mutate({ number: selectedNumber, message: message.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Send media ────────────────────────────────────────────────────────────
  const handleFileSelected = useCallback(async (file: File) => {
    if (!selectedNumber) return;
    setAttachMenuOpen(false);
    setUploading(true);
    try {
      // 1. Upload to Admark via our proxy
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await apiFetch("/api/live-chat/upload-media", {
        method: "POST",
        body: fd,
      });
      if (!uploadRes.success && !uploadRes.url && !uploadRes.cloudUrl) throw new Error("Upload failed");

      // 2. Send media message
      const media = uploadRes.file || {
        url: uploadRes.url || uploadRes.cloudUrl,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
      };
      await apiFetch("/api/live-chat/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: selectedNumber, media, caption: "" }),
      });
      setTimeout(() => refetchMessages(), 1200);
      queryClient.invalidateQueries({ queryKey: ["live-chat-contacts"] });
      toast({ title: "Media sent" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [selectedNumber, refetchMessages, queryClient, toast]);

  // ── Render ────────────────────────────────────────────────────────────────

  const isClosedChat = selectedContact?.chatstate === "CLOSED" || selectedContact?.chatstate === "DOR";

  return (
    // h-full fills the flex-1 content area provided by layout (header already excluded)
    <div className="flex h-full overflow-hidden bg-[#F0F2F5]" style={{ fontFamily: "Poppins, sans-serif" }}>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ""; }} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ""; }} />
      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ""; }} />

      {/* ── LEFT: Contact list ──────────────────────────────────────────── */}
      <div className={`flex flex-col w-full md:w-[320px] flex-shrink-0 bg-white border-r border-gray-200 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center">
                <MessageSquare className="w-[16px] h-[16px] text-white" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-gray-900 leading-tight">Live Chat</h2>
                <p className="text-[10px] text-gray-400 font-medium">WhatsApp Business</p>
              </div>
            </div>
            <button onClick={() => refetchContacts()} disabled={fetchingContacts}
              className="p-1.5 rounded-full hover:bg-gray-100" title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${fetchingContacts ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full h-8 pl-8 pr-7 text-[12px] bg-[#F0F2F5] rounded-xl border-none outline-none text-gray-800 placeholder:text-gray-400 font-medium" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-gray-400" /></button>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {(["ACTIVE", "REQ", "CLOSED"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors relative ${tab === t ? "text-[#25D366]" : "text-gray-400 hover:text-gray-600"}`}>
              {t === "ACTIVE" ? "Active" : t === "REQ" ? "Requests" : "Closed"}
              {tabCounts[t] > 0 && (
                <span className={`ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold ${tab === t ? "bg-[#25D366] text-white" : "bg-gray-200 text-gray-600"}`}>
                  {tabCounts[t]}
                </span>
              )}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />}
            </button>
          ))}
        </div>

        {/* Contact list — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {loadingContacts ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">Loading…</p>
            </div>
          ) : tabContacts.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-medium">No conversations</p>
            </div>
          ) : tabContacts.map((c) => {
            const isSelected = c.number === selectedNumber;
            const meta = sm(c.chatstate);
            return (
              <button key={c.number} onClick={() => { setSelectedNumber(c.number); setMobileView("chat"); }}
                className={`w-full flex items-start gap-2.5 px-3.5 py-3 text-left transition-colors border-b border-gray-50 ${isSelected ? "bg-[#F0FFF4]" : "hover:bg-gray-50"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 ${avatarColor(c.name || c.number)}`}>
                  {getInitials(c.name || c.number)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[13px] font-semibold text-gray-900 truncate">{c.name || c.number}</span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 font-medium">
                      {c.lastmessage?.timestamp ? formatTime(c.lastmessage.timestamp) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-[11px] text-gray-500 truncate flex-1">{lastMessagePreview(c, templateMap)}</span>
                    {(c.lastmessage as any)?.from && <span className="w-2 h-2 rounded-full bg-[#25D366] flex-shrink-0" />}
                  </div>
                  <span className={`inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Chat window ──────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 h-full ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
        {!selectedContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-[#25D366] opacity-70" />
            </div>
            <h3 className="text-[16px] font-bold text-gray-700 mb-1">WhatsApp Business</h3>
            <p className="text-xs text-gray-400 max-w-xs">Select a conversation to view messages and reply.</p>
          </div>
        ) : (
          <>
            {/* Chat header — fixed */}
            <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-2.5 flex-shrink-0">
              <button onClick={() => setMobileView("list")} className="md:hidden p-1 -ml-1 rounded-full hover:bg-gray-100">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0 ${avatarColor(selectedContact.name || selectedContact.number)}`}>
                {getInitials(selectedContact.name || selectedContact.number)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate leading-tight">{selectedContact.name || selectedContact.number}</p>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-2.5 h-2.5 text-gray-400" />
                  <span className="text-[11px] text-gray-500 font-medium">{selectedContact.number}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sm(selectedContact.chatstate).bg} ${sm(selectedContact.chatstate).color}`}>
                    {sm(selectedContact.chatstate).label}
                  </span>
                </div>
              </div>
              <button onClick={() => refetchMessages()} className="p-1.5 rounded-full hover:bg-gray-100" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>

            {/* Messages — scrollable fill */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ backgroundColor: "#E5DDD5" }}>
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No messages yet</p>
                </div>
              ) : messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} contactName={selectedContact.name || selectedContact.number} templateMap={templateMap} />
              ))}
            </div>

            {/* Input bar — fixed at bottom */}
            {isClosedChat ? (
              <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
                <div className="text-center text-[12px] text-gray-400 font-medium py-1">This chat is closed</div>
              </div>
            ) : (
              <div className="bg-white border-t border-gray-200 px-3 py-2.5 flex items-end gap-2 flex-shrink-0">
                {/* Attachment button */}
                <div className="relative flex-shrink-0" ref={attachRef}>
                  <button
                    onClick={() => setAttachMenuOpen((o) => !o)}
                    disabled={uploading}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${attachMenuOpen ? "bg-[#25D366] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    title="Attach media"
                  >
                    {uploading
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Paperclip className="w-4 h-4" />}
                  </button>

                  {/* Dropdown */}
                  {attachMenuOpen && (
                    <div className="absolute bottom-11 left-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 w-36">
                      <button onClick={() => imageInputRef.current?.click()}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-[13px] font-medium text-gray-700">
                        <Image className="w-4 h-4 text-teal-500" /> Image
                      </button>
                      <button onClick={() => videoInputRef.current?.click()}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-[13px] font-medium text-gray-700 border-t border-gray-50">
                        <Video className="w-4 h-4 text-purple-500" /> Video
                      </button>
                      <button onClick={() => docInputRef.current?.click()}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-[13px] font-medium text-gray-700 border-t border-gray-50">
                        <FileText className="w-4 h-4 text-blue-500" /> Document
                      </button>
                    </div>
                  )}
                </div>

                {/* Text input */}
                <div className="flex-1 bg-[#F0F2F5] rounded-2xl px-3.5 py-2 flex items-end min-h-[36px]">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message… (Shift+Enter for new line)"
                    rows={1}
                    className="flex-1 w-full bg-transparent border-none outline-none text-[13px] text-gray-800 placeholder:text-gray-400 resize-none max-h-28 leading-5"
                    style={{ fontFamily: "Poppins, sans-serif" }}
                  />
                </div>

                {/* Send */}
                <button onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-[#20BA5A] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0">
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
