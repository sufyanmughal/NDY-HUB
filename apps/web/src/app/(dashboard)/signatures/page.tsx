"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, FileSignature, Loader2, PenLine, Plus } from "lucide-react";
import {
  ApiError,
  createSignatureRequest,
  listMySignatures,
  revokeSignatureRequest,
  type SignatureRequestSummary,
  type SignatureSignerSlot,
} from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-accent/15 text-accent",
  SIGNED: "bg-good/15 text-good",
  DECLINED: "bg-warn/15 text-warn",
  EXPIRED: "bg-surface-2 text-foreground-muted",
  REVOKED: "bg-critical/15 text-critical",
};

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

/** sha256 of the document text — the API stores only this hash, never the
 * bytes (see SignatureRequest.contentHash). */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function SignaturesPage() {
  const [created, setCreated] = useState<SignatureRequestSummary[]>([]);
  const [toSign, setToSign] = useState<SignatureSignerSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listMySignatures();
      setCreated(result.created);
      setToSign(result.toSign);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't load your signatures.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-accent" strokeWidth={2} />
            <h1 className="text-2xl font-bold">NDY Signature</h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            Ask someone to sign a document or statement with their NDY identity.
            Each signature is a durable record a third party can verify.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New request
        </button>
      </header>

      {showCreate && (
        <CreateForm
          onCreated={(request) => {
            setCreated((prev) => [request, ...prev]);
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

      {toSign.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Waiting on you ({toSign.length})
          </h2>
          <div className="space-y-2">
            {toSign.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {slot.signatureRequest.title}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground-muted">
                    From{" "}
                    <span className="font-mono">
                      {slot.signatureRequest.createdByNdyId}
                    </span>{" "}
                    · expires {new Date(slot.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-foreground-muted">
                  Use the link in your notification or email
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Requests you created
        </h2>

        {loading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-foreground-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : created.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <PenLine className="mx-auto h-7 w-7 text-foreground-muted" />
            <p className="mt-3 text-sm font-medium">No signature requests yet</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Create one and share the signing link with each signer.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {created.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                onRevoked={(updated) =>
                  setCreated((prev) =>
                    prev.map((r) => (r.id === updated.id ? updated : r)),
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RequestRow({
  request,
  onRevoked,
}: {
  request: SignatureRequestSummary;
  onRevoked: (r: SignatureRequestSummary) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!confirm(`Revoke "${request.title}"? Signers will no longer be able to sign.`)) {
      return;
    }
    setBusy(true);
    try {
      onRevoked(await revokeSignatureRequest(request.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{request.title}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              STATUS_STYLE[request.status] ?? "bg-surface-2"
            }`}
          >
            {request.status}
          </span>
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-foreground-muted">
          {request.contentHash.slice(0, 24)}…
        </div>
        <div className="mt-0.5 text-xs text-foreground-muted">
          {request._count?.signatures ?? 0}/{request._count?.signers ?? 0} signed
          · created {new Date(request.createdAt).toLocaleDateString()}
        </div>
      </div>
      {request.status === "PENDING" && (
        <button
          onClick={() => void revoke()}
          disabled={busy}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
        >
          Revoke
        </button>
      )}
    </div>
  );
}

function CreateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (r: SignatureRequestSummary) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [contentRef, setContentRef] = useState("");
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signLinks, setSignLinks] = useState<{ email: string | null; url: string }[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const signerList = emails
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (signerList.length === 0) {
        throw new Error("Add at least one signer email.");
      }
      const contentHash = await sha256Hex(documentText);
      const result = await createSignatureRequest({
        title,
        contentHash,
        contentRef: contentRef.trim() || undefined,
        signers: signerList.map((email) => ({ email })),
      });
      setSignLinks(result.signLinks.map((l) => ({ email: l.email, url: l.url })));
      onCreated(result.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the request.");
      setBusy(false);
    }
  }

  // After a successful create we keep the panel open briefly to show the
  // one-time signing links (the raw token is never retrievable again).
  if (signLinks.length > 0) {
    return (
      <div className="mt-6 space-y-3 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Request created</h2>
        <p className="text-sm text-foreground-muted">
          Share each signing link with its signer — these are shown once and
          can&apos;t be retrieved again.
        </p>
        {signLinks.map((link, i) => (
          <SignLink key={i} email={link.email} url={link.url} />
        ))}
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="font-semibold">New signature request</h2>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
          Title
        </span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Partnership agreement"
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
          Document text (hashed, never stored)
        </span>
        <textarea
          required
          rows={5}
          value={documentText}
          onChange={(e) => setDocumentText(e.target.value)}
          placeholder="Paste the statement or document contents to be signed…"
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
          Document link (optional — Drive file id or URL)
        </span>
        <input
          value={contentRef}
          onChange={(e) => setContentRef(e.target.value)}
          placeholder="https://…"
          className={INPUT_CLASS}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
          Signer emails (comma-separated)
        </span>
        <input
          required
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="a@example.com, b@example.com"
          className={INPUT_CLASS}
        />
      </label>

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
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create
        </button>
      </div>
    </form>
  );
}

function SignLink({ email, url }: { email: string | null; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 p-2">
      <span className="min-w-0 flex-1 truncate text-xs">
        <span className="text-foreground-muted">{email ?? "signer"}: </span>
        <span className="font-mono">{url}</span>
      </span>
      <button
        onClick={() => {
          void navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded border border-border px-2 py-1 text-[11px] hover:bg-surface"
      >
        {copied ? "Copied" : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
