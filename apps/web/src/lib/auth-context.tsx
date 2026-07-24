"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { IssuedSession } from "./api";
import { logoutSession, refreshSession } from "./api";
import {
  clearStoredSession,
  decodeAccessToken,
  isExpired,
  readStoredSession,
  storeSession,
  type StoredSession,
} from "./auth-client";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; ndyId: string; accessToken: string; refreshToken: string };

interface AuthContextValue {
  auth: AuthState;
  login: (session: IssuedSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Resolves what, if anything, should become the session on first load:
 * nothing stored, a still-valid stored session, or — if the 15-minute
 * access token has gone stale — a freshly refreshed one. Returning a
 * promise (rather than calling setAuth per-branch) is what lets the effect
 * that calls this defer every state update into a .then callback.
 */
async function resolveStoredAuth(): Promise<{ session: StoredSession | null; shouldPersist: boolean }> {
  const stored = readStoredSession();
  if (!stored) return { session: null, shouldPersist: false };

  const payload = decodeAccessToken(stored.accessToken);
  if (payload && !isExpired(payload)) {
    return { session: stored, shouldPersist: false };
  }

  try {
    const refreshed = await refreshSession(stored.refreshToken);
    return { session: refreshed, shouldPersist: true };
  } catch {
    clearStoredSession();
    return { session: null, shouldPersist: false };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  const applySession = useCallback((session: StoredSession) => {
    const payload = decodeAccessToken(session.accessToken);
    if (!payload) {
      clearStoredSession();
      setAuth({ status: "unauthenticated" });
      return;
    }
    setAuth({
      status: "authenticated",
      ndyId: payload.ndyId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
  }, []);

  useEffect(() => {
    // Every branch below resolves through this promise chain rather than
    // calling setAuth directly in the effect body — same reasoning as
    // useLoginRequest's fetchAndSubscribe: keeps every state update inside
    // a callback instead of synchronous-in-effect.
    resolveStoredAuth().then(({ session, shouldPersist }) => {
      if (!session) {
        setAuth({ status: "unauthenticated" });
        return;
      }
      if (shouldPersist) storeSession(session);
      applySession(session);
    });
  }, [applySession]);

  const login = useCallback(
    (session: IssuedSession) => {
      storeSession(session);
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    if (auth.status === "authenticated") {
      void logoutSession(auth.refreshToken).catch(() => {
        /* best-effort — the client-side session is cleared either way */
      });
    }
    clearStoredSession();
    setAuth({ status: "unauthenticated" });
  }, [auth]);

  return <AuthContext.Provider value={{ auth, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
