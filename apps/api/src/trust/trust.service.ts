import { Injectable } from '@nestjs/common';
import { TrustTier, VerificationLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Trust-relevant PassportClaim keys beyond identity_document — any one of
// these, on top of VERIFIED, is enough to reach TRUSTED. A short, explicit
// list rather than "any claim at all": an arbitrary self-asserted claim
// shouldn't be able to push someone into the highest tier, only claims
// that are themselves NDY_VERIFIED or THIRD_PARTY_CREDENTIAL (checked
// below, not just presence of the key).
const TRUSTED_TIER_CLAIM_KEYS = ['business_verified'];

/**
 * The LOCKED Trust Score model (agreed with the client, 2026-09-17).
 *
 * Two things this model deliberately is NOT:
 *  - Not "collect verifications, receive points". It measures current assurance
 *    across six categories, is recomputed from present facts (nothing accrues
 *    permanently), and moves DOWN on real risk signals.
 *  - Not suspicious-by-default. The baseline is 50 — explicitly *neutral /
 *    insufficient history*, NOT "50% trusted". A brand-new clean account starts
 *    neutral and earns the upper half.
 *
 * Every weight lives here, in one place, so tuning is a code change with no
 * schema impact. This is v1 — the client's stated intent is to tune against real
 * data rather than treat the first formula as permanent.
 */
export const SCORE = {
  /** Neutral. Not "half-trusted" — "no history either way yet". */
  baseline: 50,

  // Identity Assurance (max +18)
  emailVerified: 6,
  phoneVerified: 6,
  identityVerified: 6,

  // Account Security (max +12)
  twoFactorEnabled: 6,
  passkeyRegistered: 4,
  recoveryCodes: 2,

  // Device Trust (max +6)
  knownDevice: 3,
  allDevicesResolved: 3,

  // Verified Claims (max +8)
  businessVerified: 5,
  thirdPartyCredential: 3,

  // Account History (max +6)
  accountAge: 3,
  sustainedActivity: 3,
  accountAgeDays: 90,
  /** "Sustained clean activity": at least this many successful sign-ins spread
   * over at least `sustainedSpanDays`, with no security flags. */
  sustainedLogins: 10,
  sustainedSpanDays: 60,

  // Risk / Security Signals (subtractions)
  penaltyTokenReuse: -30,
  penaltyDeviceRevokedEach: -3,
  penaltyDeviceRevokedCap: -9,

  /**
   * Risk penalties DECAY after this many clean days — the client's explicit
   * decision that trust "should represent current confidence, not become a
   * permanent punishment record". A penalty applies only while its triggering
   * event is inside this window. (A specific severe event may later warrant a
   * different recovery policy, per that same decision.)
   */
  penaltyDecayDays: 30,

  min: 0,
  max: 100,
} as const;

export interface TrustProfileResult {
  tier: TrustTier;
  score: number;
  computedAt: Date;
}

/**
 * Phase 8 (docs/phase8-signature-trust-design.md §1, §3) — computes and caches
 * a user's Trust Tier and 0–100 score from data that already exists.
 *
 * Separation the client asked to preserve: PassportClaims are *verified facts*;
 * the **tier** answers "how verified"; the **score** is dynamic *confidence* for
 * the account right now. TrustProfile is a materialized view, never the source of
 * truth — recomputing from scratch is always safe and always correct.
 */
@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrustProfile(userId: string): Promise<TrustProfileResult> {
    const existing = await this.prisma.trustProfile.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    // No row yet = neutral / no history, not "untrustworthy".
    return {
      tier: TrustTier.UNVERIFIED,
      score: SCORE.baseline,
      computedAt: new Date(),
    };
  }

  /**
   * Recomputes and persists tier + score — call this whenever a fact either
   * depends on changes. Idempotent and cheap enough to call eagerly rather
   * than queue, same "just recompute, don't incrementally patch a derived
   * value" reasoning as this file's own schema doc comment.
   */
  async recompute(userId: string): Promise<TrustProfileResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        verificationLevel: true,
        createdAt: true,
        suspended: true,
        totpEnabledAt: true,
        smsPhoneE164: true,
      },
    });

    const [tier, score] = await Promise.all([
      this.computeTier(userId, user.verificationLevel),
      this.computeScore(userId, user),
    ]);

    return this.prisma.trustProfile.upsert({
      where: { userId },
      create: { userId, tier, score },
      update: { tier, score, computedAt: new Date() },
    });
  }

  private async computeTier(
    userId: string,
    verificationLevel: VerificationLevel,
  ): Promise<TrustTier> {
    if (verificationLevel === VerificationLevel.LEVEL_0) {
      return TrustTier.UNVERIFIED;
    }
    if (verificationLevel === VerificationLevel.LEVEL_1) {
      return TrustTier.UNVERIFIED;
    }
    if (verificationLevel === VerificationLevel.LEVEL_2) {
      return TrustTier.BASIC;
    }
    // LEVEL_3 — identity-verified. An additional non-self-asserted claim
    // decides between VERIFIED and TRUSTED.
    const trustedClaim = await this.prisma.passportClaim.findFirst({
      where: {
        userId,
        claimKey: { in: TRUSTED_TIER_CLAIM_KEYS },
        // SELF_ASSERTED doesn't count — only claims NDY HUB or a recognized
        // third party actually stood behind push someone past VERIFIED.
        provenance: { not: 'SELF_ASSERTED' },
      },
      select: { id: true },
    });
    return trustedClaim ? TrustTier.TRUSTED : TrustTier.VERIFIED;
  }

  private async computeScore(
    userId: string,
    user: {
      verificationLevel: VerificationLevel;
      createdAt: Date;
      suspended: boolean;
      totpEnabledAt: Date | null;
      smsPhoneE164: string | null;
    },
  ): Promise<number> {
    // A suspended account is not partially trusted.
    if (user.suspended) return SCORE.min;

    const decayCutoff = new Date(
      Date.now() - SCORE.penaltyDecayDays * 24 * 60 * 60 * 1000,
    );
    const sustainedSpanCutoff = new Date(
      Date.now() - SCORE.sustainedSpanDays * 24 * 60 * 60 * 1000,
    );

    const [
      passkeys,
      backupCodes,
      devices,
      unresolvedDeviceApprovals,
      businessClaim,
      thirdPartyClaims,
      tokenReuseEvents,
      deviceRevokedEvents,
      loginCount,
      loginOldEnough,
      anySecurityFlag,
    ] = await Promise.all([
      this.prisma.passkey.count({ where: { userId } }),
      this.prisma.totpBackupCode.count({ where: { userId, usedAt: null } }),
      this.prisma.device.count({ where: { userId, revokedAt: null } }),
      // Unresolved = still awaiting a decision, used as "no device is pending
      // approval" — i.e. every registered device is known/resolved.
      this.prisma.deviceApprovalRequest.count({
        where: { userId, approvedAt: null, deniedAt: null },
      }),
      this.prisma.passportClaim.findFirst({
        where: {
          userId,
          claimKey: { in: TRUSTED_TIER_CLAIM_KEYS },
          provenance: { not: 'SELF_ASSERTED' },
        },
        select: { id: true },
      }),
      this.prisma.passportClaim.count({
        where: { userId, provenance: 'THIRD_PARTY_CREDENTIAL' },
      }),
      // Risk signals, scoped to the decay window.
      this.prisma.securityEvent.count({
        where: {
          userId,
          type: 'OAUTH_TOKEN_REUSE_DETECTED',
          createdAt: { gte: decayCutoff },
        },
      }),
      this.prisma.securityEvent.count({
        where: {
          userId,
          type: 'DEVICE_REVOKED',
          createdAt: { gte: decayCutoff },
        },
      }),
      this.prisma.securityEvent.count({
        where: { userId, type: 'LOGIN_SUCCESS' },
      }),
      this.prisma.securityEvent.findFirst({
        where: {
          userId,
          type: 'LOGIN_SUCCESS',
          createdAt: { lte: sustainedSpanCutoff },
        },
        select: { id: true },
      }),
      // "No security flags" — any flag ever, not just in-window: this gates a
      // trust *bonus*, so it should be strict.
      this.prisma.securityEvent.count({
        where: { userId, type: 'OAUTH_TOKEN_REUSE_DETECTED' },
      }),
    ]);

    let score = SCORE.baseline;

    // --- Identity Assurance ---
    if (user.verificationLevel !== VerificationLevel.LEVEL_0) {
      score += SCORE.emailVerified; // LEVEL_1+
    }
    if (
      user.verificationLevel === VerificationLevel.LEVEL_2 ||
      user.verificationLevel === VerificationLevel.LEVEL_3
    ) {
      score += SCORE.phoneVerified;
    }
    if (user.verificationLevel === VerificationLevel.LEVEL_3) {
      score += SCORE.identityVerified;
    }

    // --- Account Security ---
    if (user.totpEnabledAt || user.smsPhoneE164) {
      score += SCORE.twoFactorEnabled;
    }
    if (passkeys > 0) score += SCORE.passkeyRegistered;
    if (backupCodes > 0) score += SCORE.recoveryCodes;

    // --- Device Trust ---
    if (devices > 0) score += SCORE.knownDevice;
    // Requires an actual device: a user with none has nothing "resolved", and
    // scoring them for it would break the neutral baseline (caught by the test
    // that a brand-new account is exactly baseline, not baseline + 3).
    if (devices > 0 && unresolvedDeviceApprovals === 0) {
      score += SCORE.allDevicesResolved;
    }

    // --- Verified Claims ---
    if (businessClaim) score += SCORE.businessVerified;
    if (thirdPartyClaims > 0) score += SCORE.thirdPartyCredential;

    // --- Account History ---
    const ageDays =
      (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > SCORE.accountAgeDays) score += SCORE.accountAge;

    const sustainedActivity =
      loginCount >= SCORE.sustainedLogins &&
      loginOldEnough !== null &&
      anySecurityFlag === 0;
    if (sustainedActivity) score += SCORE.sustainedActivity;

    // --- Risk / Security Signals (decaying) ---
    if (tokenReuseEvents > 0) score += SCORE.penaltyTokenReuse;
    if (deviceRevokedEvents > 0) {
      score += Math.max(
        SCORE.penaltyDeviceRevokedCap,
        SCORE.penaltyDeviceRevokedEach * deviceRevokedEvents,
      );
    }

    return Math.max(SCORE.min, Math.min(SCORE.max, score));
  }
}
