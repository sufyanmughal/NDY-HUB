import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateCoreId,
  formatNdyId,
  ndyIdTypeForRole,
  parseNdyId,
} from '../common/ndy-id.util';
import { Role } from '@prisma/client';

const MAX_NDY_ID_ATTEMPTS = 5;

// Shared with updateProfile below — the same passport fields can be sent
// either up front at registration (password signup form) or edited later
// via Settings/passport-complete. Kept as one type so the two call sites
// can't silently drift apart.
export type PassportProfileFields = {
  bio?: string;
  country?: string;
  website?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  xUrl?: string;
  businessName?: string;
  businessRole?: string;
  phone?: string;
  bioIsPublic?: boolean;
  countryIsPublic?: boolean;
  websiteIsPublic?: boolean;
  socialsIsPublic?: boolean;
  businessIsPublic?: boolean;
  phoneIsPublic?: boolean;
};

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a user with a freshly generated, guaranteed-unique NDY ID.
   * Collisions are astronomically rare at this alphabet/length, but we still
   * retry on the unique-constraint error rather than trusting probability.
   */
  async createUser(
    params: {
      email: string;
      passwordHash?: string;
      fullName?: string;
    } & PassportProfileFields,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: params.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    for (let attempt = 0; attempt < MAX_NDY_ID_ATTEMPTS; attempt++) {
      const coreId = generateCoreId();
      // New signups always start as USER (MBR) — nothing creates a
      // FOUNDER/BIZ account at signup time, so the type is fixed here
      // rather than accepted as a caller-supplied param.
      const ndyId = formatNdyId(coreId, ndyIdTypeForRole(Role.USER));
      try {
        return await this.prisma.user.create({
          data: {
            ndyCoreId: coreId,
            ndyId,
            email: params.email,
            passwordHash: params.passwordHash,
            fullName: params.fullName,
            bio: params.bio,
            country: params.country,
            website: params.website,
            linkedinUrl: params.linkedinUrl,
            instagramUrl: params.instagramUrl,
            xUrl: params.xUrl,
            businessName: params.businessName,
            businessRole: params.businessRole,
            phone: params.phone,
            bioIsPublic: params.bioIsPublic,
            countryIsPublic: params.countryIsPublic,
            websiteIsPublic: params.websiteIsPublic,
            socialsIsPublic: params.socialsIsPublic,
            businessIsPublic: params.businessIsPublic,
            phoneIsPublic: params.phoneIsPublic,
          },
        });
      } catch (err: unknown) {
        if (
          (isUniqueConstraintError(err, 'ndyCoreId') ||
            isUniqueConstraintError(err, 'ndyId')) &&
          attempt < MAX_NDY_ID_ATTEMPTS - 1
        ) {
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException(
      'Could not allocate a unique NDY ID, please retry.',
    );
  }

  /**
   * Looks up a user by NDY ID. Tries an exact match first (the common
   * case), then falls back to the permanent ndyCoreId if that fails — a
   * link shared before a role change (e.g. Member -> Business) still
   * resolves after the Type segment updates, since the Core ID inside it
   * never changes. See common/ndy-id.util.ts's parseNdyId.
   */
  async findByNdyId(ndyId: string) {
    let user = await this.prisma.user.findUnique({ where: { ndyId } });
    if (!user) {
      const parsed = parseNdyId(ndyId);
      if (parsed) {
        user = await this.prisma.user.findUnique({
          where: { ndyCoreId: parsed.coreId },
        });
      }
    }
    if (!user) throw new NotFoundException('No account with that NDY ID.');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('No account with that id.');
    return user;
  }

  async updateProfile(
    userId: string,
    updates: {
      fullName?: string;
      profilePhotoUrl?: string;
    } & PassportProfileFields,
  ) {
    return this.prisma.user.update({ where: { id: userId }, data: updates });
  }
}

function isUniqueConstraintError(err: unknown, field: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002' &&
    'meta' in err &&
    Array.isArray((err as { meta?: { target?: string[] } }).meta?.target) &&
    (err as { meta: { target: string[] } }).meta.target.includes(field)
  );
}
