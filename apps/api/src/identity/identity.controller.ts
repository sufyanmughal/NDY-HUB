import { Controller, Get, Param } from '@nestjs/common';
import { IdentityService } from './identity.service';

// Public-safe view of a Passport — never leaks email, password hash, or
// anything the owner hasn't chosen to expose. Full self-view lives behind
// auth in the (not-yet-built) /me endpoint once the auth module issues
// verified sessions.
@Controller('passport')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get(':ndyId')
  async getPublicPassport(@Param('ndyId') ndyId: string) {
    const user = await this.identity.findByNdyId(ndyId);
    return {
      ndyId: user.ndyId,
      fullName: user.fullName,
      profilePhotoUrl: user.profilePhotoUrl,
      verificationLevel: user.verificationLevel,
      ndyappsConnected: user.ndyappsConnected,
      memberSince: user.createdAt,
    };
  }
}
