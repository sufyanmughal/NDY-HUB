export function PlaceholderSection({
  title,
  milestone,
  description,
}: {
  title: string;
  milestone: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-8">
      <div className="text-xs font-medium uppercase tracking-wide text-accent">{milestone}</div>
      <h1 className="mt-2 text-xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-prose text-sm text-foreground-muted">{description}</p>
    </div>
  );
}
