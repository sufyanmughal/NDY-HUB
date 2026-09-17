/**
 * One-off assignment script for the NDJOYIT founding/leadership NDY IDs —
 * NOT part of the normal signup flow (see common/ndy-id.util.ts's
 * ASSIGNABLE_ONLY_VIA_OVERRIDE comment for why these classes are hand-
 * assigned rather than derived from Role). Run manually, once, against
 * whichever environment is being seeded:
 *
 *   npx ts-node prisma/seed-founding-team.ts            # dry run (default)
 *   npx ts-node prisma/seed-founding-team.ts --apply     # actually writes
 *
 * Dry-run by default on purpose: this assigns permanent, supposedly
 * never-reissued IDs (NDY-CEO-000001 etc.) to specific people, so it prints
 * exactly what it would do — matched user, new ndyId, claim upsert — before
 * anyone has to trust it to touch production data un-reviewed. Matches by
 * email (case-insensitive), not name, since name matching is fragile and
 * every account here already exists per the client's own answer ("some/all
 * already exist"). Fill in the real email for each row below before running
 * anywhere — the placeholders will fail the "no match found" check
 * deliberately rather than silently skipping.
 *
 * If a listed person does NOT have an account yet, this script does not
 * create one — user creation (password, email verification, etc.) goes
 * through the normal signup/AuthService path, not this script. Create the
 * account first, then re-run this script to assign their founding ID.
 */
import { PrismaClient, Role } from '@prisma/client';
import { formatNdyId, formatGenesisCoreId, type NdyIdType } from '../src/common/ndy-id.util';

const prisma = new PrismaClient();

interface FoundingEntry {
  email: string; // MUST be filled in with the real account email before running
  fullName: string;
  ndyIdType: NdyIdType;
  genesisNumber: number; // -> zero-padded core id, e.g. 1 -> "000001"
  title: string; // dynamic professional title — stored as a PassportClaim, not the permanent ID
  subtitle: string;
}

// --- Fill in real emails before running against any real environment. ---
const FOUNDING_TEAM: FoundingEntry[] = [
  {
    email: 'REPLACE_WITH_TEUN_EMAIL',
    fullName: 'Teun Rietdijk',
    ndyIdType: 'CEO',
    genesisNumber: 1,
    title: 'Founder • CEO • Owner',
    subtitle: 'Creator & Origin of the NDJOYIT Ecosystem',
  },
  {
    email: 'REPLACE_WITH_SUFYAN_EMAIL',
    fullName: 'Abu Sufyan',
    ndyIdType: 'FND',
    genesisNumber: 2,
    title: 'Founder • CTPO',
    subtitle: 'Core Architect of the NDJOYIT Ecosystem',
  },
  {
    email: 'REPLACE_WITH_QURBAN_EMAIL',
    fullName: 'Qurban Ali',
    ndyIdType: 'EXE',
    genesisNumber: 3,
    title: 'Founding Executive • CPDO',
    subtitle: 'Strategic Product & Business Leader of the NDJOYIT Ecosystem',
  },
  {
    email: 'REPLACE_WITH_HASSAN_EMAIL',
    fullName: 'Hassan',
    ndyIdType: 'DEV',
    genesisNumber: 4,
    title: 'Core Developer • NDY Ecosystem',
    subtitle: 'Building Connected Experiences Across the NDJOYIT Ecosystem',
  },
  {
    email: 'REPLACE_WITH_ABDUL_EMAIL',
    fullName: 'Abdul',
    ndyIdType: 'DEV',
    genesisNumber: 5,
    title: 'Lead App Developer • NDJOYIT',
    subtitle: 'Building the Core NDJOYIT App Experience',
  },
  {
    email: 'REPLACE_WITH_ABRAR_EMAIL',
    fullName: 'Abrar',
    ndyIdType: 'DEV',
    genesisNumber: 6,
    title: 'Lead Developer • NDYAPPS',
    subtitle: 'Building the Intelligent Communication Layer of the NDJOYIT Ecosystem',
  },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? 'APPLY MODE — writes will be made.' : 'DRY RUN — no writes will be made (pass --apply to write).');
  console.log('');

  for (const entry of FOUNDING_TEAM) {
    if (entry.email.startsWith('REPLACE_WITH_')) {
      console.log(`SKIP  ${entry.fullName}: placeholder email not filled in yet.`);
      continue;
    }

    const user = await prisma.user.findUnique({ where: { email: entry.email.toLowerCase() } });
    if (!user) {
      console.log(`MISS  ${entry.fullName} <${entry.email}>: no matching account found — create the account first, then re-run.`);
      continue;
    }

    const coreId = formatGenesisCoreId(entry.genesisNumber);
    const newNdyId = formatNdyId(coreId, entry.ndyIdType);

    console.log(`FOUND ${entry.fullName} <${entry.email}> — current ndyId: ${user.ndyId}, current role: ${user.role}`);
    console.log(`      -> new ndyId: ${newNdyId} (ndyIdType override: ${entry.ndyIdType}, ndyCoreId: ${coreId})`);
    console.log(`      -> title claim: "${entry.title}" / "${entry.subtitle}"`);

    if (!apply) continue;

    // Guard against ever reissuing a genesis core id to a different person
    // than it was already assigned to — the spec's "unique, non-transferable,
    // never reassigned" requirement made literal.
    const coreIdOwner = await prisma.user.findUnique({ where: { ndyCoreId: coreId } });
    if (coreIdOwner && coreIdOwner.id !== user.id) {
      console.log(`      !! ABORTED for this row: ndyCoreId ${coreId} is already assigned to a different user (${coreIdOwner.email}). Not overwriting.`);
      continue;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          ndyCoreId: coreId,
          ndyIdType: entry.ndyIdType,
          ndyId: newNdyId,
          fullName: user.fullName ?? entry.fullName,
        },
      }),
      prisma.passportClaim.upsert({
        where: { userId_claimKey: { userId: user.id, claimKey: 'professional_title' } },
        create: {
          userId: user.id,
          claimKey: 'professional_title',
          provenance: 'NDY_VERIFIED',
          verifiedAt: new Date(),
          metadata: { title: entry.title, subtitle: entry.subtitle },
        },
        update: {
          provenance: 'NDY_VERIFIED',
          verifiedAt: new Date(),
          metadata: { title: entry.title, subtitle: entry.subtitle },
        },
      }),
    ]);
    console.log(`      DONE.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
