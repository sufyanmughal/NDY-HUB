import { Plus } from "lucide-react";
import { mockPlatforms } from "@/lib/mock-data";
import { PLATFORM_ICONS } from "@/lib/platform-icons";

export default function PlatformsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Connected Platforms</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Every NDJOYIT surface tied to your NDY ID. Connected platforms open
        without logging in again.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {mockPlatforms.map((platform) => {
          const icon = PLATFORM_ICONS[platform.name];
          const Icon = icon?.icon;
          return (
            <div
              key={platform.name}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex items-center gap-3">
                {Icon && (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: `${icon.color}26`,
                      color: icon.color,
                    }}
                  >
                    <Icon size={18} strokeWidth={2} />
                  </div>
                )}
                <div className="font-medium">{platform.name}</div>
              </div>
              <span
                className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  platform.status === "Connected"
                    ? "bg-good/15 text-good"
                    : "bg-foreground-muted/15 text-foreground-muted"
                }`}
              >
                {platform.status}
              </span>
            </div>
          );
        })}

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-foreground-muted">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
            <Plus size={18} strokeWidth={2} />
          </div>
          <div className="mt-3 text-sm font-medium">More</div>
          <div className="mt-1 text-[11px]">Coming Soon</div>
        </div>
      </div>
    </div>
  );
}
