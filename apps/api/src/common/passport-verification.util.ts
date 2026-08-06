import { Role, VerificationLevel } from '@prisma/client';

/**
 * Whether the Passport card's verified badge/pill should show. Normal
 * users only earn this by actually completing verification (anything
 * past LEVEL_0). FOUNDER and SUPER_ADMIN are treated as verified
 * unconditionally — those roles are only ever assigned by an existing
 * Founder/Super Admin (see RoleChangeRequest's dual-approval flow), which
 * is a stronger trust signal than the self-serve email/phone/ID checks
 * VerificationLevel tracks, so gating their badge on the same ladder
 * every new signup starts at made no sense.
 *
 * Shared (not duplicated) between auth.service.ts (getMe/updateProfile,
 * self-view) and identity.controller.ts (getPublicPassport, the public
 * /passport/:ndyId view) so the two can't silently drift on what
 * "verified" means for a Passport card.
 */
export function isPassportVerified(user: {
  verificationLevel: VerificationLevel;
  role: Role;
}): boolean {
  if (user.role === 'FOUNDER' || user.role === 'SUPER_ADMIN') return true;
  return user.verificationLevel !== 'LEVEL_0';
}
