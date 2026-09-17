import { Injectable } from '@nestjs/common';
import {
  BusinessWorkspaceRequestStatus,
  SecurityEventType,
  TrustTier,
  VerificationLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Trust-relevant PassportClaim keys beyond identity_document — any one of
// these, on top of VERIFIED, is enough to reach TRUSTED. A short, explicit
// list rather than "any claim at all": an arbitrary self-asserted claim
// shouldn't be able to push someone into the highest tier, only claims
// that are themselves NDY_VERIFIED or THIRD_PARTY_CREDENTIAL (checked
// below, not just presence of the key).
const TRUSTED_TIER_CLAIM_KEYS = ['business_verified'];

/**
 * The confirmed score formula. Weights live here, in one place, so tuning them
 * is a code change with no schema or migration impact. Cumulative: LEVEL_3 is
 * worth email + phone + identity (75), not just the identity step.
 */
export const SCORE_WEIGHTS = {
  emailVerified: 10,
  phoneVerified: 25,
  identityVerified: 40,
  /** An approved BusinessWorkspaceRequest by this user. */
  businessVerified: 15,
  /** Account older than `longStandingDays` with zero security flags. */
  longStandingCleanAccount: 10,
  longStandingDays: 90,
  cap: 100,
} as const;

/**
 * The SecurityEventType values that count as an actual "security flag" — i.e.
 * a signal something went wrong on the account — as opposed to the rest of the
 * enum (LOGIN_SUCCESS, PASSWORD_CHANGED, NEW_DEVICE, OAUTH_APP_CONNECTED, …)
 * which are normal account activity and must NOT cost a user points. Today the
 * only such type is OAuth token reuse (the standard stolen-refresh-token
 * signal). Extend this list when a new flag type is introduced, rather than
 * widening it to the whole enum.
 */
const SECURITY_FLAG_EVENT_TYPES: SecurityEventType[] = [
  SecurityEventType.OAUTH_TOKEN_REUSE_DETECTED,
];

export interface TrustProfileResult {
  tier: TrustTier;
  score: number;
  computedAt: Date;
}

/**
 * Phase 8 (docs/phase8-signature-trust-design.md §1, §3) — computes and
 * caches a user's Trust Tier and 0–100 score from data that already exists:
 * User.verificationLevel (email/phone/identity), PassportClaim (Phase 7),
 * BusinessWorkspaceRequest approvals, account age, and real security flags.
 * TrustProfile is a materialized view, never the source of truth —
 * recomputing from scratch is always safe and always correct, even if a row
 * is missing or stale.
 */
@Injectable()
export class TrustService {
  constructor(private readonly prisma: PrismaService) {}

  async getTrustProfile(userId: string): Promise<TrustProfileResult> {
    const existing = await this.prisma.trustProfile.findUnique({
      where: { userId },
    });
    if (existing) return existing;
    // No row yet is equivalent to UNVERIFIED / 0 — recompute() creates the
    // row lazily the first time something actually changes for this user;
    // reading it before that ever happens shouldn't require a write.
    return { tier: TrustTier.UNVERIFIED, score: 0, computedAt: new Date() };
  }

  /**
   * Recomputes and persists a user's tier + score — call this whenever a fact
   * either depends on changes (today: identity-verification approval; see
   * IdentityVerificationService.approve). Idempotent and cheap enough to call
   * eagerly rather than queue, same "just recompute, don't try to incrementally
   * patch a derived value" reasoning as this file's own schema doc comment.
   */
  async recompute(userId: string): Promise<TrustProfileResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { verificationLevel: true, createdAt: true },
    });

    const [tier, score] = await Promise.all([
      this.computeTier(userId, user.verificationLevel),
      this.computeScore(userId, user.verificationLevel, user.createdAt),
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
    // LEVEL_3 — identity-verified. Check for an additional trust claim to
    // decide between VERIFIED and TRUSTED.
    const trustedClaim = await this.prisma.passportClaim.findFirst({
      where: {
        userId,
        claimKey: { in: TRUSTED_TIER_CLAIM_KEYS },
        // SELF_ASSERTED doesn't count — only claims NDY HUB or a
        // recognized third party actually stood behind push someone past
        // VERIFIED, same "don't let an unverified claim upgrade trust"
        // principle as everywhere else claims are used.
        provenance: { not: 'SELF_ASSERTED' },
      },
      select: { id: true },
    });
    return trustedClaim ? TrustTier.TRUSTED : TrustTier.VERIFIED;
  }

  /** Sums the confirmed weights and caps at 100. */
  private async computeScore(
    userId: string,
    verificationLevel: VerificationLevel,
    createdAt: Date,
  ): Promise<number> {
    let score = 0;

    // Cumulative verification steps.
    if (verificationLevel !== VerificationLevel.LEVEL_0) {
      score += SCORE_WEIGHTS.emailVerified;
    }
    if (
      verificationLevel === VerificationLevel.LEVEL_2 ||
      verificationLevel === VerificationLevel.LEVEL_3
    ) {
      score += SCORE_WEIGHTS.phoneVerified;
    }
    if (verificationLevel === VerificationLevel.LEVEL_3) {
      score += SCORE_WEIGHTS.identityVerified;
    }

    const [approvedBusiness, hasSecurityFlags] = await Promise.all([
      this.prisma.businessWorkspaceRequest.findFirst({
        where: {
          requestedByUserId: userId,
          status: BusinessWorkspaceRequestStatus.APPROVED,
        },
        select: { id: true },
      }),
      this.hasSecurityFlags(userId),
    ]);

    if (approvedBusiness) {
      score += SCORE_WEIGHTS.businessVerified;
    }

    const ageDays =
      (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > SCORE_WEIGHTS.longStandingDays && !hasSecurityFlags) {
      score += SCORE_WEIGHTS.longStandingCleanAccount;
    }

    return Math.min(SCORE_WEIGHTS.cap, score);
  }

  private async hasSecurityFlags(userId: string): Promise<boolean> {
    const count = await this.prisma.securityEvent.count({
      where: { userId, type: { in: SECURITY_FLAG_EVENT_TYPES } },
    });
    return count > 0;
  }
}
