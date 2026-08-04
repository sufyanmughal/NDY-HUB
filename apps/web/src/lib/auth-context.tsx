"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ApiError, getMe, logoutSession } from "./api";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; ndyId: string; passportComplete: boolean };

interface AuthContextValue {
  auth: AuthState;
  /** Re-syncs auth state from the server — call this right after any flow
   * that ends in a freshly issued session (password login, 2FA verify,
   * passkey login, QR exchange, OAuth exchange). The session itself is
   * already set as an httpOnly cookie by the API response that preceded
   * this call; there's nothing for the client to store, just its own
   * "am I logged in, and as whom" state to catch up. */
  login: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  // Resolves what the current auth state actually is, without touching
  // React state itself — kept side-effect-free so both the mount effect
  // and the exposed `login()` (called imperatively after a fresh session
  // is issued) can share it, each doing its own setAuth off the result.
  const resolveAuth = useCallback(async (): Promise<AuthState> => {
    try {
      const me = await getMe();
      return {
        status: "authenticated",
        ndyId: me.ndyId,
        passportComplete: me.passportComplete,
      };
    } catch (err) {
      // A visitor with no session at all fails here twice over: /auth/me
      // 401s (no access token cookie), and authedFetch's own reactive
      // refresh-and-retry then also fails (no refresh token cookie either,
      // so /auth/refresh 400s). Both are the ordinary, expected shape of
      // "not logged in" — only something that isn't an ApiError at all
      // (a network failure, a 500) is actually worth surfacing.
      if (!(err instanceof ApiError)) {
        console.error("Failed to resolve auth state:", err);
      }
      return { status: "unauthenticated" };
    }
  }, []);

  useEffect(() => {
    resolveAuth().then(setAuth);
  }, [resolveAuth]);

  const login = useCallback(async () => {
    setAuth(await resolveAuth());
  }, [resolveAuth]);

  const logout = useCallback(() => {
    // Best-effort: the cookies are cleared server-side either way, and
    // local state flips to logged-out regardless of whether this network
    // call itself succeeds.
    void logoutSession().catch(() => {});
    setAuth({ status: "unauthenticated" });
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
