"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { QrLoginCard } from "@/components/qr-login-card";
import { PasswordAuthForm } from "@/components/password-auth-form";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth-context";
import { EcosystemSplash, useShouldShowSplash } from "@/components/ecosystem-splash";
import "@/styles/homepage.css";
import "@/styles/login.css";

/** `next` comes straight off the query string of a page anyone can link to
 * (including the OAuth consent flow) — treat it as untrusted. Only an
 * in-app relative path is let through; anything shaped like it could send
 * the browser off-site (a scheme, a protocol-relative `//host`) falls back
 * to the dashboard root instead. Same "never redirect on unvalidated input"
 * rule the /oauth/authorize endpoint follows. */
function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

const FEATURES: { color: string; title: string; sub: string; icon: React.ReactNode }[] = [
  {
    color: "#4f7cff",
    title: "One Identity",
    sub: "A permanent NDY ID, yours across the whole ecosystem.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20c1.3-4 3.6-6 6.5-6s5.2 2 6.5 6" />
      </svg>
    ),
  },
  {
    color: "#8b5cf6",
    title: "Passkeys & 2FA",
    sub: "Sign in without a password, or lock it down with two factors.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 2.5 19 5.5v5.5c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V5.5Z" />
        <path d="m9 11.5 2 2 4-4.2" />
      </svg>
    ),
  },
  {
    color: "#22d3ee",
    title: "QR Login via NDYAPPS",
    sub: "Scan a code with your phone, no typing required.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
        <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
        <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
        <path d="M14.5 14.5h3v3h-3zM20.5 14.5v6M14.5 20.5h6" />
      </svg>
    ),
  },
];

function LoginPageInner() {
  const { auth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const [showSplash, dismissSplash] = useShouldShowSplash();

  useEffect(() => {
    if (auth.status === "authenticated") router.replace(next);
  }, [auth.status, router, next]);

  if (auth.status !== "unauthenticated") {
    return null;
  }

  // Plays once per browser session, right when a visitor first lands on
  // /login — replaced by the real sign-in form below once it finishes (or
  // immediately on any later visit within the same session).
  if (showSplash) {
    return <EcosystemSplash onDone={dismissSplash} />;
  }

  return (
    <div className="ndy-homepage">
      <div className="login-shell">
        {/* ---------- left: brand / hero panel ---------- */}
        <div className="login-hero">
          <div className="hp-earth" />
          <div className="hp-stars" />
          <div className="login-hero-brand">
            <Logo size={36} />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1>
              One Identity.
              <br />
              One Passport.
              <br />
              <span className="hp-grad">One Ecosystem.</span>
            </h1>
            <p className="login-hero-lead">
              NDY HUB is the central identity layer for everything NDJOYIT
              builds — sign in once, carry your Passport everywhere.
            </p>
          </motion.div>
          <div className="login-hero-features">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                className="login-hero-feature"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              >
                <span
                  className="login-hero-feature-icon"
                  style={{ "--card-c": f.color } as React.CSSProperties}
                >
                  {f.icon}
                </span>
                <span>
                  <strong>{f.title}</strong>
                  <span>{f.sub}</span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ---------- right: auth panel ---------- */}
        <div className="login-form-panel">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}
          >
            <QrLoginCard redirectTo={next} />

            <div className="login-divider">or</div>

            <PasswordAuthForm />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
