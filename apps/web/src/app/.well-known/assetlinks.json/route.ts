import { NextResponse } from "next/server";

// Required for NDJOYIT's passkey (WebAuthn) flow on Android — same
// relying-party story as the sibling apple-app-site-association route.
// sha256_cert_fingerprints is a PLACEHOLDER (empty) until Abdul sends the
// real debug + Play Store/App Signing SHA-256 fingerprint(s) for
// com.ndjoyit.app.v3 — an empty list fails closed (Android won't verify
// the association) rather than shipping a fingerprint we haven't actually
// confirmed, matching this codebase's "don't build ahead of a real value"
// discipline elsewhere (see scopes.ts's own comment).
const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.get_login_creds"],
    target: {
      namespace: "android_app",
      package_name: "com.ndjoyit.app.v3",
      sha256_cert_fingerprints: [] as string[],
    },
  },
];

export function GET() {
  return NextResponse.json(ASSET_LINKS);
}
