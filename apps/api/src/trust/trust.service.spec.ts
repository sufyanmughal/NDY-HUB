import { TrustTier, VerificationLevel } from '@prisma/client';
import { SCORE_WEIGHTS, TrustService } from './trust.service';
import { PrismaService } from '../prisma/prisma.service';

const OLD_ACCOUNT = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000); // > 90 days
const NEW_ACCOUNT = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

function makePrisma() {
  return {
    user: { findUniqueOrThrow: jest.fn() },
    passportClaim: { findFirst: jest.fn().mockResolvedValue(null) },
    businessWorkspaceRequest: { findFirst: jest.fn().mockResolvedValue(null) },
    securityEvent: { count: jest.fn().mockResolvedValue(0) },
    trustProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn((args: { create: unknown }) => args.create),
    },
  };
}

function makeService() {
  const prisma = makePrisma();
  const service = new TrustService(prisma as unknown as PrismaService);
  return { prisma, service };
}

/** Convenience: stub the user row then recompute. */
async function recomputeWith(
  prisma: ReturnType<typeof makePrisma>,
  service: TrustService,
  verificationLevel: VerificationLevel,
  createdAt = OLD_ACCOUNT,
) {
  prisma.user.findUniqueOrThrow.mockResolvedValue({
    verificationLevel,
    createdAt,
  });
  return service.recompute('user-1');
}

describe('TrustService', () => {
  describe('getTrustProfile', () => {
    it('reports UNVERIFIED / 0 when no row exists yet', async () => {
      const { service } = makeService();
      const result = await service.getTrustProfile('user-1');
      expect(result.tier).toBe(TrustTier.UNVERIFIED);
      expect(result.score).toBe(0);
    });
  });

  describe('score formula', () => {
    it('LEVEL_1 = email only (10)', async () => {
      const { prisma, service } = makeService();
      const result = await recomputeWith(
        prisma,
        service,
        VerificationLevel.LEVEL_1,
      );
      expect(result.tier).toBe(TrustTier.UNVERIFIED);
      // 10 + 10 (old account, no flags)
      expect(result.score).toBe(
        SCORE_WEIGHTS.emailVerified + SCORE_WEIGHTS.longStandingCleanAccount,
      );
    });

    it('LEVEL_2 = email + phone (35)', async () => {
      const { prisma, service } = makeService();
      const result = await recomputeWith(
        prisma,
        service,
        VerificationLevel.LEVEL_2,
      );
      expect(result.tier).toBe(TrustTier.BASIC);
      expect(result.score).toBe(
        SCORE_WEIGHTS.emailVerified +
          SCORE_WEIGHTS.phoneVerified +
          SCORE_WEIGHTS.longStandingCleanAccount,
      );
    });

    it('LEVEL_3 without an extra claim = VERIFIED (75 + long-standing 10)', async () => {
      const { prisma, service } = makeService();
      const result = await recomputeWith(
        prisma,
        service,
        VerificationLevel.LEVEL_3,
      );
      expect(result.tier).toBe(TrustTier.VERIFIED);
      // 10 + 25 + 40 = 75, plus the old-and-clean bonus.
      expect(result.score).toBe(
        75 + SCORE_WEIGHTS.longStandingCleanAccount,
      );
    });

    it('adds business (+15) and caps at 100', async () => {
      const { prisma, service } = makeService();
      prisma.businessWorkspaceRequest.findFirst.mockResolvedValue({ id: 'b1' });
      const result = await recomputeWith(
        prisma,
        service,
        VerificationLevel.LEVEL_3,
      );
      // 75 + 15 + 10 = 100 exactly (cap)
      expect(result.score).toBe(SCORE_WEIGHTS.cap);
    });

    it('does not grant the long-standing bonus to a young account', async () => {
      const { prisma, service } = makeService();
      const result = await recomputeWith(
        prisma,
        service,
        VerificationLevel.LEVEL_3,
        NEW_ACCOUNT,
      );
      expect(result.score).toBe(75); // no +10
    });

    it('withholds the long-standing bonus when a real security flag exists', async () => {
      const { prisma, service } = makeService();
      prisma.securityEvent.count.mockResolvedValue(1);
      const result = await recomputeWith(
        prisma,
        service,
        VerificationLevel.LEVEL_3,
      );
      expect(result.score).toBe(75); // 75, no +10
      // …and the count is scoped to flag types, not every event.
      expect(prisma.securityEvent.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: { in: ['OAUTH_TOKEN_REUSE_DETECTED'] },
        },
      });
    });

    it('reaches TRUSTED tier with a non-self-asserted business claim', async () => {
      const { prisma, service } = makeService();
      prisma.passportClaim.findFirst.mockResolvedValue({ id: 'c1' });
      const result = await recomputeWith(
        prisma,
        service,
        VerificationLevel.LEVEL_3,
      );
      expect(result.tier).toBe(TrustTier.TRUSTED);
    });
  });
});
