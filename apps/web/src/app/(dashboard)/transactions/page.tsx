"use client";

import { useAuth } from "@/lib/auth-context";
import { useTransactions } from "@/lib/use-transactions";

// Transactions mixes two different status enums (Membership + CRYNDY) —
// rather than hardcode both exhaustively, classify by keyword. Good enough
// for a status pill; the dedicated /memberships and /cryndy pages are still
// where the precise state machine lives.
function toneFor(status: string): "good" | "warn" | "critical" | "neutral" {
  if (["CANCELLED", "REFUNDED", "EXPIRED"].includes(status)) return "critical";
  if (["ACTIVE", "AVAILABLE", "DISTRIBUTED_ON_CHAIN", "VERIFIED", "PAYMENT_CONFIRMED"].includes(status))
    return "good";
  if (["ALLOCATED", "LOCKED", "UNDER_REVIEW"].includes(status)) return "warn";
  return "neutral";
}

const toneClasses: Record<string, string> = {
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  critical: "bg-critical/15 text-critical",
  neutral: "bg-accent/15 text-accent",
};

export default function TransactionsPage() {
  const { auth } = useAuth();
  const transactions = useTransactions();

  if (auth.status !== "authenticated") return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Every membership and CRYNDY transaction on your account, newest first.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        {transactions && transactions.length === 0 ? (
          <p className="text-sm text-foreground-muted">
            No transactions yet — memberships and CRYNDY purchases will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {transactions?.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{txn.label}</div>
                  <div className="text-xs text-foreground-muted">{txn.detail}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono tabular-nums">
                    {txn.amount.toLocaleString(undefined, { style: "currency", currency: txn.currency })}
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClasses[toneFor(txn.status)]}`}
                    >
                      {txn.status}
                    </span>
                    <span className="text-xs text-foreground-muted">
                      {new Date(txn.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
