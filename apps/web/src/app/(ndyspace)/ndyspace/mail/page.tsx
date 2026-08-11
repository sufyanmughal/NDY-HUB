"use client";

import { useEffect, useState } from "react";
import { Star, Inbox, Send, FileEdit, Trash2, Reply, ReplyAll, Forward, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import {
  NewEmailModal,
  buildReplyPrefill,
  type ComposePrefill,
} from "@/components/ndyspace/quick-action-modals";
import {
  listMail,
  getMailItem,
  updateMailItem,
  deleteMailItem,
  emptyMailTrash,
  type OverviewMailItem,
  type MailDetail,
  type EmailFolder,
} from "@/lib/ndyspace-api";

// §2.4's Primary/Social/Updates/Promotions tabs are a `category` field on
// Email that defaults to PRIMARY for every message (no real classification
// logic in this pass — see the schema comment on EmailCategory). Filtering
// client-side against the fetched folder rather than a separate endpoint
// per category, since there's no meaningful volume yet to paginate.
const CATEGORY_TABS: { key: OverviewMailItem["category"] | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PRIMARY", label: "Primary" },
  { key: "SOCIAL", label: "Social" },
  { key: "UPDATES", label: "Updates" },
  { key: "PROMOTIONS", label: "Promotions" },
];

const FOLDER_TABS: { key: EmailFolder; label: string; icon: typeof Inbox }[] = [
  { key: "INBOX", label: "Inbox", icon: Inbox },
  { key: "SENT", label: "Sent", icon: Send },
  { key: "DRAFTS", label: "Drafts", icon: FileEdit },
  { key: "TRASH", label: "Trash", icon: Trash2 },
];

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NdyspaceMailPage() {
  const { auth } = useAuth();
  const [folder, setFolder] = useState<EmailFolder>("INBOX");
  const [category, setCategory] = useState<OverviewMailItem["category"] | "ALL">("ALL");
  const [messages, setMessages] = useState<OverviewMailItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePrefill, setComposePrefill] = useState<ComposePrefill | undefined>(undefined);
  const [selected, setSelected] = useState<MailDetail | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function load() {
    if (auth.status !== "authenticated") return;
    listMail(folder)
      .then(setMessages)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — see
    // ndyspace-hooks.ts's useAuthedPoll for the same microtask-hop pattern
    // and why (react-hooks/set-state-in-effect).
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setMessages(null);
        setSelectedIds(new Set());
      }
    });
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, folder]);

  if (auth.status !== "authenticated") return null;
  const myNdyId = auth.ndyId;

  const categoryFiltered =
    messages === null
      ? undefined
      : category === "ALL"
        ? messages
        : messages.filter((m) => m.category === category);

  const searchLower = search.trim().toLowerCase();
  const filtered =
    categoryFiltered === undefined
      ? undefined
      : searchLower.length === 0
        ? categoryFiltered
        : categoryFiltered.filter(
            (m) =>
              m.subject.toLowerCase().includes(searchLower) ||
              m.body.toLowerCase().includes(searchLower) ||
              (m.sender.fullName ?? "").toLowerCase().includes(searchLower) ||
              m.sender.ndyId.toLowerCase().includes(searchLower),
          );

  async function toggleStar(m: OverviewMailItem, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = await updateMailItem(m.id, { isStarred: !m.isStarred });
    setMessages((prev) => prev?.map((x) => (x.id === m.id ? updated : x)) ?? null);
  }

  async function openMessage(m: OverviewMailItem) {
    if (m.folder === "DRAFTS") {
      setComposePrefill({
        mode: "editDraft",
        draftId: m.id,
        to: m.draftTo.join(", "),
        cc: m.draftCc.join(", "),
        subject: m.subject,
        body: m.body,
      });
      setComposeOpen(true);
      return;
    }
    const detail = await getMailItem(m.id);
    setSelected(detail);
    if (!m.isRead && folder === "INBOX") {
      const updated = await updateMailItem(m.id, { isRead: true });
      setMessages((prev) => prev?.map((x) => (x.id === m.id ? updated : x)) ?? null);
    }
  }

  async function moveToFolder(id: string, target: EmailFolder) {
    const updated = await updateMailItem(id, { folder: target });
    setMessages((prev) => prev?.map((x) => (x.id === id ? updated : x)) ?? null);
    setSelected((prev) => (prev && prev.id === id ? { ...prev, folder: target } : prev));
  }

  async function permanentlyDelete(id: string) {
    await deleteMailItem(id);
    setMessages((prev) => prev?.filter((x) => x.id !== id) ?? null);
    setSelected((prev) => (prev && prev.id === id ? null : prev));
  }

  async function handleEmptyTrash() {
    setBulkBusy(true);
    try {
      await emptyMailTrash();
      load();
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!filtered) return;
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((m) => m.id)),
    );
  }

  async function bulkMarkRead(read: boolean) {
    setBulkBusy(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => updateMailItem(id, { isRead: read })),
      );
      load();
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkTrash() {
    setBulkBusy(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => updateMailItem(id, { folder: "TRASH" })),
      );
      load();
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  function openCompose(prefill?: ComposePrefill) {
    setComposePrefill(prefill);
    setComposeOpen(true);
  }

  function openReply(mode: "reply" | "replyAll" | "forward") {
    if (!selected) return;
    setComposePrefill(buildReplyPrefill(selected, mode, myNdyId));
    setComposeOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">NDYMAIL</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Internal messaging between NDYSPACE users — no external email federation in this pass.
          </p>
        </div>
        <button
          onClick={() => openCompose(undefined)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Compose
        </button>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FOLDER_TABS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFolder(f.key)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
                folder === f.key
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-foreground-muted hover:bg-surface-2"
              }`}
            >
              <f.icon size={13} strokeWidth={2} />
              {f.label}
            </button>
          ))}
        </div>
        {folder === "TRASH" && (
          <button
            onClick={handleEmptyTrash}
            disabled={bulkBusy}
            className="rounded-md border border-critical/40 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10 disabled:opacity-50"
          >
            Empty Trash
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search subject, body, or sender…"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      <div className="flex gap-1 border-b border-border text-sm">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setCategory(t.key)}
            className={`px-3 py-2 ${
              category === t.key
                ? "border-b-2 border-accent font-medium text-foreground"
                : "text-foreground-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered !== undefined && filtered.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
            />
            Select all
          </label>
          {selectedIds.size > 0 && (
            <>
              <span>{selectedIds.size} selected</span>
              <button
                onClick={() => bulkMarkRead(true)}
                disabled={bulkBusy}
                className="rounded-md border border-border px-2 py-1 hover:bg-surface-2 disabled:opacity-50"
              >
                Mark Read
              </button>
              <button
                onClick={() => bulkMarkRead(false)}
                disabled={bulkBusy}
                className="rounded-md border border-border px-2 py-1 hover:bg-surface-2 disabled:opacity-50"
              >
                Mark Unread
              </button>
              <button
                onClick={bulkTrash}
                disabled={bulkBusy}
                className="rounded-md border border-critical/40 px-2 py-1 text-critical hover:bg-critical/10 disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface">
        {messages === null || filtered === undefined ? (
          <p className="p-5 text-sm text-foreground-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm text-foreground-muted">
            {folder === "INBOX"
              ? "No mail yet — messages sent to you will show up here."
              : `Nothing in ${folder.toLowerCase()}.`}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((m) => (
              <li
                key={m.id}
                onClick={() => openMessage(m)}
                className="flex cursor-pointer items-start gap-3 p-4 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onClick={(e) => toggleSelect(m.id, e)}
                  onChange={() => {}}
                  className="mt-1.5"
                />
                <Avatar
                  photoUrl={m.sender.profilePhotoUrl}
                  name={m.sender.fullName ?? m.sender.ndyId}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${!m.isRead ? "font-semibold" : ""}`}>
                      {folder === "DRAFTS"
                        ? `Draft — ${m.subject || "(no subject)"}`
                        : `${m.sender.fullName ?? m.sender.ndyId} — ${m.subject}`}
                      {m.isCc && (
                        <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-foreground-muted">
                          Cc
                        </span>
                      )}
                    </p>
                    <span className="shrink-0 text-xs text-foreground-muted">
                      {relativeTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-foreground-muted">{m.body}</p>
                </div>
                {folder === "TRASH" ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToFolder(m.id, "INBOX");
                      }}
                      aria-label="Restore"
                      className="text-foreground-muted hover:text-accent"
                    >
                      <RotateCcw size={16} strokeWidth={2} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        permanentlyDelete(m.id);
                      }}
                      aria-label="Delete permanently"
                      className="text-foreground-muted hover:text-critical"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={(e) => toggleStar(m, e)} aria-label="Toggle star">
                      <Star
                        size={16}
                        strokeWidth={2}
                        className={m.isStarred ? "fill-warn text-warn" : "text-foreground-muted"}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveToFolder(m.id, "TRASH");
                      }}
                      aria-label="Delete"
                      className="text-foreground-muted hover:text-critical"
                    >
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full max-w-2xl rounded-lg border border-border bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selected.subject}</h2>
                <p className="mt-1 text-xs text-foreground-muted">
                  From {selected.sender.fullName ?? selected.sender.ndyId} ({selected.sender.ndyId})
                  {" · "}
                  {new Date(selected.createdAt).toLocaleString()}
                </p>
                {selected.recipients.length > 0 && (
                  <p className="mt-1 text-xs text-foreground-muted">
                    {selected.recipients.some((r) => !r.isCc) && (
                      <>
                        To:{" "}
                        {selected.recipients
                          .filter((r) => !r.isCc)
                          .map((r) => r.fullName ?? r.ndyId)
                          .join(", ")}
                      </>
                    )}
                    {selected.recipients.some((r) => r.isCc) && (
                      <>
                        {" · Cc: "}
                        {selected.recipients
                          .filter((r) => r.isCc)
                          .map((r) => r.fullName ?? r.ndyId)
                          .join(", ")}
                      </>
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface-2"
              >
                Close
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm">{selected.body}</p>

            {selected.attachments.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className={labelClassLocal}>Attachments</p>
                <ul className="space-y-1">
                  {selected.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-surface-2"
                      >
                        <span className="truncate">{a.name}</span>
                        <span className="shrink-0 text-xs text-foreground-muted">
                          {formatBytes(a.sizeBytes)}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {selected.folder === "TRASH" ? (
                <>
                  <button
                    onClick={() => moveToFolder(selected.id, "INBOX")}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                  >
                    <RotateCcw size={13} strokeWidth={2} /> Restore
                  </button>
                  <button
                    onClick={() => permanentlyDelete(selected.id)}
                    className="flex items-center gap-1.5 rounded-md border border-critical/40 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10"
                  >
                    <Trash2 size={13} strokeWidth={2} /> Delete permanently
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openReply("reply")}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                  >
                    <Reply size={13} strokeWidth={2} /> Reply
                  </button>
                  <button
                    onClick={() => openReply("replyAll")}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                  >
                    <ReplyAll size={13} strokeWidth={2} /> Reply All
                  </button>
                  <button
                    onClick={() => openReply("forward")}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                  >
                    <Forward size={13} strokeWidth={2} /> Forward
                  </button>
                  <button
                    onClick={() => moveToFolder(selected.id, "TRASH")}
                    className="flex items-center gap-1.5 rounded-md border border-critical/40 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10"
                  >
                    <Trash2 size={13} strokeWidth={2} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {composeOpen && (
        <NewEmailModal
          onClose={() => {
            setComposeOpen(false);
            setComposePrefill(undefined);
          }}
          onSent={load}
          prefill={composePrefill}
        />
      )}
    </div>
  );
}

const labelClassLocal = "text-xs uppercase tracking-wide text-foreground-muted";
