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
  Settings2,
  Star,
  Folder,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  CheckSquare,
  Bell,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { useNdyspaceOverview, getGreeting } from "@/lib/ndyspace-hooks";
import type { NdyspaceNotificationType } from "@/lib/ndyspace-api";
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

// Colors sampled directly from the reference mockup's icon badges (§ visual
// pass — quick-action tiles). Note/Contact/Task tiles aren't colored in the
// mockup, so they fall back to the shared accent rather than inventing new
// hues not present in the source.
const QUICK_ACTIONS: {
  key: Exclude<QuickAction, null>;
  label: string;
  icon: LucideIcon;
  color?: string;
}[] = [
  { key: "email", label: "New Email", icon: Mail, color: "#31147e" },
  { key: "event", label: "New Event", icon: CalendarPlus, color: "#1a598c" },
  { key: "upload", label: "Upload File", icon: Upload, color: "#29cb8f" },
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

// Mockup color-codes the Recent Files icons by type (red/pdf, green/xlsx,
// blue/docx, purple/design files) rather than a single muted tone —
// approximated here from MIME type since that's the only type signal the
// overview payload carries.
function fileIconColorFor(mimeType: string): string {
  if (mimeType.includes("pdf")) return "text-critical";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "text-good";
  if (mimeType.includes("word") || mimeType.includes("document")) return "text-accent";
  if (mimeType.startsWith("image/") || mimeType.includes("figma")) return "text-accent-2";
  return "text-foreground-muted";
}

// Notifications panel color-codes its icon by notification type in the
// mockup (bell/lock/coin examples shown there map onto this app's real
// MAIL/CALENDAR/TASK/SYSTEM notification types).
function notificationIconFor(type: NdyspaceNotificationType): LucideIcon {
  switch (type) {
    case "MAIL":
      return Mail;
    case "CALENDAR":
      return CalendarIcon;
    case "TASK":
      return CheckSquare;
    default:
      return Bell;
  }
}

function notificationColorFor(type: NdyspaceNotificationType): string {
  switch (type) {
    case "MAIL":
      return "bg-accent/15 text-accent";
    case "CALENDAR":
      return "bg-accent-2/15 text-accent-2";
    case "TASK":
      return "bg-good/15 text-good";
    default:
      return "bg-warn/15 text-warn";
  }
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
  titleCount,
  viewAllHref,
  children,
  footerHref,
  footerLabel,
}: {
  title: string;
  titleCount?: number;
  viewAllHref: string;
  children: React.ReactNode;
  footerHref: string;
  footerLabel: string;
}) {
  return (
    <div className="ndyspace-card flex flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="ndyspace-panel-title text-sm font-medium">{title}</h2>
          {typeof titleCount === "number" && titleCount > 0 && (
            <span className="ndyspace-count-pill">{titleCount}</span>
          )}
        </div>
        <Link href={viewAllHref} className="ndyspace-panel-link text-xs">
          View all →
        </Link>
      </div>
      <div className="mt-3 flex-1">{children}</div>
      <Link
        href={footerHref}
        className="ndyspace-footer-link mt-3 block pt-3 text-center text-xs font-medium"
      >
        {footerLabel} →
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
  const [mailTab, setMailTab] = useState<"primary" | "social" | "updates" | "promotions">(
    "primary",
  );

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
          className="ndyspace-customize-btn flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:cursor-not-allowed"
        >
          <Settings2 size={14} strokeWidth={2} />
          Customize
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
            style={{ "--qt-c": action.color ?? "var(--ns-accent)" } as React.CSSProperties}
            className="ndyspace-quick-tile flex flex-col items-center gap-2 p-4 text-center"
          >
            <span className="ndyspace-quick-tile-icon flex h-9 w-9 items-center justify-center">
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
            titleCount={overview?.unreadMailCount}
            viewAllHref="/ndyspace/mail"
            footerHref="/ndyspace/mail"
            footerLabel="Go to NDYMAIL"
          >
            {/* Tab row matches the mockup's Primary/Social/Updates/Promotions
                inbox categories. The overview endpoint only returns one
                unsegmented mail list (categorization is a NDYMAIL-module
                feature, out of scope for this styling pass), so Social/
                Updates/Promotions render their empty state rather than
                silently showing Primary's data under the wrong label —
                same "visually present, honestly inert" treatment as the
                search box and theme toggle. */}
            <div className="ndyspace-tabs mb-3 flex gap-4 text-xs">
              {(
                [
                  ["primary", "Primary"],
                  ["social", "Social"],
                  ["updates", "Updates"],
                  ["promotions", "Promotions"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMailTab(key)}
                  className={`ndyspace-tab pb-2 ${mailTab === key ? "is-active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mailTab !== "primary" ? (
              <EmptyState text={`No ${mailTab} mail yet.`} />
            ) : !overview || overview.mail.length === 0 ? (
              <EmptyState text="No mail yet — messages sent to you will show up here." />
            ) : (
              <ul>
                {overview.mail.map((m) => (
                  <li key={m.id} className="ndyspace-row-divider flex items-start gap-3 py-2.5">
                    <Avatar
                      photoUrl={m.sender.profilePhotoUrl}
                      name={m.sender.fullName ?? m.sender.ndyId}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-foreground-muted">
                          {m.sender.fullName ?? m.sender.ndyId}
                        </p>
                        <span className="shrink-0 text-[11px] text-foreground-muted">
                          {relativeTime(m.createdAt)}
                        </span>
                      </div>
                      <p className={`truncate text-sm ${!m.isRead ? "font-semibold" : ""}`}>
                        {m.subject}
                      </p>
                      <p className="truncate text-xs text-foreground-muted">{m.body}</p>
                    </div>
                    <Star
                      size={14}
                      strokeWidth={2}
                      className={`mt-0.5 shrink-0 ${m.isStarred ? "fill-warn text-warn" : "text-foreground-muted"}`}
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
              <ul className="space-y-1">
                {overview.calendar.map((ev) => (
                  <li key={ev.id} className="flex gap-3 rounded-md p-2 hover:bg-surface-2">
                    <div className="w-12 shrink-0 text-right text-xs text-foreground-muted">
                      <p>
                        {new Date(ev.startAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </p>
                      <p>
                        {new Date(ev.endAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </p>
                    </div>
                    <span
                      className="mt-0.5 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{ev.title}</p>
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
                <ul>
                  {overview.drive.folders.map((f) => (
                    <li
                      key={f.id}
                      className="ndyspace-row-divider flex items-center gap-2 py-2 text-sm"
                    >
                      <Folder size={16} strokeWidth={2} className="text-accent" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-foreground-muted">{f.fileCount} files</span>
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
                <ul>
                  {overview.drive.recentFiles.map((f) => {
                    const Icon = fileIconFor(f.mimeType);
                    return (
                      <li
                        key={f.id}
                        className="ndyspace-row-divider flex items-center gap-2 py-2 text-sm"
                      >
                        <Icon
                          size={16}
                          strokeWidth={2}
                          className={fileIconColorFor(f.mimeType)}
                        />
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="shrink-0 text-xs text-foreground-muted">
                          {formatBytes(f.sizeBytes)} · {relativeTime(f.createdAt)}
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
              <ul>
                {overview.contacts.map((c) => (
                  <li key={c.id} className="ndyspace-row-divider flex items-center gap-2 py-2">
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

          <div className="ndyspace-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="ndyspace-panel-title text-sm font-medium">Tasks</h2>
              <Link href="/ndyspace/tasks" className="ndyspace-panel-link text-xs">
                View all →
              </Link>
            </div>
            <div className="ndyspace-tabs mt-3 flex gap-4 text-xs">
              <button
                onClick={() => setTasksTab("open")}
                className={`ndyspace-tab pb-2 ${tasksTab === "open" ? "is-active" : ""}`}
              >
                My Tasks
              </button>
              <button
                onClick={() => setTasksTab("completed")}
                className={`ndyspace-tab pb-2 ${tasksTab === "completed" ? "is-active" : ""}`}
              >
                Completed
              </button>
            </div>
            <div className="mt-2">
              {(() => {
                const list = tasksTab === "open" ? overview?.tasks.open : overview?.tasks.completed;
                if (!overview) return null;
                if (list && list.length === 0) {
                  return (
                    <EmptyState
                      text={tasksTab === "open" ? "No open tasks." : "Nothing completed yet."}
                    />
                  );
                }
                return (
                  <ul>
                    {list?.map((t) => (
                      <li
                        key={t.id}
                        className="ndyspace-row-divider flex items-center gap-2 py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={t.status === "COMPLETED"}
                          readOnly
                          className="h-3.5 w-3.5 shrink-0 rounded-full"
                        />
                        <span
                          className={`flex-1 truncate text-sm ${t.status === "COMPLETED" ? "text-foreground-muted line-through" : ""}`}
                        >
                          {t.title}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            t.priority === "HIGH"
                              ? "ndyspace-priority-high"
                              : t.priority === "MEDIUM"
                                ? "ndyspace-priority-medium"
                                : "ndyspace-priority-low"
                          }`}
                        >
                          {t.priority.charAt(0) + t.priority.slice(1).toLowerCase()}
                        </span>
                        <ChevronDown size={14} strokeWidth={2} className="shrink-0 text-foreground-muted" />
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
            <Link
              href="/ndyspace/tasks"
              className="ndyspace-footer-link mt-1 block pt-3 text-center text-xs font-medium"
            >
              Go to Tasks →
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
              <ul>
                {overview.notifications.recent.map((n) => {
                  const Icon = notificationIconFor(n.type);
                  return (
                    <li
                      key={n.id}
                      className="ndyspace-row-divider flex items-start gap-2.5 py-2.5"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${notificationColorFor(n.type)}`}
                      >
                        <Icon size={14} strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${!n.isRead ? "font-medium" : ""}`}>
                          {n.message}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-foreground-muted">
                        {relativeTime(n.createdAt)}
                      </span>
                    </li>
                  );
                })}
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
