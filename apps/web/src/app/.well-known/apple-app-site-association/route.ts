import { NextResponse } from "next/server";

// Required for NDJOYIT's passkey (WebAuthn) flow on iOS — Apple refuses the
// authentication ceremony unless the relying-party domain (ndyhub.com, see
// apps/api/src/auth/passkey.service.ts's RELYING_PARTIES) serves this file
// listing the app ID under a webcredentials key. No extension on this path
// is deliberate — Apple's own spec requires exactly this, which is why this
// is a route handler (full control over Content-Type) rather than a static
// file in public/, where some static servers mishandle an extensionless
// path. Served as a route rather than a static file so bare JSON is always
// returned verbatim, same reasoning as resolveVerificationLink's own
// explicit-allow-list pattern — add an app ID here only once it's real and
// confirmed, never speculatively.
const AASA = {
  webcredentials: {
    apps: ["WWDG3DBZPR.com.ndjoyit.app.v3"],
  },
};

export function GET() {
  return NextResponse.json(AASA);
}
