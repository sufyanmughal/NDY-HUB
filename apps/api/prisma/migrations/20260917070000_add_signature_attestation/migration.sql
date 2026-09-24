-- NDY Signature — cryptographic attestation.
--
-- Additive: two nullable columns holding a compact JWS (RS256) over the
-- signature's own claims, signed with NDY HUB's existing OIDC keypair so a third
-- party can verify it against the already-published /.well-known/jwks.json.
-- See SignatureService.attest() and the schema comment on Signature.

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN "attestation" TEXT;

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN "attestationKeyId" TEXT;
