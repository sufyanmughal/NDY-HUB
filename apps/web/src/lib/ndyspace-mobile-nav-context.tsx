"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";

interface NdyspaceMobileNavContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

// A separate instance of the exact same pattern as lib/mobile-nav-context.tsx
// — kept distinct rather than shared so the two sidebars' open state can
// never leak into each other if a user somehow has both layouts mounted at
// once (they can't today, but this makes that a non-issue rather than an
// assumption).
const NdyspaceMobileNavContext = createContext<NdyspaceMobileNavContextValue | null>(null);

export function NdyspaceMobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setIsOpen(false);
  }

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  return (
    <NdyspaceMobileNavContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </NdyspaceMobileNavContext.Provider>
  );
}

export function useNdyspaceMobileNav(): NdyspaceMobileNavContextValue {
  const ctx = useContext(NdyspaceMobileNavContext);
  if (!ctx) {
    throw new Error("useNdyspaceMobileNav must be used within NdyspaceMobileNavProvider");
  }
  return ctx;
}
