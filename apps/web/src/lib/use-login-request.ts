"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  API_BASE_URL,
  createLoginRequest,
  exchangeLoginRequest,
  getLoginRequestStatus,
  type IssuedSession,
  type LoginRequestStatus,
} from "./api";

const POLL_FALLBACK_MS = 3000;

export type QrLoginState =
  | { phase: "loading" }
  | { phase: "pending"; token: string; expiresAt: string }
  | { phase: "approved"; token: string }
  | { phase: "success"; session: IssuedSession }
  | { phase: "denied" }
  | { phase: "expired" }
  | { phase: "error"; message: string };

/**
 * Drives the desktop half of the QR login flow end to end: creates the
 * login request, subscribes to its live status over WebSocket (falling
 * back to polling if the socket doesn't connect), and exchanges an
 * APPROVED request for a real session the moment it lands.
 */
export function useLoginRequest() {
  const [state, setState] = useState<QrLoginState>({ phase: "loading" });
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const handleStatus = useCallback(
    async (token: string, status: LoginRequestStatus) => {
      if (status === "DENIED") {
        cleanup();
        setState({ phase: "denied" });
        return;
      }
      if (status === "EXPIRED") {
        cleanup();
        setState({ phase: "expired" });
        return;
      }
      if (status === "APPROVED") {
        cleanup();
        setState({ phase: "approved", token });
        try {
          const session = await exchangeLoginRequest(token);
          setState({ phase: "success", session });
        } catch (err) {
          setState({ phase: "error", message: (err as Error).message });
        }
      }
    },
    [cleanup],
  );

  // Does the actual fetch-and-subscribe work, but never sets state
  // synchronously before its first await — every setState here happens
  // inside a promise callback, which keeps this safe to call from an effect.
  const fetchAndSubscribe = useCallback(() => {
    cleanup();
    return createLoginRequest()
      .then((loginRequest) => {
        setState({ phase: "pending", token: loginRequest.token, expiresAt: loginRequest.expiresAt });

        const socket = io(API_BASE_URL, { transports: ["websocket"] });
        socketRef.current = socket;
        socket.emit("login-request:subscribe", loginRequest.token);
        socket.on(
          "login-request:status",
          (payload: { token: string; status: LoginRequestStatus }) => {
            void handleStatus(payload.token, payload.status);
          },
        );

        // Backup path in case the socket never connects (blocked port, proxy, etc.)
        pollRef.current = setInterval(() => {
          getLoginRequestStatus(loginRequest.token)
            .then((current) => handleStatus(current.token, current.status))
            .catch(() => {
              /* transient — the next tick or the socket will catch it */
            });
        }, POLL_FALLBACK_MS);
      })
      .catch((err: Error) => {
        setState({ phase: "error", message: err.message });
      });
  }, [cleanup, handleStatus]);

  // Exposed to the UI (the "Try again" button) — safe to setState directly
  // here since it only ever runs from a user click, never from the effect.
  const restart = useCallback(() => {
    setState({ phase: "loading" });
    void fetchAndSubscribe();
  }, [fetchAndSubscribe]);

  useEffect(() => {
    void fetchAndSubscribe();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, restart };
}
