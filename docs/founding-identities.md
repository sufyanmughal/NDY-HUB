# Founding/Leadership NDY IDs

**Status: schema + code shipped, no data assigned yet.** This documents the
client's "NDY ID — Identity & Leadership Structure" spec and exactly how it
was mapped onto the existing identity system.

## What changed

- `NdyIdType` (`apps/api/src/common/ndy-id.util.ts`) grew from `FND | BIZ |
  MBR` to `CEO | FND | EXE | PRT | INV | DEV | BIZ | MBR`.
- `User.ndyIdType` (new, nullable `String` column) is an explicit override.
  `null` (every existing user, and every future ordinary signup) means "keep
  deriving the type from Role," exactly as before. Only the six named
  founding/leadership people get this column set.
- `ndyIdTypeForUser(user)` is the new call site to use instead of
  `ndyIdTypeForRole(role)` wherever the displayed type matters — it checks
  the override first, falls back to the role-derived default otherwise.
  `ndyIdTypeForRole` still exists and is still what computes that fallback.
- `formatGenesisCoreId(n)` formats a sequential "genesis number" (1 ->
  `"000001"`) for the six founding people's `ndyCoreId`. Ordinary member
  signup is **unchanged** — still `generateCoreId()`'s random 6-character
  code, kept deliberately non-sequential/non-enumerable. Making *all*
  signups sequential was explicitly deferred (see the open decision at the
  end of this doc) — this only affects the small, hand-curated leadership
  set.
- The dynamic professional title/subtitle (e.g. "Founder • CTPO" / "Core
  Architect of the NDJOYIT Ecosystem") is **not** part of the permanent ID.
  It's stored as a `PassportClaim` row (`claimKey: "professional_title"`,
  `provenance: NDY_VERIFIED`, `metadata: { title, subtitle }`) — reusing
  Phase 7's claims table rather than adding a new one, and matching the
  spec's own core principle: *identity is permanent, role/title evolves*.
- The public `GET /passport/:ndyId` response gained a `foundingIdentity`
  field (`{ class, title, subtitle } | null`), populated only when the
  user's resolved `ndyIdType` is one of the override-only classes
  (CEO/EXE/PRT/INV/DEV). The Passport card's vertical design
  (`vertical-card.tsx`) renders it: the title/subtitle replace the generic
  business-role line, and the footer badge shows "Genesis Identity /
  NDY-\<CLASS\>" instead of "Verified Member / \<tier\>".
- `role-change-request.service.ts`'s approval step was fixed to recompute
  `ndyId` via `ndyIdTypeForUser` (not the raw role-only helper) — otherwise
  approving *any* future role change for one of these six people would have
  silently overwritten their permanent ID class back to a role-derived
  FND/MBR value, which is exactly the bug this whole spec exists to prevent.

## What did NOT change

- `Role` enum is untouched. ID *class* (permanent) and `Role` (drives
  permissions, evolves) stay separate axes, per the spec's own framing —
  no `Role.CEO`/`Role.EXECUTIVE`/etc. were added, since inventing
  permission sets for those wasn't asked for and isn't specified anywhere.
  The six people keep whatever `Role` already fits their actual system
  access (e.g. `FOUNDER` for full access); their **ndyIdType override**
  is what carries CEO/FND/EXE/DEV instead.
- No new Prisma model. The claim reuses `PassportClaim`; the ID class reuses
  `User.ndyId`/`ndyCoreId` plus one new override column.

## Migration

`prisma/migrations/20260826000000_add_ndy_id_type_override/migration.sql`
— purely additive (`ALTER TABLE "User" ADD COLUMN "ndyIdType" TEXT`), no
backfill, safe to run without downtime.

## Assigning the six people

`apps/api/prisma/seed-founding-team.ts` — a one-off, manually-run script,
**not** part of the normal migration/deploy path (see its own header
comment). It:

1. Matches each of the six by email (placeholders currently — must be
   filled in with real account emails before running anywhere).
2. Dry-runs by default; only writes with `--apply`.
3. Refuses to reassign a genesis core id (e.g. `000001`) that's already
   attached to a different user — the spec's "unique, non-transferable,
   never reassigned" requirement enforced in code, not just by convention.
4. Sets `ndyCoreId`, `ndyIdType`, rebuilds `ndyId`, and upserts the
   `professional_title` claim, all in one transaction per person.

**Not yet done — needs your input before this can actually run**: the real
account emails for Teun, Sufyan, Qurban, Hassan, Abdul, and Abrar. Fill
those into the script (or tell me and I'll fill them in), then it can be
run once against production (dry-run first, review the printed output,
then `--apply`).

## Open decisions not resolved by this pass

1. **Executive/professional-role titles beyond the founding six** (CFO,
   CTO, VP, Director, etc. from the spec's §4) — the `professional_title`
   claim mechanism supports any title string already; no additional schema
   work is needed to assign one to a 7th, 8th, etc. person later. Just add
   them to the seed script (or build a small admin UI for it, not built
   yet).
2. **Partners/Investors (PRT/INV) as a real, self-service or admin-driven
   flow** — today these are only assignable the same manual way as
   CEO/FND/EXE/DEV. If partners/investors need to be onboarded regularly
   rather than as one-off entries, that's a small future admin-tool phase,
   not a schema change.
3. **Whether ordinary member IDs should ever become sequential** (the
   spec's own `NDY-MBR-001245` example implies yes) — deliberately not
   done in this pass; flagged in the code's comments as a bigger, separate
   decision (loses the anti-enumeration property of random IDs, needs a
   concurrency-safe counter). Confirm before touching the live signup path.
