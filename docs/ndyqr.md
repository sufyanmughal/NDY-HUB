# NDYQR™ — Central Dynamic QR Service

**Status: live in production**, verified 2026-09-16 — `nest build` clean, web
`tsc` clean, 56/56 API unit tests pass, migration `20260917000000_add_ndyqr`
applied, clean production boot (`Nest application successfully started`, every
`/ndyqr` and `/q/:slug` route mapped, zero DI errors), and `GET /ndyqr/brand`
confirmed live against `api.ndyhub.com` (correctly returns 401 without a
bearer token — the whole controller is `JwtAuthGuard`-protected by design).

One code. Endless connections. NDYQR™ is the NDJOYIT ecosystem's single QR
capability: a code is created once, its destination stays editable forever, and
every scan is tracked — so a printed or displayed QR never has to be replaced,
and no product has to build its own QR system.

---

## 0. The client's brief, restated

Teun's messages (2026-09-16) asked for:

1. A **central, dynamic** QR service (not a basic generator): create once,
   change the destination later without reissuing the code, track scans, and let
   every NDY product call it rather than building their own.
2. A **consistent NDY visual identity** on every QR: the pink→purple→blue
   gradient, rounded modules, the official ND logo permanently centered (with
   the center *reserved*, not pasted over), high error correction, PNG + SVG
   export, and **automatic readability validation before a code is published**.

The chain: `NDY ID → NDYQR → Dynamic Destination → Analytics → NDYINSIGHTS`.

---

## 1. What already existed (and why this is a new domain, not an extension)

NDY HUB had two QR usages, neither a reusable service:

- **QR / deep-link login** (`apps/web/src/components/qr-login-card.tsx`,
  `apps/api/src/auth/login-request.gateway.ts`) — a short-lived, single-use,
  session-bound code. Security-sensitive and single-purpose; untouched here.
- **Passport QR** — the Passport page/PDF render a plain `qrcode` image of the
  public `/passport/:ndyId` URL, with a center badge drawn over it.

Neither offers a retargetable destination, scan analytics, central branding, or
a reusable API. NDYQR is a genuinely different object, so it's its own domain
rather than an overload of the login QR. (The Passport QR can migrate onto
NDYQR as its first real consumer later — additive, not required now.)

---

## 2. Files

```
apps/api/prisma/schema.prisma                         NdyQrType, NdyQrCode, NdyQrScan
apps/api/prisma/migrations/20260917000000_add_ndyqr/  additive migration
apps/api/src/ndyqr/ndyqr.module.ts
apps/api/src/ndyqr/ndyqr.controller.ts                authenticated management
apps/api/src/ndyqr/ndyqr-redirect.controller.ts       public /q/:slug
apps/api/src/ndyqr/ndyqr.service.ts                   storage + resolution + analytics
apps/api/src/ndyqr/dto/ndyqr.dto.ts                   Create/Update DTOs
apps/api/src/common/permissions.ts                    + MANAGE_QR_CODES
apps/api/src/app.module.ts                            registers NdyqrModule

apps/web/src/lib/ndyqr-render.ts                      the branded renderer + validation
apps/web/src/app/(dashboard)/qr-codes/page.tsx        dashboard UI
apps/web/src/lib/api.ts                               typed client
apps/web/src/lib/nav-items.ts, permissions.ts         nav + permission mirror
```

---

## 3. Data model

- **`NdyQrCode`** — `slug` (unique, short, what the image encodes), `ownerId`,
  `label`, `type`, `destination` (**mutable**), `campaign`, `isActive`,
  `expiresAt`, brand fields (`brandStyle` default `"ndy-gradient"`, plus optional
  `colorFrom`/`colorTo`/`logoUrl`).
- **`NdyQrScan`** — append-only, one row per resolved scan: `scannedAt`, `ip`,
  `userAgent`, `referer`, `location` (best-effort geo), `deviceType`.

`slug` is separate from `id`: 8 chars from an alphabet with no ambiguous
characters (`0/O`, `1/l/I`), the same discipline as NDY ID generation. Changing
`destination` via `PATCH` never changes the slug, so a code printed on a menu,
badge, or sign keeps working forever.

`NdyQrType` lists every product Teun named (`NDYSTAYS`, `NDYCONNECT`, `NDYQUIZ`,
`NDYVIXIT`, `NDYXTRA`, `NDYPAY`) plus `LINK`, `PASSPORT`, `LOGIN` — a tag for
filtering/reporting; every type resolves through the same redirect and renders
through the same branded renderer.

Migration is **additive only** (one enum, two tables); no existing table is
touched.

---

## 4. API surface

Owner-scoped, `JwtAuthGuard` (`/ndyqr`):

```
POST   /ndyqr                 create
GET    /ndyqr                 list mine (with scan counts)
GET    /ndyqr/brand           NDY default gradient/style for the renderer
GET    /ndyqr/:id             get one owned code
GET    /ndyqr/:id/analytics   lifetime total, 30-day series, device split, top locations
PATCH  /ndyqr/:id             edit destination/label/type/campaign/active/expiry/branding
DELETE /ndyqr/:id             remove
```

Ownership is enforced in the service (`getOwned`): someone else's id → plain
404, the same pattern as every other owned resource here.

Central admin view (`PermissionGuard` + `Permission.MANAGE_QR_CODES`):

```
GET /ndyqr/admin/all   every code in the ecosystem, not just the caller's
```

Public half — what a scanner's phone hits, unauthenticated by design:

```
GET /q/:slug   302 → current destination, or a plain-text 404
```

Throttled 300 req/min (public + write-touching). The scan write is
fire-and-forget and fail-soft: a slow/failed analytics write never delays or
breaks the redirect.

---

## 5. Analytics → the NDYINSIGHTS path

`GET /ndyqr/:id/analytics` returns lifetime total, a 30-day daily series, device
split, and top locations — aggregated in JS over the bounded 30-day window
(same "simple until volume justifies otherwise" choice used elsewhere here).
This is the concrete `Analytics → NDYINSIGHTS` link today: NDYQR owns and serves
its own scan data; a future cross-product NDYINSIGHTS layer consumes it the same
way any product consumes `ecosystem:report-event` — additive, not a rebuild.

---

## 6. Brand rendering — making every NDY QR recognizable

Rendering is a single shared module (`apps/web/src/lib/ndyqr-render.ts`) using
the `qrcode` package already in the repo. The standard is the **default**, so
codes look consistent without each product opting in:

- **Level-H error correction** (~30% recoverable) — the correct choice for a
  logo-in-center design.
- **A genuinely reserved center zone** — the renderer computes which modules
  fall inside the center square *before* drawing and skips them (`inCenter()`),
  sized by `logoRatio` (default 24% of width) to stay well inside the
  error-correction budget. The logo is **not** pasted over a finished code.
- **Rounded modules and rounded finder patterns** — same rounded-rect language
  throughout.
- **Diagonal magenta → violet → sky gradient** (`#e600f0` → `#a855f7` →
  `#38bdf8`), matching the Passport card. Callers may override the two end stops
  per-code; shape/logo/quiet-zone/error-correction stay fixed.
- **PNG (canvas) and SVG** — the SVG draws modules/finders as vector rects and
  the center mark as vector text, so it stays self-contained and print-crisp.
- **Drawn "ND" monogram fallback** if no logo loads — never an empty center.
- **Automatic readability validation** (`validateNdyQrPng`): after rendering,
  the PNG is decoded back through a real QR reader (`jsqr`) and must decode to
  exactly the expected URL. The UI refuses to download/publish a code that fails
  — catching the one failure mode that would most undermine the brand (a
  beautiful QR that doesn't scan).

---

## 7. Using NDYQR™ from another product

Today the web dashboard (`/qr-codes`) is the management UI and the renderer is a
shared web module. The intended cross-product path:

1. `POST /ndyqr` (as the member, or later a service/OAuth-client credential).
2. Render with the shared brand renderer against the returned slug, or link to
   the code's PNG/SVG.
3. `GET /ndyqr/:id/analytics` for insight.

**Built:** the server-rendered image endpoints — `GET /q/:slug/image.svg` and
`GET /q/:slug/image.png` — so non-JS clients (mobile, print pipelines) get a
branded, pre-validated code with no web renderer involved. See §7a.

**Still deferred:** scoped service credentials (`ndyqr:create`) letting another
product's *backend* create codes with no logged-in user. See §7b for the
modelling gap that has to be decided first.

## 7a. Server-rendered images (built)

`apps/api/src/ndyqr/ndyqr-render.service.ts` is the Node port of the web
renderer. There is no `canvas` in Node, so the SVG is the source of truth and
PNG is produced by rasterising it with `sharp` — one implementation of the brand
decisions, no second drawing path.

Both endpoints render **and validate server-side** before responding: the PNG is
decoded back with a real QR reader (`jsqr`) and must decode to exactly the
encoded URL; otherwise the request is a 500 rather than a silently-broken
download. Fetching an image deliberately does **not** record a scan — it isn't
someone scanning the code, and counting it would corrupt the analytics.

**Important finding (caught by the decode test, and it changed the brand
values):** the original gradient (`#e600f0 → #a855f7 → #38bdf8`) and the inset
"dot" module style **do not scan**. The light sky stop has too little luminance
contrast against white to binarize, and gaps between modules break the grid a
decoder relies on. The QR palette is now the same magenta → violet → blue hues
at print-safe depth (`#c026d3 → #7c3aed → #1d4ed8`) with modules drawn
edge-to-edge and only the corners rounded. The web renderer was corrected to
match. This is exactly the failure mode the "automatic readability validation"
requirement exists to catch.

## 7b. Service credentials — blocked on a small modelling decision

The intent is a `ndyqr:create` scope (same server-to-server shape as
`ndybits:report-event`) so another product's backend can create codes without a
user session. One thing has to be decided first: **`NdyQrCode.ownerId` is a
required FK to `User`**, so a code created by a *service* has no owner to point
at. Options: make `ownerId` nullable and add an optional `oauthClientId` owner
(exactly one of the two set), or keep service-created codes out of scope and
require a user context. Not guessed here — it's a schema decision on a live
table.

---

## 8. Deploy checklist

1. Apply the migration: `docker exec ndy-hub-api npx prisma migrate deploy`
   (or `npm run --workspace apps/api exec -- prisma migrate deploy`), which
   picks up `20260917000000_add_ndyqr`.
2. Deploy `apps/api` and `apps/web` as usual (the web now depends on `jsqr`).
3. Verify: `GET /ndyqr/brand` returns the default gradient (module booted and
   routed), then a real create → scan → analytics round trip on a throwaway
   code before handing NDYQR to other products.

### Nicer-but-not-required follow-ups

- Reserve a short domain (e.g. `q.ndyhub.com`) for cleaner printed codes — today
  codes resolve on the API host.
- Campaign rollup analytics (the `campaign` field exists and is filterable; no
  dedicated dashboard endpoint yet).
- A cross-product client contract doc (the equivalent of
  `NDYAPPS-INTEGRATION.md`) once a second product actually integrates.
