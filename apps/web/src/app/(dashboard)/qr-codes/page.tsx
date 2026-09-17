"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  QrCode as QrCodeIcon,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  ApiError,
  createQrCode,
  deleteQrCode,
  getQrAnalytics,
  listQrCodes,
  publicQrUrl,
  updateQrCode,
  type NdyQrAnalytics,
  type NdyQrCode,
  type NdyQrType,
} from "@/lib/api";
import {
  NDY_QR_BRAND,
  downloadDataUrl,
  renderNdyQrPng,
  renderNdyQrSvg,
  validateNdyQrPng,
} from "@/lib/ndyqr-render";

const QR_TYPES: NdyQrType[] = [
  "LINK",
  "PASSPORT",
  "NDYSTAYS",
  "NDYCONNECT",
  "NDYQUIZ",
  "NDYVIXIT",
  "NDYXTRA",
  "NDYPAY",
  "LOGIN",
];

const TYPE_LABEL: Record<NdyQrType, string> = {
  LINK: "Link",
  PASSPORT: "NDY Passport",
  NDYSTAYS: "NDYSTAYS",
  NDYCONNECT: "NDYCONNECT",
  NDYQUIZ: "NDYQUIZ",
  NDYVIXIT: "NDYVIXIT",
  NDYXTRA: "NDYXTRA",
  NDYPAY: "NDYPAY",
  LOGIN: "Login",
};

/** Shared field styling — this app has no global `.input` class, so the
 * form controls use the same theme tokens (surface/border/accent) as
 * everywhere else inline. */
const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

export default function QrCodesPage() {
  const [codes, setCodes] = useState<NdyQrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<NdyQrCode | null>(null);
  const [analyticsFor, setAnalyticsFor] = useState<NdyQrCode | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCodes(await listQrCodes());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your QR codes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totalScans = useMemo(
    () => codes.reduce((sum, c) => sum + (c._count?.scans ?? 0), 0),
    [codes],
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <QrCodeIcon className="h-6 w-6 text-fuchsia-500" strokeWidth={2} />
            <h1 className="text-2xl font-bold">NDYQR™</h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            One code, endless connections. Create a QR once — change where it
            points any time, without reprinting it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            <Plus className="h-4 w-4" /> New QR code
          </button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Active codes" value={codes.filter((c) => c.isActive).length} />
        <Stat label="Total codes" value={codes.length} />
        <Stat label="Total scans" value={totalScans} />
      </div>

      {showCreate && (
        <CreateForm
          onCreated={(code) => {
            setCodes((prev) => [code, ...prev]);
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
        ) : codes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-14 text-center">
            <QrCodeIcon className="mx-auto h-8 w-8 text-foreground-muted" />
            <p className="mt-3 text-sm font-medium">No QR codes yet</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Create your first one — it takes a few seconds.
            </p>
          </div>
        ) : (
          codes.map((code) => (
            <CodeRow
              key={code.id}
              code={code}
              onEdit={() => setEditing(code)}
              onAnalytics={() => setAnalyticsFor(code)}
              onDeleted={() =>
                setCodes((prev) => prev.filter((c) => c.id !== code.id))
              }
              onUpdated={(updated) =>
                setCodes((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c)),
                )
              }
            />
          ))
        )}
      </div>

      {editing && (
        <EditDialog
          code={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setCodes((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            );
            setEditing(null);
          }}
        />
      )}

      {analyticsFor && (
        <AnalyticsDialog
          code={analyticsFor}
          onClose={() => setAnalyticsFor(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-foreground-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function CodeRow({
  code,
  onEdit,
  onAnalytics,
  onDeleted,
  onUpdated,
}: {
  code: NdyQrCode;
  onEdit: () => void;
  onAnalytics: () => void;
  onDeleted: () => void;
  onUpdated: (c: NdyQrCode) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const url = publicQrUrl(code.slug);

  useEffect(() => {
    let cancelled = false;
    void renderNdyQrPng(url, {
      sizePx: 320,
      colorFrom: code.colorFrom,
      colorTo: code.colorTo,
    })
      .then((png) => {
        if (!cancelled) setPreview(png);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [url, code.colorFrom, code.colorTo]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function download(kind: "png" | "svg") {
    setNote(null);
    // Render the raster form and validate that it actually decodes before
    // handing anything to the user — the client's "automatic scan/readability
    // validation before a QR is published" requirement. A code that renders
    // beautifully but doesn't scan is exactly the failure this guards against.
    const png = await renderNdyQrPng(url, {
      sizePx: 1024,
      colorFrom: code.colorFrom,
      colorTo: code.colorTo,
    });
    const scannable = await validateNdyQrPng(png, url);
    if (!scannable) {
      setNote(
        "Readability check failed — this code may not scan, so it wasn't downloaded. Try a different tint.",
      );
      return;
    }
    if (kind === "png") {
      downloadDataUrl(png, `ndyqr-${code.slug}.png`);
      return;
    }
    const svg = renderNdyQrSvg(url, {
      sizePx: 1024,
      colorFrom: code.colorFrom,
      colorTo: code.colorTo,
    });
    const blobUrl = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml" }),
    );
    downloadDataUrl(blobUrl, `ndyqr-${code.slug}.svg`);
    URL.revokeObjectURL(blobUrl);
  }

  async function toggleActive() {
    setBusy(true);
    try {
      onUpdated(await updateQrCode(code.id, { isActive: !code.isActive }));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${code.label}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteQrCode(code.id);
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img src={preview} alt={code.label} className="h-full w-full" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-black/30" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{code.label}</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground-muted">
            {TYPE_LABEL[code.type]}
          </span>
          {!code.isActive && (
            <span className="rounded-full bg-critical/15 px-2 py-0.5 text-[11px] text-critical">
              Inactive
            </span>
          )}
        </div>
        <div className="mt-1 truncate text-sm text-foreground-muted">
          → {code.destination}
        </div>
        <div className="mt-1 truncate font-mono text-xs text-accent">{url}</div>
        <div className="mt-1 text-xs text-foreground-muted">
          {code._count?.scans ?? 0} scans
          {code.campaign ? ` · ${code.campaign}` : ""}
        </div>
        {note && <div className="mt-1 text-xs text-critical">{note}</div>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <IconButton title="Copy link" onClick={() => void copy()}>
          {copied ? <span className="text-xs">Copied</span> : <Copy className="h-4 w-4" />}
        </IconButton>
        <IconButton title="Open" onClick={() => window.open(url, "_blank")}>
          <ExternalLink className="h-4 w-4" />
        </IconButton>
        <IconButton title="Download PNG" onClick={() => void download("png")}>
          <Download className="h-4 w-4" />
        </IconButton>
        <IconButton title="Download SVG" onClick={() => void download("svg")}>
          <span className="text-[11px] font-semibold">SVG</span>
        </IconButton>
        <IconButton title="Analytics" onClick={onAnalytics}>
          <span className="text-[11px] font-semibold">Stats</span>
        </IconButton>
        <IconButton title="Edit" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconButton>
        <IconButton title={code.isActive ? "Deactivate" : "Activate"} onClick={() => void toggleActive()} disabled={busy}>
          <span className="text-[11px] font-semibold">
            {code.isActive ? "Off" : "On"}
          </span>
        </IconButton>
        <IconButton title="Delete" onClick={() => void remove()} disabled={busy}>
          <Trash2 className="h-4 w-4 text-critical" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 min-w-8 items-center justify-center rounded-md border border-border px-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (c: NdyQrCode) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [destination, setDestination] = useState("https://");
  const [type, setType] = useState<NdyQrType>("LINK");
  const [campaign, setCampaign] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await createQrCode({
          label,
          destination,
          type,
          campaign: campaign || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the code.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">New QR code</h2>
        <button type="button" onClick={onCancel} title="Close">
          <X className="h-4 w-4 text-foreground-muted" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Table 4 — menu"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as NdyQrType)}
            className={INPUT_CLASS}
          >
            {QR_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destination URL">
          <input
            required
            type="url"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="https://ndystays.com/room/42"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Campaign (optional)">
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="summer-launch"
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create
        </button>
      </div>
    </form>
  );
}

function EditDialog({
  code,
  onClose,
  onSaved,
}: {
  code: NdyQrCode;
  onClose: () => void;
  onSaved: (c: NdyQrCode) => void;
}) {
  const [label, setLabel] = useState(code.label);
  const [destination, setDestination] = useState(code.destination);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateQrCode(code.id, { label, destination }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save changes.");
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Edit “${code.label}”`}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="input" required />
        </Field>
        <Field label="Destination URL">
          <input
            type="url"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </Field>
        <p className="text-xs text-foreground-muted">
          The code itself never changes — only where it points. Update this any
          time, even after the QR is printed.
        </p>
        {error && <p className="text-sm text-critical">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AnalyticsDialog({
  code,
  onClose,
}: {
  code: NdyQrCode;
  onClose: () => void;
}) {
  const [data, setData] = useState<NdyQrAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQrAnalytics(code.id)
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load analytics."),
      );
  }, [code.id]);

  const max = data ? Math.max(1, ...data.byDay.map((d) => d.count)) : 1;

  return (
    <Modal onClose={onClose} title={`Analytics — ${code.label}`}>
      {error && <p className="text-sm text-critical">{error}</p>}
      {!data && !error && (
        <p className="flex items-center gap-2 text-sm text-foreground-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}
      {data && (
        <div className="space-y-5">
          <div className="text-sm text-foreground-muted">
            <span className="text-2xl font-bold text-foreground">{data.total}</span>{" "}
            lifetime scans · {data.byDay.reduce((s, d) => s + d.count, 0)} in the
            last {data.windowDays} days
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-foreground-muted">
              Last {data.windowDays} days
            </div>
            <div className="flex h-24 items-end gap-[3px]">
              {data.byDay.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.count}`}
                  className="flex-1 rounded-t"
                  style={{
                    height: `${(d.count / max) * 100}%`,
                    minHeight: d.count > 0 ? 3 : 1,
                    background: `linear-gradient(180deg, ${NDY_QR_BRAND.colorFrom}, ${NDY_QR_BRAND.colorTo})`,
                    opacity: d.count > 0 ? 1 : 0.15,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Breakdown title="Devices" rows={data.devices} />
            <Breakdown title="Top locations" rows={data.topLocations} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; count: number }[];
}) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-foreground-muted">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-foreground-muted">No data yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex justify-between gap-3">
              <span className="truncate capitalize">{r.key}</span>
              <span className="text-foreground-muted">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} title="Close">
            <X className="h-4 w-4 text-foreground-muted" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
