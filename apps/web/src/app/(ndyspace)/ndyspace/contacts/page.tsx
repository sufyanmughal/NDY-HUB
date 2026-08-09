"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import { NewContactModal, EditContactModal } from "@/components/ndyspace/quick-action-modals";
import { listContacts, deleteContact, type Contact } from "@/lib/ndyspace-api";

export default function NdyspaceContactsPage() {
  const { auth } = useAuth();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [query, setQuery] = useState("");

  function load() {
    if (auth.status !== "authenticated") return;
    listContacts()
      .then(setContacts)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  if (auth.status !== "authenticated") return null;

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this contact?")) return;
    await deleteContact(id);
    load();
  }

  const filtered = contacts?.filter((c) =>
    `${c.fullName} ${c.email ?? ""} ${c.company ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Your personal contact book — separate from NDY HUB accounts.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Add Contact
        </button>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search contacts…"
        className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      <div className="rounded-lg border border-border bg-surface">
        {contacts === null || filtered === undefined ? (
          <p className="p-5 text-sm text-foreground-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm text-foreground-muted">
            {contacts?.length === 0
              ? "No contacts yet — add one with the button above."
              : "No contacts match your search."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-3 p-4">
                <Avatar name={c.fullName} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.fullName}</p>
                  <p className="truncate text-xs text-foreground-muted">
                    {[c.email, c.phone, c.company].filter(Boolean).join(" · ") || "No details"}
                  </p>
                </div>
                <button
                  onClick={() => setEditingContact(c)}
                  aria-label={`Edit ${c.fullName}`}
                  className="text-foreground-muted hover:text-accent"
                >
                  <Pencil size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  aria-label={`Delete ${c.fullName}`}
                  className="text-foreground-muted hover:text-critical"
                >
                  <Trash2 size={16} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen && <NewContactModal onClose={() => setCreateOpen(false)} onCreated={load} />}
      {editingContact && (
        <EditContactModal
          contact={editingContact}
          onClose={() => setEditingContact(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
