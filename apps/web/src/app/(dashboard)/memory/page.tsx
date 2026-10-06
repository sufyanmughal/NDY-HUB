"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiError,
  createMemory,
  deleteMemory,
  listMemories,
  setMemoryEnabled,
  updateMemory,
  type UserMemory,
  type UserMemoryType,
} from "@/lib/api";

const TYPE_LABEL: Record<UserMemoryType, string> = {
  PREFERENCE: "Preference",
  GOAL: "Goal",
};

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export default function MemoryPage() {
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await listMemories();
      setMemories(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your memory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; `load` updates state only AFTER its await, and is reused as the refresh handler.
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-fuchsia-500" strokeWidth={2} />
            <h1 className="text-2xl font-bold">NDYRA Memory</h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            What NDYRA remembers about you — your preferences and goals. View,
            edit, disable, or delete anything here; nothing is kept or used
            without your control. Separate from your verified Passport facts.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          <Plus className="h-4 w-4" /> Add memory
        </button>
      </header>

      {showCreate && (
        <CreateForm
          onCreated={(memory) => {
            setMemories((prev) => [memory, ...prev]);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {error && (
        <p className="mt-6 rounded-md border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-foreground-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : memories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-14 text-center">
            <Brain className="mx-auto h-8 w-8 text-foreground-muted" />
            <p className="mt-3 text-sm font-medium">Nothing remembered yet</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Preferences and goals you share with NDYRA will show up here.
            </p>
          </div>
        ) : (
          memories.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              onDeleted={() =>
                setMemories((prev) => prev.filter((m) => m.id !== memory.id))
              }
              onUpdated={(updated) =>
                setMemories((prev) =>
                  prev.map((m) => (m.id === updated.id ? updated : m)),
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function MemoryRow({
  memory,
  onDeleted,
  onUpdated,
}: {
  memory: UserMemory;
  onDeleted: () => void;
  onUpdated: (updated: UserMemory) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(memory.content);
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const Icon = memory.type === "GOAL" ? Target : Sparkles;

  const save = async () => {
    setBusy(true);
    setRowError(null);
    try {
      const updated = await updateMemory(memory.id, content);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setRowError(null);
    try {
      await deleteMemory(memory.id);
      onDeleted();
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "Couldn't delete.");
      setBusy(false);
    }
  };

  const toggleEnabled = async () => {
    setBusy(true);
    setRowError(null);
    try {
      const updated = await setMemoryEnabled(memory.id, !memory.enabled);
      onUpdated(updated);
    } catch (err) {
      setRowError(
        err instanceof ApiError ? err.message : "Couldn't update.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-xl border border-border bg-surface px-4 py-3 ${
        memory.enabled ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground-muted">
              {TYPE_LABEL[memory.type]}
            </span>
            {memory.source && (
              <span className="text-xs text-foreground-muted">
                from {memory.source}
              </span>
            )}
            {!memory.enabled && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                Disabled — not used by NDYRA
              </span>
            )}
          </div>
          {editing ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={INPUT_CLASS}
                maxLength={500}
                autoFocus
              />
              <button
                onClick={() => void save()}
                disabled={busy || content.trim().length === 0}
                className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setContent(memory.content);
                  setEditing(false);
                }}
                className="rounded-md border border-border p-2 hover:bg-surface-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="mt-1 text-sm">{memory.content}</p>
          )}
          {rowError && (
            <p className="mt-1 text-xs text-critical">{rowError}</p>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => void toggleEnabled()}
              disabled={busy}
              className="rounded-md p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
              title={memory.enabled ? "Disable" : "Enable"}
            >
              {memory.enabled ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded-md p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => void remove()}
              disabled={busy}
              className="rounded-md p-2 text-foreground-muted hover:bg-critical/10 hover:text-critical disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (memory: UserMemory) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<UserMemoryType>("PREFERENCE");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (content.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const memory = await createMemory({ type, content: content.trim() });
      onCreated(memory);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as UserMemoryType)}
          className={`${INPUT_CLASS} w-40 shrink-0`}
        >
          <option value="PREFERENCE">Preference</option>
          <option value="GOAL">Goal</option>
        </select>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. prefers window seats, or saving for a trip to Málaga"
          className={INPUT_CLASS}
          maxLength={500}
          autoFocus
        />
      </div>
      {error && <p className="mt-2 text-xs text-critical">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => void submit()}
          disabled={busy || content.trim().length === 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
