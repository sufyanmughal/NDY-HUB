"use client";

import { useEffect, useState } from "react";
import { Star, Inbox, Send, FileEdit, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import { NewEmailModal } from "@/components/ndyspace/quick-action-modals";
import {
  listMail,
  updateMailItem,
  type OverviewMailItem,
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

export default function NdyspaceMailPage() {
  const { auth } = useAuth();
  const [folder, setFolder] = useState<EmailFolder>("INBOX");
  const [category, setCategory] = useState<OverviewMailItem["category"] | "ALL">("ALL");
  const [messages, setMessages] = useState<OverviewMailItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [selected, setSelected] = useState<OverviewMailItem | null>(null);

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
      if (!cancelled) setMessages(null);
    });
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, folder]);

  if (auth.status !== "authenticated") return null;

  const filtered =
    messages === null
      ? undefined
      : category === "ALL"
        ? messages
        : messages.filter((m) => m.category === category);

  async function toggleStar(m: OverviewMailItem, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = await updateMailItem(m.id, { isStarred: !m.isStarred });
    setMessages((prev) => prev?.map((x) => (x.id === m.id ? updated : x)) ?? null);
  }

  async function openMessage(m: OverviewMailItem) {
    setSelected(m);
    if (!m.isRead && folder === "INBOX") {
      const updated = await updateMailItem(m.id, { isRead: true });
      setMessages((prev) => prev?.map((x) => (x.id === m.id ? updated : x)) ?? null);
    }
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
          onClick={() => setComposeOpen(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Compose
        </button>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

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
                <Avatar
                  photoUrl={m.sender.profilePhotoUrl}
                  name={m.sender.fullName ?? m.sender.ndyId}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${!m.isRead ? "font-semibold" : ""}`}>
                      {m.sender.fullName ?? m.sender.ndyId} — {m.subject}
                    </p>
                    <span className="shrink-0 text-xs text-foreground-muted">
                      {relativeTime(m.createdAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-foreground-muted">{m.body}</p>
                </div>
                <button onClick={(e) => toggleStar(m, e)} aria-label="Toggle star">
                  <Star
                    size={16}
                    strokeWidth={2}
                    className={m.isStarred ? "fill-warn text-warn" : "text-foreground-muted"}
                  />
                </button>
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
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface-2"
              >
                Close
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm">{selected.body}</p>
          </div>
        </div>
      )}

      {composeOpen && (
        <NewEmailModal onClose={() => setComposeOpen(false)} onSent={load} />
      )}
    </div>
  );
}
