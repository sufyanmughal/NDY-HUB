"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMySupportTickets,
  createSupportTicket,
  type SupportTicket,
} from "@/lib/api";

export default function SupportPage() {
  const { auth } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getMySupportTickets()
      .then((result) => {
        if (!cancelled) setTickets(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (auth.status !== "authenticated") return null;
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Send us a message and we&apos;ll reply here — no need to check email.
        </p>
      </div>

      <NewTicketForm
        onCreated={(t) => setTickets((prev) => [t, ...(prev ?? [])])}
      />

      {loadError && <p className="text-sm text-critical">{loadError}</p>}

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">
          Your requests
        </h2>
        {tickets && tickets.length === 0 && (
          <p className="mt-3 text-sm text-foreground-muted">
            Nothing yet — your requests will show up here.
          </p>
        )}
        {tickets && tickets.length > 0 && (
          <ul className="mt-3 space-y-3">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{t.subject}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      t.status === "RESOLVED"
                        ? "bg-good/15 text-good"
                        : "bg-accent/15 text-accent"
                    }`}
                  >
                    {t.status === "RESOLVED" ? "Resolved" : "Open"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground-muted">
                  {t.message}
                </p>
                <p className="mt-2 text-xs text-foreground-muted">
                  Sent {new Date(t.createdAt).toLocaleString()}
                </p>
                {t.adminReply && (
                  <div className="mt-3 rounded-md bg-surface-2 p-3">
                    <p className="text-xs font-medium text-foreground-muted">
                      Reply
                    </p>
                    <p className="mt-1 text-sm">{t.adminReply}</p>
                    {t.repliedAt && (
                      <p className="mt-1 text-xs text-foreground-muted">
                        {new Date(t.repliedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewTicketForm({
  onCreated,
}: {
  onCreated: (ticket: SupportTicket) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const ticket = await createSupportTicket(subject, message);
      onCreated(ticket);
      setSubject("");
      setMessage("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2 className="text-sm font-medium text-foreground-muted">New request</h2>

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
        Subject
      </label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
        maxLength={200}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
        Message
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        rows={4}
        maxLength={5000}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      {error && <p className="mt-3 text-sm text-critical">{error}</p>}
      {sent && (
        <p className="mt-3 text-sm text-good">Sent — we&apos;ll reply here.</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
