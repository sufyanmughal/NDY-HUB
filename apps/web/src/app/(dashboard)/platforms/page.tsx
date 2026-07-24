import { mockPlatforms } from "@/lib/mock-data";

export default function PlatformsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Connected Platforms</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Every NDJOYIT surface tied to your NDY ID. Connected platforms open without logging in again.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {mockPlatforms.map((platform) => (
          <div key={platform.name} className="rounded-lg border border-border bg-surface p-4">
            <div className="font-medium">{platform.name}</div>
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                platform.status === "Connected"
                  ? "bg-good/15 text-good"
                  : "bg-foreground-muted/15 text-foreground-muted"
              }`}
            >
              {platform.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
