"use client";

import { useEffect, useState } from "react";
import {
  Folder,
  FolderPlus,
  Upload,
  Trash2,
  Download,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listDriveFolders,
  listDriveFiles,
  createDriveFolder,
  deleteDriveFolder,
  uploadDriveFile,
  deleteDriveFile,
  getDriveStorageUsage,
  type DriveFolderSummary,
  type DriveFile,
  type DriveStorageUsage,
} from "@/lib/ndyspace-api";

function fileIconFor(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document")) {
    return FileText;
  }
  return FileIcon;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function NdyspaceDrivePage() {
  const { auth } = useAuth();
  const [folders, setFolders] = useState<DriveFolderSummary[] | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | undefined>(undefined);
  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [storage, setStorage] = useState<DriveStorageUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function loadFolders() {
    listDriveFolders().then(setFolders).catch((err) => setError((err as Error).message));
    getDriveStorageUsage().then(setStorage).catch(() => {});
  }

  function loadFiles() {
    // Deferred rather than called synchronously — this function is called
    // directly from a useEffect body below (react-hooks/set-state-in-effect
    // applies transitively through the call), same microtask-hop pattern as
    // ndyspace-hooks.ts's useAuthedPoll.
    Promise.resolve().then(() => setFiles(null));
    listDriveFiles(activeFolderId)
      .then(setFiles)
      .catch((err) => setError((err as Error).message));
  }

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    loadFolders();
  }, [auth]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, activeFolderId]);

  if (auth.status !== "authenticated") return null;

  async function handleCreateFolder() {
    const name = window.prompt("Folder name");
    if (!name) return;
    try {
      await createDriveFolder(name);
      loadFolders();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteFolder(id: string) {
    if (!window.confirm("Delete this folder? Files inside move to root.")) return;
    await deleteDriveFolder(id);
    if (activeFolderId === id) setActiveFolderId(undefined);
    loadFolders();
    loadFiles();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDriveFile(file, activeFolderId);
      loadFiles();
      loadFolders();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteFile(id: string) {
    if (!window.confirm("Delete this file?")) return;
    await deleteDriveFile(id);
    loadFiles();
    loadFolders();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Drive</h1>
          {storage && (
            <p className="mt-1 text-sm text-foreground-muted">
              {formatBytes(storage.usedBytes)} of {formatBytes(storage.totalBytes)} used (
              {storage.percentUsed}%)
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateFolder}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
          >
            <FolderPlus size={15} strokeWidth={2} />
            New Folder
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90">
            <Upload size={15} strokeWidth={2} />
            {uploading ? "Uploading…" : "Upload"}
            <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFolderId(undefined)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            activeFolderId === undefined
              ? "border-accent bg-accent/15 text-accent"
              : "border-border text-foreground-muted hover:bg-surface-2"
          }`}
        >
          All files
        </button>
        {folders?.map((f) => (
          <div key={f.id} className="group relative">
            <button
              onClick={() => setActiveFolderId(f.id)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${
                activeFolderId === f.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-foreground-muted hover:bg-surface-2"
              }`}
            >
              <Folder size={13} strokeWidth={2} />
              {f.name} ({f.fileCount})
            </button>
            <button
              onClick={() => handleDeleteFolder(f.id)}
              aria-label={`Delete folder ${f.name}`}
              className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-critical text-white group-hover:flex"
            >
              <Trash2 size={9} strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface">
        {files === null ? (
          <p className="p-5 text-sm text-foreground-muted">Loading…</p>
        ) : files.length === 0 ? (
          <p className="p-5 text-sm text-foreground-muted">
            No files here yet — upload one with the button above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((f) => {
              const Icon = fileIconFor(f.mimeType);
              return (
                <li key={f.id} className="flex items-center gap-3 p-3">
                  <Icon size={18} strokeWidth={2} className="shrink-0 text-foreground-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{f.name}</p>
                    <p className="text-xs text-foreground-muted">
                      {formatBytes(f.sizeBytes)} · {new Date(f.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Download ${f.name}`}
                    className="text-foreground-muted hover:text-foreground"
                  >
                    <Download size={16} strokeWidth={2} />
                  </a>
                  <button
                    onClick={() => handleDeleteFile(f.id)}
                    aria-label={`Delete ${f.name}`}
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
