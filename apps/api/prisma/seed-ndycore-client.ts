/**
 * One-off registration script for NDYCORE's OAuthClient on NDYHUB — same
 * dry-run-by-default convention as seed-founding-team.ts, since this also
 * writes a real credential-bearing row to production. Registers NDYCORE
 * with exactly the one scope it needs (ecosystem:read-events) and no
 * redirect URIs beyond a placeholder, since NDYCORE never does a browser
 * OAuth redirect flow — it's a pure server-to-server client authenticating
 * with Basic auth against EcosystemEventClientGuard, same shape as any
 * other ecosystem:report-event client already using that guard.
 *
 * Usage:
 *   npx ts-node prisma/seed-ndycore-client.ts            # dry run (default)
 *   npx ts-node prisma/seed-ndycore-client.ts --apply    # actually writes
 *
 * On --apply, prints the plaintext client secret ONCE — same "shown once,
 * copy it now" contract as OAuthClientAdminController.create(). Put it
 * straight into ndycore/apps/api's NDYCORE_CLIENT_ID / NDYCORE_CLIENT_SECRET
 * env vars; it is not recoverable after this script exits.
 */
import { PrismaClient, OAuthClientType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { customAlphabet } from 'nanoid';
// Imported, not re-implemented — a copy-pasted hash function here could
// silently drift from the real one and produce a client that can never
// authenticate. See oauth-client.service.ts's own verifySecret() for the
// side that checks this.
import { hashSecret } from '../src/oauth/oauth-client.service';

const prisma = new PrismaClient();

const generateClientId = customAlphabet(
  'abcdefghijklmnopqrstuvwxyz0123456789',
  20,
);

const CLIENT_NAME = 'NDYCORE (Intelligence & Automation Engine)';
// No real browser redirect ever happens for a server-to-server client,
// but OAuthClientService.create() requires at least one redirectUri —
// a placeholder that will visibly 404 if anything ever tried to use it
// for an actual authorization-code flow, rather than pointing anywhere
// real or misleadingly production-looking.
const REDIRECT_URIS = ['https://ndycore.internal/not-used'];
const ALLOWED_SCOPES = ['ecosystem:read-events'];

async function main() {
  const apply = process.argv.includes('--apply');

  const existing = await prisma.oAuthClient.findFirst({
    where: { name: CLIENT_NAME },
  });
  if (existing) {
    console.log(
      `Client "${CLIENT_NAME}" already exists (clientId: ${existing.clientId}). Nothing to do — this script does not rotate secrets. Use the admin panel's edit/rotate flow if a new secret is needed.`,
    );
    return;
  }

  console.log(`${apply ? 'APPLYING' : 'DRY RUN — pass --apply to write'}:`);
  console.log(`  name: ${CLIENT_NAME}`);
  console.log(`  clientType: CONFIDENTIAL`);
  console.log(`  redirectUris: ${JSON.stringify(REDIRECT_URIS)}`);
  console.log(`  allowedScopes: ${JSON.stringify(ALLOWED_SCOPES)}`);

  if (!apply) return;

  const clientId = generateClientId();
  const clientSecret = randomBytes(32).toString('base64url');

  await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash: hashSecret(clientSecret),
      clientType: OAuthClientType.CONFIDENTIAL,
      name: CLIENT_NAME,
      redirectUris: REDIRECT_URIS,
      allowedScopes: ALLOWED_SCOPES,
    },
  });

  console.log('\nCreated. COPY THIS NOW — the secret is never shown again:');
  console.log(`  NDYCORE_CLIENT_ID=${clientId}`);
  console.log(`  NDYCORE_CLIENT_SECRET=${clientSecret}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
