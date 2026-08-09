"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NewTaskModal } from "@/components/ndyspace/quick-action-modals";
import {
  listTasks,
  setTaskComplete,
  deleteTask,
  type NdyspaceTask,
  type TaskStatus,
} from "@/lib/ndyspace-api";

const PRIORITY_STYLE: Record<NdyspaceTask["priority"], string> = {
  HIGH: "bg-critical/15 text-critical",
  MEDIUM: "bg-warn/15 text-warn",
  LOW: "bg-good/15 text-good",
};

export default function NdyspaceTasksPage() {
  const { auth } = useAuth();
  const [tab, setTab] = useState<TaskStatus>("OPEN");
  const [tasks, setTasks] = useState<NdyspaceTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    if (auth.status !== "authenticated") return;
    listTasks(tab)
      .then(setTasks)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    // Deferred rather than called synchronously in the effect body — see
    // ndyspace-hooks.ts's useAuthedPoll for the same microtask-hop pattern.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setTasks(null);
    });
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, tab]);

  if (auth.status !== "authenticated") return null;

  async function toggleComplete(t: NdyspaceTask) {
    await setTaskComplete(t.id, t.status !== "COMPLETED");
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this task?")) return;
    await deleteTask(id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Track work with a priority and a status — nothing recurring yet.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Create Task
        </button>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex gap-1 border-b border-border text-sm">
        <button
          onClick={() => setTab("OPEN")}
          className={`px-3 py-2 ${tab === "OPEN" ? "border-b-2 border-accent font-medium" : "text-foreground-muted"}`}
        >
          My Tasks
        </button>
        <button
          onClick={() => setTab("COMPLETED")}
          className={`px-3 py-2 ${tab === "COMPLETED" ? "border-b-2 border-accent font-medium" : "text-foreground-muted"}`}
        >
          Completed
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        {tasks === null ? (
          <p className="p-5 text-sm text-foreground-muted">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="p-5 text-sm text-foreground-muted">
            {tab === "OPEN" ? "No open tasks — create one above." : "Nothing completed yet."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-4">
                <input
                  type="checkbox"
                  checked={t.status === "COMPLETED"}
                  onChange={() => toggleComplete(t)}
                  className="h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${t.status === "COMPLETED" ? "text-foreground-muted line-through" : ""}`}
                  >
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="truncate text-xs text-foreground-muted">{t.description}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLE[t.priority]}`}
                >
                  {t.priority}
                </span>
                <button
                  onClick={() => handleDelete(t.id)}
                  aria-label={`Delete ${t.title}`}
                  className="text-foreground-muted hover:text-critical"
                >
                  <Trash2 size={16} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {createOpen && <NewTaskModal onClose={() => setCreateOpen(false)} onCreated={load} />}
    </div>
  );
}
