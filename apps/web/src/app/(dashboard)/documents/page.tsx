"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getMyDocuments, downloadDocument, type DocumentStub } from "@/lib/api";

const TYPE_LABELS: Record<DocumentStub["type"], string> = {
  MEMBERSHIP_CONFIRMATION: "Membership",
  CRYNDY_CERTIFICATE: "CRYNDY",
};

export default function DocumentsPage() {
  const { auth } = useAuth();
  const [documents, setDocuments] = useState<DocumentStub[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    getMyDocuments(auth.accessToken)
      .then(setDocuments)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  if (auth.status !== "authenticated") return null;
  const accessToken = auth.accessToken;

  async function handleDownload(doc: DocumentStub) {
    setBusyId(doc.id);
    setError(null);
    try {
      await downloadDocument(accessToken, doc.id, `${doc.id}.txt`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Membership confirmations and CRYNDY certificates, generated from your account.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-5">
        {documents && documents.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No documents yet — a membership confirmation or CRYNDY certificate shows up here once
            you have one.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {documents?.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-xs text-foreground-muted">
                    {TYPE_LABELS[doc.type]} · {new Date(doc.date).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={busyId === doc.id}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
                >
                  {busyId === doc.id ? "…" : "Download"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-foreground-muted">
        Documents are generated as plain-text receipts for now — branded PDF invoices and
        certificates are a later milestone.
      </p>
    </div>
  );
}
