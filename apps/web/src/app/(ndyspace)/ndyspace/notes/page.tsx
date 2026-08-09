"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NewNoteModal, EditNoteModal } from "@/components/ndyspace/quick-action-modals";
import { listNotes, deleteNote, type Note } from "@/lib/ndyspace-api";

export default function NdyspaceNotesPage() {
  const { auth } = useAuth();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  function load() {
    if (auth.status !== "authenticated") return;
    listNotes()
      .then(setNotes)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  if (auth.status !== "authenticated") return null;

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this note?")) return;
    await deleteNote(id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Plain-text notes. A thinner first pass — rich formatting and sharing are follow-ups.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          New Note
        </button>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      {notes === null ? (
        <p className="text-sm text-foreground-muted">Loading…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-sm text-foreground-muted">
            No notes yet — create one with the button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-medium">{n.title}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setEditingNote(n)}
                    aria-label={`Edit ${n.title}`}
                    className="text-foreground-muted hover:text-accent"
                  >
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => handleDelete(n.id)}
                    aria-label={`Delete ${n.title}`}
                    className="text-foreground-muted hover:text-critical"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs text-foreground-muted line-clamp-6">
                {n.body || "Empty note."}
              </p>
              <p className="mt-3 text-[11px] text-foreground-muted">
                Updated {new Date(n.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {createOpen && <NewNoteModal onClose={() => setCreateOpen(false)} onCreated={load} />}
      {editingNote && (
        <EditNoteModal
          note={editingNote}
          onClose={() => setEditingNote(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
