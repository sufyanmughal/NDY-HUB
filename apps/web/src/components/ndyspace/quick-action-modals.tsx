"use client";

import { useState } from "react";
import {
  sendMail,
  createCalendarEvent,
  uploadDriveFile,
  createNote,
  createContact,
  createTask,
  type TaskPriority,
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
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface-2"
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

export function NewEventModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createCalendarEvent({
        title,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
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
        <label className={labelClass}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Starts</label>
        <input
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          required
          className={inputClass}
        />
        <label className={labelClass}>Ends</label>
        <input
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
          required
          className={inputClass}
        />
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating…" : "Create Event"}
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
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Saving…" : "Add Contact"}
        </button>
      </form>
    </ModalShell>
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
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTask({ title, priority });
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
        <label className={labelClass}>Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className={inputClass}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? "Creating…" : "Create Task"}
        </button>
      </form>
    </ModalShell>
  );
}
