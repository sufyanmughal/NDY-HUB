"use client";

import { useState } from "react";
import {
  sendMail,
  createCalendarEvent,
  updateCalendarEvent,
  uploadDriveFile,
  createNote,
  updateNote,
  createContact,
  updateContact,
  createTask,
  updateTask,
  type TaskPriority,
  type CalendarEvent,
  type NdyspaceTask,
  type Note,
  type Contact,
} from "@/lib/ndyspace-api";

// Shared modal chrome — six quick-action tiles (§2.3) each open one of
// these, all wired to real backend calls rather than being no-ops. Kept as
// one file since each form is small and they share the exact same
// overlay/card/error/busy shape.
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="ndyspace-card relative z-10 w-full max-w-md p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="ndyspace-icon-btn rounded-md px-2 py-1 text-xs"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelClass = "mt-3 block text-xs uppercase tracking-wide text-foreground-muted";
const buttonClass =
  "mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50";

export function NewEmailModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendMail({
        recipientNdyIds: recipient
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        subject,
        body,
      });
      onSent();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New Email" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>To (NDY ID, comma-separated)</label>
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
          placeholder="NDY-ABC123"
          className={inputClass}
        />
        <label className={labelClass}>Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={5}
          className={inputClass}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </ModalShell>
  );
}

// --- Calendar event form: shared by NewEventModal and EditEventModal ---

const EVENT_COLORS = [
  "#4f7cff", // accent
  "#8b5cf6", // accent-2
  "#22c58b", // good
  "#e0a83c", // warn
  "#f0605a", // critical
  "#1a598c",
  "#29cb8f",
  "#31147e",
];

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Sao_Paulo",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Rome",
  "Europe/Athens",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];

function getSupportedTimezones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const values = Intl.supportedValuesOf("timeZone") as string[];
      if (Array.isArray(values) && values.length > 0) return values;
    }
  } catch {
    // fall through to static list
  }
  return COMMON_TIMEZONES;
}

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Converts a wall-clock "YYYY-MM-DD" + "HH:mm" pair, interpreted in the
// given IANA zone, into a correct UTC ISO instant — without pulling in a
// date library. Intl.DateTimeFormat can report what a candidate UTC instant
// looks like *in* the target zone; comparing that against the wall-clock we
// want and correcting the delta converges in one step (the zone offset for
// a given calendar date is constant within that date's range, so this isn't
// an iterative DST search — one pass is enough).
function zonedWallTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Naive instant as if the wall-clock time were UTC.
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(naiveUtcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // formatToParts renders hour "24" for midnight in hour12:false in some
  // engines — normalize.
  const renderedHour = get("hour") % 24;

  const renderedAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    renderedHour,
    get("minute"),
    get("second"),
  );

  // Offset between what we asked for (naive) and what that instant actually
  // renders as in the target zone; subtract it to correct.
  const offsetMs = renderedAsUtcMs - naiveUtcMs;
  return new Date(naiveUtcMs - offsetMs).toISOString();
}

function utcIsoToZonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = (Number(get("hour")) % 24).toString().padStart(2, "0");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

function EventFormFields({
  title,
  setTitle,
  date,
  setDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  timezone,
  setTimezone,
  description,
  setDescription,
  color,
  setColor,
  timezoneOptions,
}: {
  title: string;
  setTitle: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  timezoneOptions: string[];
}) {
  return (
    <>
      <label className={labelClass}>Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className={inputClass}
      />
      <label className={labelClass}>Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
        className={inputClass}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Start time</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>End time</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>
      <label className={labelClass}>Timezone</label>
      <select
        value={timezone}
        onChange={(e) => setTimezone(e.target.value)}
        className={inputClass}
      >
        {timezoneOptions.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      <label className={labelClass}>Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className={inputClass}
      />
      <label className={labelClass}>Color</label>
      <div className="mt-1 flex flex-wrap gap-2">
        {EVENT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full border-2 ${
              color === c ? "border-foreground" : "border-transparent"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Custom color"
          className="h-7 w-9 cursor-pointer rounded border border-border bg-background p-0.5"
        />
      </div>
    </>
  );
}

export function NewEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [timezoneOptions] = useState(getSupportedTimezones);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [timezone, setTimezone] = useState(detectBrowserTimezone);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createCalendarEvent({
        title,
        description: description || undefined,
        startAt: zonedWallTimeToUtcIso(date, startTime, timezone),
        endAt: zonedWallTimeToUtcIso(date, endTime, timezone),
        color,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New Event" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <EventFormFields
          title={title}
          setTitle={setTitle}
          date={date}
          setDate={setDate}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          timezone={timezone}
          setTimezone={setTimezone}
          description={description}
          setDescription={setDescription}
          color={color}
          setColor={setColor}
          timezoneOptions={timezoneOptions}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating…" : "Create Event"}
        </button>
      </form>
    </ModalShell>
  );
}

export function EditEventModal({
  event,
  onClose,
  onUpdated,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [timezoneOptions] = useState(getSupportedTimezones);
  const initialTimezone = detectBrowserTimezone();
  const initialStart = utcIsoToZonedParts(event.startAt, initialTimezone);
  const initialEnd = utcIsoToZonedParts(event.endAt, initialTimezone);

  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(initialStart.date);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [description, setDescription] = useState(event.description ?? "");
  const [color, setColor] = useState(event.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateCalendarEvent(event.id, {
        title,
        description: description || undefined,
        startAt: zonedWallTimeToUtcIso(date, startTime, timezone),
        endAt: zonedWallTimeToUtcIso(date, endTime, timezone),
        color,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Edit Event" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <EventFormFields
          title={title}
          setTitle={setTitle}
          date={date}
          setDate={setDate}
          startTime={startTime}
          setStartTime={setStartTime}
          endTime={endTime}
          setEndTime={setEndTime}
          timezone={timezone}
          setTimezone={setTimezone}
          description={description}
          setDescription={setDescription}
          color={color}
          setColor={setColor}
          timezoneOptions={timezoneOptions}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </ModalShell>
  );
}

export function UploadFileModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadDriveFile(file);
      onUploaded();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Upload File" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>File</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white`}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy || !file} className={buttonClass}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
    </ModalShell>
  );
}

export function NewNoteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createNote({ title, body });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New Note" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Note</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className={inputClass}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save Note"}
        </button>
      </form>
    </ModalShell>
  );
}

export function EditNoteModal({
  note,
  onClose,
  onUpdated,
}: {
  note: Note;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateNote(note.id, { title, body });
      onUpdated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Edit Note" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Note</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className={inputClass}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </ModalShell>
  );
}

export function NewContactModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createContact({
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        notes: notes || undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Add Contact" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>Full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Company</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputClass}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Add Contact"}
        </button>
      </form>
    </ModalShell>
  );
}

export function EditContactModal({
  contact,
  onClose,
  onUpdated,
}: {
  contact: Contact;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [fullName, setFullName] = useState(contact.fullName);
  const [email, setEmail] = useState(contact.email ?? "");
  const [phone, setPhone] = useState(contact.phone ?? "");
  const [company, setCompany] = useState(contact.company ?? "");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateContact(contact.id, {
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        notes: notes || undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Edit Contact" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>Full name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Company</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputClass}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </ModalShell>
  );
}

// --- Task form: shared by NewTaskModal and EditTaskModal ---

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; activeClass: string }[] = [
  { value: "LOW", label: "Low", activeClass: "bg-good/15 text-good border-good" },
  { value: "MEDIUM", label: "Medium", activeClass: "bg-warn/15 text-warn border-warn" },
  { value: "HIGH", label: "High", activeClass: "bg-critical/15 text-critical border-critical" },
];

function PriorityPicker({
  priority,
  setPriority,
}: {
  priority: TaskPriority;
  setPriority: (p: TaskPriority) => void;
}) {
  return (
    <div className="mt-1 flex gap-2">
      {PRIORITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setPriority(opt.value)}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium ${
            priority === opt.value
              ? opt.activeClass
              : "border-border text-foreground-muted hover:bg-surface-2"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function NewTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTask({
        title,
        description: description || undefined,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Create Task" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClass}
        />
        <label className={labelClass}>Due date</label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Priority</label>
        <PriorityPicker priority={priority} setPriority={setPriority} />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating…" : "Create Task"}
        </button>
      </form>
    </ModalShell>
  );
}

export function EditTaskModal({
  task,
  onClose,
  onUpdated,
}: {
  task: NdyspaceTask;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueAt, setDueAt] = useState(task.dueAt ? task.dueAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateTask(task.id, {
        title,
        description: description || undefined,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      });
      onUpdated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Edit Task" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className={labelClass}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={inputClass}
        />
        <label className={labelClass}>Due date</label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className={inputClass}
        />
        <label className={labelClass}>Priority</label>
        <PriorityPicker priority={priority} setPriority={setPriority} />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </ModalShell>
  );
}
