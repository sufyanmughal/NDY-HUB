import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { DashboardGate } from "@/components/dashboard-gate";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { MobileNavProvider } from "@/lib/mobile-nav-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardGate>
      <MobileNavProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <MobileNavDrawer />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="min-w-0 flex-1 p-6">{children}</main>
          </div>
        </div>
      </MobileNavProvider>
    </DashboardGate>
  );
}
