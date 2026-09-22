import { TrustTier, VerificationLevel } from '@prisma/client';
import { SCORE, TrustService } from './trust.service';
import { PrismaService } from '../prisma/prisma.service';

const OLD_ACCOUNT = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000); // > 90 days
const NEW_ACCOUNT = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

/**
 * Security-event counts are keyed by type, and the reuse count is split by
 * whether a time window was applied — that split is what lets the decay tests
 * distinguish "a flag happened recently" from "a flag happened ever".
 */
function makePrisma() {
  const security = {
    reuseInWindow: 0,
    reuseEver: 0,
    deviceRevokedInWindow: 0,
    logins: 0,
    loginOldEnough: false,
  };

  const prisma = {
    user: { findUniqueOrThrow: jest.fn() },
    passkey: { count: jest.fn().mockResolvedValue(0) },
    totpBackupCode: { count: jest.fn().mockResolvedValue(0) },
    device: { count: jest.fn().mockResolvedValue(0) },
    deviceApprovalRequest: { count: jest.fn().mockResolvedValue(0) },
    passportClaim: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    securityEvent: {
      count: jest.fn(
        (args: { where: { type: string; createdAt?: unknown } }) => {
          const { type, createdAt } = args.where;
          if (type === 'OAUTH_TOKEN_REUSE_DETECTED') {
            return Promise.resolve(
              createdAt ? security.reuseInWindow : security.reuseEver,
            );
          }
          if (type === 'DEVICE_REVOKED')
            return Promise.resolve(security.deviceRevokedInWindow);
          if (type === 'LOGIN_SUCCESS') return Promise.resolve(security.logins);
          return Promise.resolve(0);
        },
      ),
      findFirst: jest.fn(() =>
        Promise.resolve(security.loginOldEnough ? { id: 'login-old' } : null),
      ),
    },
    trustProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn((args: { create: unknown }) => args.create),
    },
  };

  return { prisma, security };
}

function makeService() {
  const { prisma, security } = makePrisma();
  const service = new TrustService(prisma as unknown as PrismaService);
  return { prisma, security, service };
}

function stubUser(
  prisma: ReturnType<typeof makePrisma>['prisma'],
  overrides: Partial<{
    verificationLevel: VerificationLevel;
    createdAt: Date;
    suspended: boolean;
    totpEnabledAt: Date | null;
    smsPhoneE164: string | null;
  }> = {},
) {
  prisma.user.findUniqueOrThrow.mockResolvedValue({
    verificationLevel: VerificationLevel.LEVEL_0,
    createdAt: NEW_ACCOUNT,
    suspended: false,
    totpEnabledAt: null,
    smsPhoneE164: null,
    ...overrides,
  });
}

describe('TrustService — locked v1 model', () => {
  describe('neutral baseline', () => {
    it('reports the neutral baseline (not zero) when no profile row exists yet', async () => {
      const { service } = makeService();
      const result = await service.getTrustProfile('user-1');
      expect(result.tier).toBe(TrustTier.UNVERIFIED);
      expect(result.score).toBe(SCORE.baseline);
    });

    it('a brand-new, clean account is neutral — never treated as suspicious', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma);
      const { score } = await service.recompute('user-1');
      expect(score).toBe(SCORE.baseline);
    });
  });

  describe('Identity Assurance', () => {
    it('email only = baseline + 6', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma, { verificationLevel: VerificationLevel.LEVEL_1 });
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 6,
      );
    });

    it('email + phone = baseline + 12, tier BASIC', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma, { verificationLevel: VerificationLevel.LEVEL_2 });
      const result = await service.recompute('user-1');
      expect(result.score).toBe(SCORE.baseline + 12);
      expect(result.tier).toBe(TrustTier.BASIC);
    });

    it('email + phone + identity document = baseline + 18, tier VERIFIED', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma, { verificationLevel: VerificationLevel.LEVEL_3 });
      const result = await service.recompute('user-1');
      expect(result.score).toBe(SCORE.baseline + 18);
      expect(result.tier).toBe(TrustTier.VERIFIED);
    });
  });

  describe('Account Security / Device Trust / Verified Claims / History', () => {
    it('adds 2FA + passkey + recovery codes (+12)', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma, { totpEnabledAt: new Date() });
      prisma.passkey.count.mockResolvedValue(1);
      prisma.totpBackupCode.count.mockResolvedValue(5);
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 12,
      );
    });

    it('treats SMS 2FA as 2FA too', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma, { smsPhoneE164: '+15551234567' });
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 6,
      );
    });

    it('adds device trust (+6) only when no device approval is unresolved', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma);
      prisma.device.count.mockResolvedValue(1);
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 6,
      );

      // A pending approval withholds the "all resolved" half.
      prisma.deviceApprovalRequest.count.mockResolvedValue(1);
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 3,
      );
    });

    it('adds verified claims (+8) for a business claim and a third-party credential', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma);
      prisma.passportClaim.findFirst.mockResolvedValue({ id: 'claim' });
      prisma.passportClaim.count.mockResolvedValue(1);
      const result = await service.recompute('user-1');
      expect(result.score).toBe(SCORE.baseline + 8);
    });

    it('only reaches TRUSTED with identity verification AND a claim', async () => {
      const { prisma, service } = makeService();
      // Claim alone, without LEVEL_3 identity verification, is not TRUSTED.
      stubUser(prisma);
      prisma.passportClaim.findFirst.mockResolvedValue({ id: 'claim' });
      expect((await service.recompute('user-1')).tier).toBe(
        TrustTier.UNVERIFIED,
      );

      stubUser(prisma, { verificationLevel: VerificationLevel.LEVEL_3 });
      expect((await service.recompute('user-1')).tier).toBe(TrustTier.TRUSTED);
    });

    it('adds account age (+3) for an account older than 90 days', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma, { createdAt: OLD_ACCOUNT });
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 3,
      );
    });

    it('adds sustained-activity (+3) only with enough sign-ins spread over the span', async () => {
      const { prisma, security, service } = makeService();
      stubUser(prisma, { createdAt: OLD_ACCOUNT });

      security.logins = 10;
      security.loginOldEnough = true;
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 3 + 3, // age + sustained
      );

      // Enough sign-ins but not spread over the span → no bonus.
      security.loginOldEnough = false;
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline + 3,
      );
    });
  });

  describe('Risk / Security Signals', () => {
    it('applies the stolen-token penalty (−30)', async () => {
      const { prisma, security, service } = makeService();
      stubUser(prisma);
      security.reuseInWindow = 1;
      security.reuseEver = 1;
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline - 30,
      );
    });

    it('caps the device-revocation penalty at −9', async () => {
      const { prisma, security, service } = makeService();
      stubUser(prisma);
      security.deviceRevokedInWindow = 1;
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline - 3,
      );

      security.deviceRevokedInWindow = 4;
      expect((await service.recompute('user-1')).score).toBe(
        SCORE.baseline - 9,
      );
    });

    it('decays a penalty once the triggering event is outside the window', async () => {
      const { prisma, security, service } = makeService();
      stubUser(prisma, { createdAt: OLD_ACCOUNT });
      // Flag exists historically, but outside the decay window.
      security.reuseEver = 1;
      security.reuseInWindow = 0;
      // …and the historical flag correctly withholds the sustained bonus.
      security.logins = 10;
      security.loginOldEnough = true;

      const { score } = await service.recompute('user-1');
      expect(score).toBe(SCORE.baseline + 3); // age only: no −30, no sustained +3
    });

    it('floors a suspended account to zero', async () => {
      const { prisma, service } = makeService();
      stubUser(prisma, {
        suspended: true,
        verificationLevel: VerificationLevel.LEVEL_3,
      });
      expect((await service.recompute('user-1')).score).toBe(0);
    });
  });

  it('caps a fully-assured account at 100', async () => {
    const { prisma, security, service } = makeService();
    stubUser(prisma, {
      verificationLevel: VerificationLevel.LEVEL_3,
      createdAt: OLD_ACCOUNT,
      totpEnabledAt: new Date(),
    });
    prisma.passkey.count.mockResolvedValue(1);
    prisma.totpBackupCode.count.mockResolvedValue(3);
    prisma.device.count.mockResolvedValue(2);
    prisma.passportClaim.findFirst.mockResolvedValue({ id: 'claim' });
    prisma.passportClaim.count.mockResolvedValue(1);
    security.logins = 25;
    security.loginOldEnough = true;

    const result = await service.recompute('user-1');
    expect(result.score).toBe(SCORE.max);
    expect(result.tier).toBe(TrustTier.TRUSTED);
  });
});
