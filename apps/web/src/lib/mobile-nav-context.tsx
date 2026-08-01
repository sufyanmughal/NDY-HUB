"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";

interface MobileNavContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

/**
 * The hamburger button (Topbar) and the drawer it opens (MobileNavDrawer)
 * are siblings, not parent/child — this is the shared open/close state
 * between them, scoped to the dashboard layout that renders both.
 */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Closes automatically on navigation — otherwise picking a link leaves
  // the drawer sitting open over the new page. Adjusting state during
  // render (React's documented pattern for "reset when a prop/value
  // changes") rather than in a useEffect avoids the extra post-render
  // commit an effect would cost here.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <MobileNavContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx)
    throw new Error("useMobileNav must be used within MobileNavProvider");
  return ctx;
}
