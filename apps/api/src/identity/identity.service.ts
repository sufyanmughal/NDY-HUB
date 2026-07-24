import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateNdyId } from '../common/ndy-id.util';

const MAX_NDY_ID_ATTEMPTS = 5;

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a user with a freshly generated, guaranteed-unique NDY ID.
   * Collisions are astronomically rare at this alphabet/length, but we still
   * retry on the unique-constraint error rather than trusting probability.
   */
  async createUser(params: { email: string; passwordHash?: string; fullName?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: params.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    for (let attempt = 0; attempt < MAX_NDY_ID_ATTEMPTS; attempt++) {
      const ndyId = generateNdyId();
      try {
        return await this.prisma.user.create({
          data: {
            ndyId,
            email: params.email,
            passwordHash: params.passwordHash,
            fullName: params.fullName,
          },
        });
      } catch (err: unknown) {
        if (isUniqueConstraintError(err, 'ndyId') && attempt < MAX_NDY_ID_ATTEMPTS - 1) {
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException('Could not allocate a unique NDY ID, please retry.');
  }

  async findByNdyId(ndyId: string) {
    const user = await this.prisma.user.findUnique({ where: { ndyId } });
    if (!user) throw new NotFoundException('No account with that NDY ID.');
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
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
