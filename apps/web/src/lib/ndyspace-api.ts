// NDYSPACE API bindings — kept in their own file rather than appended to
// lib/api.ts to avoid colliding with concurrent edits to that file during
// this build. Same fetch conventions as lib/api.ts (proxied same-origin
// path, credentials: include, 401-triggers-refresh-then-retry) — duplicated
// narrowly here rather than importing the private helpers out of api.ts,
// since those aren't exported. If the two files are ever consolidated,
// this whole preamble collapses into api.ts's existing apiFetch/authedFetch.

const PROXIED_API_PATH = "/api";

class NdyspaceApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "NdyspaceApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PROXIED_API_PATH}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new NdyspaceApiError(
      body.message ?? `Request failed with status ${res.status}`,
      res.status,
    );
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

let refreshInFlight: Promise<void> | null = null;

function refreshOnce(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = apiFetch("/auth/refresh", { method: "POST" })
      .then(() => undefined)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    if (err instanceof NdyspaceApiError && err.status === 401) {
      await refreshOnce();
      return apiFetch<T>(path, init);
    }
    throw err;
  }
}

// --- Overview ---

export interface OverviewMailItem {
  id: string;
  emailId: string;
  subject: string;
  body: string;
  category: EmailCategory;
  folder: EmailFolder;
  isRead: boolean;
  isStarred: boolean;
  isCc: boolean;
  createdAt: string;
  sender: { ndyId: string; fullName: string | null; profilePhotoUrl: string | null };
  draftTo: string[];
  draftCc: string[];
}

export interface MailAttachment {
  id: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface MailDetail extends OverviewMailItem {
  recipients: { ndyId: string; fullName: string | null; isCc: boolean }[];
  attachments: MailAttachment[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  color: string;
  attendeeEmails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DriveFolderSummary {
  id: string;
  name: string;
  createdAt: string;
  fileCount: number;
}

export interface DriveFile {
  id: string;
  userId: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveStorageUsage {
  usedBytes: number;
  totalBytes: number;
  percentUsed: number;
  quotaNote: string;
}

export interface Contact {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  ndyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type TaskStatus = "OPEN" | "COMPLETED";

export interface NdyspaceTask {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NdyspaceNotificationType = "MAIL" | "CALENDAR" | "TASK" | "SYSTEM";

export interface NdyspaceNotification {
  id: string;
  type: NdyspaceNotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NdyspaceOverview {
  unreadMailCount: number;
  upcomingEventCount: number;
  mail: OverviewMailItem[];
  calendar: CalendarEvent[];
  drive: {
    folders: DriveFolderSummary[];
    recentFiles: DriveFile[];
    storage: DriveStorageUsage;
  };
  contacts: Contact[];
  tasks: { open: NdyspaceTask[]; completed: NdyspaceTask[] };
  notifications: { unreadCount: number; recent: NdyspaceNotification[] };
}

export function getNdyspaceOverview(): Promise<NdyspaceOverview> {
  return authedFetch("/ndyspace/overview");
}

export function getMiniCalendarDates(
  year: number,
  month: number,
): Promise<{ dates: string[] }> {
  return authedFetch(`/ndyspace/overview/mini-calendar?year=${year}&month=${month}`);
}

// --- NDYMAIL ---

export type EmailFolder = "INBOX" | "SENT" | "DRAFTS" | "TRASH";
export type EmailCategory = "PRIMARY" | "SOCIAL" | "UPDATES" | "PROMOTIONS";

export function listMail(folder: EmailFolder = "INBOX"): Promise<OverviewMailItem[]> {
  return authedFetch(`/ndyspace/mail?folder=${folder}`);
}

export function getMailUnreadCount(): Promise<{ count: number }> {
  return authedFetch("/ndyspace/mail/unread-count");
}

export function getMailItem(id: string): Promise<MailDetail> {
  return authedFetch(`/ndyspace/mail/${id}`);
}

export interface SendMailParams {
  recipientNdyIds: string[];
  ccNdyIds?: string[];
  subject: string;
  body: string;
  attachmentDriveFileIds?: string[];
}

export function sendMail(params: SendMailParams): Promise<{ id: string }> {
  return authedFetch("/ndyspace/mail", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface SaveDraftParams {
  draftId?: string;
  recipientNdyIds?: string[];
  ccNdyIds?: string[];
  subject?: string;
  body?: string;
  attachmentDriveFileIds?: string[];
}

export function saveMailDraft(params: SaveDraftParams): Promise<OverviewMailItem> {
  return authedFetch("/ndyspace/mail/drafts", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function sendMailDraft(
  draftId: string,
  params: Omit<SaveDraftParams, "draftId">,
): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/mail/drafts/${draftId}/send`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateMailItem(
  id: string,
  updates: Partial<{ folder: EmailFolder; isRead: boolean; isStarred: boolean }>,
): Promise<OverviewMailItem> {
  return authedFetch(`/ndyspace/mail/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteMailItem(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/mail/${id}`, { method: "DELETE" });
}

export function emptyMailTrash(): Promise<{ deletedCount: number }> {
  return authedFetch("/ndyspace/mail/trash/empty", { method: "POST" });
}

// --- Calendar ---

export function listCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  return authedFetch(`/ndyspace/calendar/events?from=${from}&to=${to}`);
}

export function listUpcomingEvents(take = 5): Promise<CalendarEvent[]> {
  return authedFetch(`/ndyspace/calendar/events/upcoming?take=${take}`);
}

export function createCalendarEvent(params: {
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  color?: string;
  attendeeEmails?: string[];
}): Promise<CalendarEvent> {
  return authedFetch("/ndyspace/calendar/events", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateCalendarEvent(
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    color: string;
    attendeeEmails: string[];
  }>,
): Promise<CalendarEvent> {
  return authedFetch(`/ndyspace/calendar/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteCalendarEvent(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/calendar/events/${id}`, { method: "DELETE" });
}

// --- Drive ---

export function listDriveFolders(): Promise<DriveFolderSummary[]> {
  return authedFetch("/ndyspace/drive/folders");
}

export function createDriveFolder(name: string): Promise<DriveFolderSummary> {
  return authedFetch("/ndyspace/drive/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deleteDriveFolder(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/drive/folders/${id}`, { method: "DELETE" });
}

export function listDriveFiles(folderId?: string): Promise<DriveFile[]> {
  const query = folderId ? `?folderId=${folderId}` : "";
  return authedFetch(`/ndyspace/drive/files${query}`);
}

export function listRecentDriveFiles(): Promise<DriveFile[]> {
  return authedFetch("/ndyspace/drive/files/recent");
}

export async function uploadDriveFile(file: File, folderId?: string): Promise<DriveFile> {
  const formData = new FormData();
  formData.append("file", file);
  const query = folderId ? `?folderId=${folderId}` : "";
  const res = await fetch(`${PROXIED_API_PATH}/ndyspace/drive/files${query}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new NdyspaceApiError(
      body.message ?? `Upload failed with status ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

export function deleteDriveFile(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/drive/files/${id}`, { method: "DELETE" });
}

export function moveDriveFile(id: string, folderId: string | null): Promise<DriveFile> {
  return authedFetch(`/ndyspace/drive/files/${id}/move`, {
    method: "PATCH",
    body: JSON.stringify({ folderId }),
  });
}

export function getDriveStorageUsage(): Promise<DriveStorageUsage> {
  return authedFetch("/ndyspace/drive/storage");
}

// --- Contacts ---

export function listContacts(): Promise<Contact[]> {
  return authedFetch("/ndyspace/contacts");
}

export function createContact(params: {
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  ndyId?: string;
}): Promise<Contact> {
  return authedFetch("/ndyspace/contacts", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateContact(
  id: string,
  updates: Partial<{
    fullName: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
    ndyId: string;
  }>,
): Promise<Contact> {
  return authedFetch(`/ndyspace/contacts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteContact(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/contacts/${id}`, { method: "DELETE" });
}

// --- Tasks ---

export function listTasks(status?: TaskStatus): Promise<NdyspaceTask[]> {
  const query = status ? `?status=${status}` : "";
  return authedFetch(`/ndyspace/tasks${query}`);
}

export function createTask(params: {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueAt?: string;
}): Promise<NdyspaceTask> {
  return authedFetch("/ndyspace/tasks", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateTask(
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    dueAt: string;
  }>,
): Promise<NdyspaceTask> {
  return authedFetch(`/ndyspace/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function setTaskComplete(id: string, complete: boolean): Promise<NdyspaceTask> {
  return authedFetch(`/ndyspace/tasks/${id}/${complete ? "complete" : "reopen"}`, {
    method: "PATCH",
  });
}

export function deleteTask(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/tasks/${id}`, { method: "DELETE" });
}

// --- Notes ---

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export function listNotes(): Promise<Note[]> {
  return authedFetch("/ndyspace/notes");
}

export function createNote(params: { title: string; body?: string }): Promise<Note> {
  return authedFetch("/ndyspace/notes", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateNote(
  id: string,
  updates: Partial<{ title: string; body: string }>,
): Promise<Note> {
  return authedFetch(`/ndyspace/notes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteNote(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/notes/${id}`, { method: "DELETE" });
}

// --- Bookmarks ---

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

export function listBookmarks(): Promise<Bookmark[]> {
  return authedFetch("/ndyspace/bookmarks");
}

export function createBookmark(params: { title: string; url: string }): Promise<Bookmark> {
  return authedFetch("/ndyspace/bookmarks", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function deleteBookmark(id: string): Promise<{ id: string }> {
  return authedFetch(`/ndyspace/bookmarks/${id}`, { method: "DELETE" });
}

// --- Notifications ---

export function listNdyspaceNotifications(): Promise<NdyspaceNotification[]> {
  return authedFetch("/ndyspace/notifications");
}

export function getNdyspaceUnreadNotificationCount(): Promise<{ count: number }> {
  return authedFetch("/ndyspace/notifications/unread-count");
}

export function markNdyspaceNotificationRead(id: string): Promise<NdyspaceNotification> {
  return authedFetch(`/ndyspace/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNdyspaceNotificationsRead(): Promise<{ updatedCount: number }> {
  return authedFetch("/ndyspace/notifications/read-all", { method: "POST" });
}
