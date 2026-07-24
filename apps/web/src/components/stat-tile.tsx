export function StatTile({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: { text: string; tone: "good" | "warn" | "critical" | "neutral" };
}) {
  const badgeTone =
    badge?.tone === "good"
      ? "bg-good/15 text-good"
      : badge?.tone === "warn"
        ? "bg-warn/15 text-warn"
        : badge?.tone === "critical"
          ? "bg-critical/15 text-critical"
          : "bg-accent/15 text-accent";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeTone}`}>
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}
