"use client";

import { useEffect, useState } from "react";
import { Trash2, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listBookmarks, createBookmark, deleteBookmark, type Bookmark } from "@/lib/ndyspace-api";

function faviconFor(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch {
    return null;
  }
}

export default function NdyspaceBookmarksPage() {
  const { auth } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    if (auth.status !== "authenticated") return;
    listBookmarks()
      .then(setBookmarks)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  if (auth.status !== "authenticated") return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createBookmark({ title, url });
      setTitle("");
      setUrl("");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteBookmark(id);
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Bookmarks</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          A flat saved-links list — folders/tags for bookmarks are a follow-up.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wide text-foreground-muted">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wide text-foreground-muted">
            URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://…"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </form>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="rounded-lg border border-border bg-surface">
        {bookmarks === null ? (
          <p className="p-5 text-sm text-foreground-muted">Loading…</p>
        ) : bookmarks.length === 0 ? (
          <p className="p-5 text-sm text-foreground-muted">No bookmarks yet — add one above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {bookmarks.map((b) => {
              const favicon = faviconFor(b.url);
              return (
                <li key={b.id} className="flex items-center gap-3 p-3">
                  {favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={favicon} alt="" width={18} height={18} className="shrink-0" />
                  ) : (
                    <ExternalLink size={16} strokeWidth={2} className="shrink-0 text-foreground-muted" />
                  )}
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm hover:underline"
                  >
                    {b.title}
                  </a>
                  <button
                    onClick={() => handleDelete(b.id)}
                    aria-label={`Delete ${b.title}`}
                    className="text-foreground-muted hover:text-critical"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
