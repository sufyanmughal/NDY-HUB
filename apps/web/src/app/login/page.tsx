import { QrLoginCard } from "@/components/qr-login-card";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
        <p className="mt-1 text-sm text-foreground-muted">One Identity. One Passport. One Ecosystem.</p>
      </div>
      <QrLoginCard />
      <p className="max-w-sm text-center text-xs text-foreground-muted">
        Don&apos;t have NDYAPPS yet? Email and password login lands alongside NDYAPPS in this same
        milestone.
      </p>
    </div>
  );
}
