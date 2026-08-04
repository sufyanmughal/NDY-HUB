import { Controller, Get, Param } from '@nestjs/common';
import { IdentityService } from './identity.service';

// Public-safe view of a Passport — never leaks email, password hash, or
// anything the owner hasn't chosen to expose. Full self-view lives behind
// auth at GET /auth/me. This is also the QR code target and the data
// source for the public /passport/:ndyId page — every Passport Card field
// here is gated by its own *IsPublic flag on User, defaulting to visible
// but always the owner's call (edited from Settings).
@Controller('passport')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get(':ndyId')
  async getPublicPassport(@Param('ndyId') ndyId: string) {
    const user = await this.identity.findByNdyId(ndyId);
    const hasSocials = user.linkedinUrl || user.instagramUrl || user.xUrl;
    const hasBusiness = user.businessName || user.businessRole;
    return {
      ndyId: user.ndyId,
      fullName: user.fullName,
      profilePhotoUrl: user.profilePhotoUrl,
      verificationLevel: user.verificationLevel,
      ndyappsConnected: user.ndyappsConnected,
      memberSince: user.createdAt,
      bio: user.bioIsPublic ? user.bio : null,
      country: user.countryIsPublic ? user.country : null,
      website: user.websiteIsPublic ? user.website : null,
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
