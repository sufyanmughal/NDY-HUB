import { DashboardGate } from "@/components/dashboard-gate";
import { NdyspaceSidebar } from "@/components/ndyspace/ndyspace-sidebar";
import { NdyspaceTopbar } from "@/components/ndyspace/ndyspace-topbar";
import { NdyspaceMobileNavDrawer } from "@/components/ndyspace/ndyspace-mobile-nav-drawer";
import { NdyspaceFooter } from "@/components/ndyspace/ndyspace-footer";
import { NdyspaceMobileNavProvider } from "@/lib/ndyspace-mobile-nav-context";
import "@/styles/ndyspace.css";

// NDYSPACE reuses NDY HUB's real auth wholesale — DashboardGate is the same
// component that guards every other page under (dashboard), imported as-is
// rather than reimplemented, so there is exactly one place that decides
// "is this visitor allowed past the login wall." NDYSPACE gets its own
// sidebar/topbar (per the reference screenshot's own nav — §2.2) instead
// of the (dashboard) layout's, since the module list, storage widget, and
// footer branding are specific to this product.
//
// Visuals (colors/spacing) for this whole subtree come from the
// .ndyspace-shell-scoped stylesheet at src/styles/ndyspace.css, transcribed
// from the client's reference mockup — same architecture as .ndy-homepage
// in homepage.css, kept separate since the two mockups use different
// palettes.
export default function NdyspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGate>
      <NdyspaceMobileNavProvider>
        <div className="ndyspace-shell flex min-h-screen flex-col">
          <div className="flex flex-1">
            <NdyspaceSidebar />
            <NdyspaceMobileNavDrawer />
            <div className="flex min-w-0 flex-1 flex-col">
              <NdyspaceTopbar />
              <main className="ndyspace-main min-w-0 flex-1 p-6">{children}</main>
            </div>
          </div>
          <NdyspaceFooter />
        </div>
      </NdyspaceMobileNavProvider>
    </DashboardGate>
  );
}
