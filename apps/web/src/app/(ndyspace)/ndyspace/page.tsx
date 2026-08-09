"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  CalendarPlus,
  Upload,
  StickyNote,
  UserPlus,
  ListPlus,
  Star,
  Folder,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { useNdyspaceOverview, getGreeting } from "@/lib/ndyspace-hooks";
import { Avatar } from "@/components/avatar";
import { MiniCalendar } from "@/components/ndyspace/mini-calendar";
import {
  NewEmailModal,
  NewEventModal,
  UploadFileModal,
  NewNoteModal,
  NewContactModal,
  NewTaskModal,
} from "@/components/ndyspace/quick-action-modals";

type QuickAction = "email" | "event" | "upload" | "note" | "contact" | "task" | null;

const QUICK_ACTIONS: { key: Exclude<QuickAction, null>; label: string; icon: LucideIcon }[] = [
  { key: "email", label: "New Email", icon: Mail },
  { key: "event", label: "New Event", icon: CalendarPlus },
  { key: "upload", label: "Upload File", icon: Upload },
  { key: "note", label: "New Note", icon: StickyNote },
  { key: "contact", label: "Add Contact", icon: UserPlus },
  { key: "task", label: "Create Task", icon: ListPlus },
];

function fileIconFor(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document")) {
    return FileText;
  }
  return FileIcon;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

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

function PanelCard({
  title,
  viewAllHref,
  children,
  footerHref,
  footerLabel,
}: {
  title: string;
  viewAllHref: string;
  children: React.ReactNode;
  footerHref: string;
  footerLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Link href={viewAllHref} className="text-xs text-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-3 flex-1">{children}</div>
      <Link
        href={footerHref}
        className="mt-3 block border-t border-border pt-3 text-center text-xs font-medium text-accent hover:underline"
      >
        {footerLabel}
      </Link>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-foreground-muted">{text}</p>;
}

export default function NdyspaceOverviewPage() {
  const { auth } = useAuth();
  const passport = usePassport();
  const { data: overview, error, loading, refetch } = useNdyspaceOverview();
  const [activeModal, setActiveModal] = useState<QuickAction>(null);
  const [tasksTab, setTasksTab] = useState<"open" | "completed">("open");

  if (auth.status !== "authenticated") return null;

  const greeting = getGreeting(passport?.fullName ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {greeting.text} <span aria-hidden>{greeting.emoji}</span>
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {loading && !overview
              ? "Loading your day…"
              : `${overview?.unreadMailCount ?? 0} unread message${overview?.unreadMailCount === 1 ? "" : "s"} · ${overview?.upcomingEventCount ?? 0} upcoming event${overview?.upcomingEventCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Draggable widget layout — planned follow-up, not built in this pass"
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground-muted disabled:cursor-not-allowed"
        >
          Customize (coming soon)
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-critical/30 bg-critical/10 p-3 text-sm text-critical">
          Couldn&apos;t load your overview: {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.key}
            onClick={() => setActiveModal(action.key)}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4 text-center transition-colors hover:bg-surface-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
              <action.icon size={18} strokeWidth={2} />
            </span>
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PanelCard
            title="NDYMAIL"
            viewAllHref="/ndyspace/mail"
            footerHref="/ndyspace/mail"
            footerLabel="Go to NDYMAIL"
          >
            {!overview || overview.mail.length === 0 ? (
              <EmptyState text="No mail yet — messages sent to you will show up here." />
            ) : (
              <ul className="divide-y divide-border">
                {overview.mail.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 py-2.5">
                    <Avatar
                      photoUrl={m.sender.profilePhotoUrl}
                      name={m.sender.fullName ?? m.sender.ndyId}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${!m.isRead ? "font-semibold" : ""}`}>
                          {m.subject}
                        </p>
                        <span className="shrink-0 text-[11px] text-foreground-muted">
                          {relativeTime(m.createdAt)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-foreground-muted">{m.body}</p>
                    </div>
                    <Star
                      size={14}
                      strokeWidth={2}
                      className={m.isStarred ? "fill-warn text-warn" : "text-foreground-muted"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>

          <PanelCard
            title="Calendar"
            viewAllHref="/ndyspace/calendar"
            footerHref="/ndyspace/calendar"
            footerLabel="Go to Calendar"
          >
            {!overview || overview.calendar.length === 0 ? (
              <EmptyState text="No upcoming events — create one with the quick action above." />
            ) : (
              <ul className="space-y-2">
                {overview.calendar.map((ev) => (
                  <li key={ev.id} className="flex gap-3 rounded-md p-2 hover:bg-surface-2">
                    <span
                      className="mt-0.5 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ev.title}</p>
                      <p className="text-xs text-foreground-muted">
                        {new Date(ev.startAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {" – "}
                        {new Date(ev.endAt).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      {ev.description && (
                        <p className="mt-0.5 truncate text-xs text-foreground-muted">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PanelCard
              title="Drive"
              viewAllHref="/ndyspace/drive"
              footerHref="/ndyspace/drive"
              footerLabel="Go to Drive"
            >
              {!overview || overview.drive.folders.length === 0 ? (
                <EmptyState text="No folders yet." />
              ) : (
                <ul className="space-y-2">
                  {overview.drive.folders.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 text-sm">
                      <Folder size={16} strokeWidth={2} className="text-accent" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-foreground-muted">{f.fileCount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelCard>

            <PanelCard
              title="Recent Files"
              viewAllHref="/ndyspace/drive"
              footerHref="/ndyspace/drive"
              footerLabel="Go to Drive"
            >
              {!overview || overview.drive.recentFiles.length === 0 ? (
                <EmptyState text="No files yet." />
              ) : (
                <ul className="space-y-2">
                  {overview.drive.recentFiles.map((f) => {
                    const Icon = fileIconFor(f.mimeType);
                    return (
                      <li key={f.id} className="flex items-center gap-2 text-sm">
                        <Icon size={16} strokeWidth={2} className="text-foreground-muted" />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-foreground-muted">
                          {formatBytes(f.sizeBytes)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelCard>
          </div>
        </div>

        <div className="space-y-4">
          <MiniCalendar />

          <PanelCard
            title="Contacts"
            viewAllHref="/ndyspace/contacts"
            footerHref="/ndyspace/contacts"
            footerLabel="Go to Contacts"
          >
            {!overview || overview.contacts.length === 0 ? (
              <EmptyState text="No contacts yet." />
            ) : (
              <ul className="space-y-2">
                {overview.contacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <Avatar name={c.fullName} size={28} />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{c.fullName}</p>
                      {c.email && (
                        <p className="truncate text-xs text-foreground-muted">{c.email}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>

          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Tasks</h2>
              <Link href="/ndyspace/tasks" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
            <div className="mt-3 flex gap-1 rounded-md bg-background p-1 text-xs">
              <button
                onClick={() => setTasksTab("open")}
                className={`flex-1 rounded px-2 py-1 ${tasksTab === "open" ? "bg-surface-2 font-medium" : "text-foreground-muted"}`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setTasksTab("completed")}
                className={`flex-1 rounded px-2 py-1 ${tasksTab === "completed" ? "bg-surface-2 font-medium" : "text-foreground-muted"}`}
              >
                Completed
              </button>
            </div>
            <div className="mt-3">
              {(() => {
                const list = tasksTab === "open" ? overview?.tasks.open : overview?.tasks.completed;
                if (!overview) return null;
                if (list && list.length === 0) {
                  return <EmptyState text={tasksTab === "open" ? "No open tasks." : "Nothing completed yet."} />;
                }
                return (
                  <ul className="space-y-2">
                    {list?.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={t.status === "COMPLETED"}
                          readOnly
                          className="h-3.5 w-3.5"
                        />
                        <span
                          className={`flex-1 truncate text-sm ${t.status === "COMPLETED" ? "text-foreground-muted line-through" : ""}`}
                        >
                          {t.title}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            t.priority === "HIGH"
                              ? "bg-critical/15 text-critical"
                              : t.priority === "MEDIUM"
                                ? "bg-warn/15 text-warn"
                                : "bg-good/15 text-good"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <Link
              href="/ndyspace/tasks"
              className="mt-3 block border-t border-border pt-3 text-center text-xs font-medium text-accent hover:underline"
            >
              Go to Tasks
            </Link>
          </div>

          <PanelCard
            title="Notifications"
            viewAllHref="/ndyspace/notifications"
            footerHref="/ndyspace/notifications"
            footerLabel="View all notifications"
          >
            {!overview || overview.notifications.recent.length === 0 ? (
              <EmptyState text="No notifications yet." />
            ) : (
              <ul className="space-y-2">
                {overview.notifications.recent.map((n) => (
                  <li key={n.id} className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.isRead ? "bg-transparent" : "bg-accent"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{n.message}</p>
                      <p className="text-[11px] text-foreground-muted">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>
      </div>

      {activeModal === "email" && (
        <NewEmailModal onClose={() => setActiveModal(null)} onSent={refetch} />
      )}
      {activeModal === "event" && (
        <NewEventModal onClose={() => setActiveModal(null)} onCreated={refetch} />
      )}
      {activeModal === "upload" && (
        <UploadFileModal onClose={() => setActiveModal(null)} onUploaded={refetch} />
      )}
      {activeModal === "note" && (
        <NewNoteModal onClose={() => setActiveModal(null)} onCreated={refetch} />
      )}
      {activeModal === "contact" && (
        <NewContactModal onClose={() => setActiveModal(null)} onCreated={refetch} />
      )}
      {activeModal === "task" && (
        <NewTaskModal onClose={() => setActiveModal(null)} onCreated={refetch} />
      )}
    </div>
  );
}
