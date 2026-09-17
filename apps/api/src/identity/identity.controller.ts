import { Controller, Get, Param } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { isPassportVerified } from '../common/passport-verification.util';
import { ndyIdTypeForUser, isOverrideOnlyNdyIdType } from '../common/ndy-id.util';
import { PrismaService } from '../prisma/prisma.service';

// Public-safe view of a Passport — never leaks email, password hash, or
// anything the owner hasn't chosen to expose. Full self-view lives behind
// auth at GET /auth/me. This is also the QR code target and the data
// source for the public /passport/:ndyId page — every Passport Card field
// here is gated by its own *IsPublic flag on User, defaulting to visible
// but always the owner's call (edited from Settings).
@Controller('passport')
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':ndyId')
  async getPublicPassport(@Param('ndyId') ndyId: string) {
    const user = await this.identity.findByNdyId(ndyId);
    const hasSocials = user.linkedinUrl || user.instagramUrl || user.xUrl;
    const hasBusiness = user.businessName || user.businessRole;

    // Founding/leadership identity badge — only present for the small,
    // manually-assigned set of NDY ID classes (CEO/EXE/PRT/INV/DEV); every
    // other user's card is unaffected. The dynamic title/subtitle live as a
    // PassportClaim (claimKey "professional_title"), not on the permanent
    // ID, per the client's "identity is permanent, role/title evolves"
    // spec — see prisma/seed-founding-team.ts.
    const ndyIdType = ndyIdTypeForUser(user);
    let foundingIdentity: { class: string; title: string | null; subtitle: string | null } | null = null;
    if (isOverrideOnlyNdyIdType(ndyIdType)) {
      const claim = await this.prisma.passportClaim.findUnique({
        where: { userId_claimKey: { userId: user.id, claimKey: 'professional_title' } },
      });
      const metadata = claim?.metadata as { title?: string; subtitle?: string } | null;
      foundingIdentity = {
        class: ndyIdType,
        title: metadata?.title ?? null,
        subtitle: metadata?.subtitle ?? null,
      };
    }

    return {
      ndyId: user.ndyId,
      fullName: user.fullName,
      foundingIdentity,
      profilePhotoUrl: user.profilePhotoUrl,
      verificationLevel: user.verificationLevel,
      // Founder/Super Admin accounts read as verified regardless of their
      // (self-serve) verificationLevel — see isPassportVerified's doc
      // comment. role itself is never exposed here; deliberately not
      // publishing NDY HUB's internal admin roles on a public profile
      // page, only the derived yes/no this card actually needs.
      isVerified: isPassportVerified(user),
      ndyappsConnected: user.ndyappsConnected,
      memberSince: user.createdAt,
      bio: user.bioIsPublic ? user.bio : null,
      country: user.countryIsPublic ? user.country : null,
      website: user.websiteIsPublic ? user.website : null,
      phone: user.phoneIsPublic ? user.phone : null,
      socials:
        user.socialsIsPublic && hasSocials
          ? {
              linkedin: user.linkedinUrl,
              instagram: user.instagramUrl,
              x: user.xUrl,
            }
          : null,
      business:
        user.businessIsPublic && hasBusiness
          ? { name: user.businessName, role: user.businessRole }
          : null,
    };
  }
}
