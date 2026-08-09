import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ITEMS_LIMIT = 20;

const SECURITY_EVENT_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Signed in',
  NEW_DEVICE: 'New device signed in',
  PASSWORD_CHANGED: 'Password changed',
  PASSKEY_ADDED: 'Passkey added',
  PASSKEY_REMOVED: 'Passkey removed',
  TOTP_ENABLED: 'Two-factor authentication enabled',
  TOTP_DISABLED: 'Two-factor authentication disabled',
  SMS_2FA_ENABLED: 'SMS two-factor authentication enabled',
  SMS_2FA_DISABLED: 'SMS two-factor authentication disabled',
  RECOVERY_CODE_USED: 'Recovery code used to sign in',
  EMAIL_CHANGED: 'Email address changed',
  OAUTH_APP_CONNECTED: 'Connected a new app',
  OAUTH_APP_REVOKED: 'Revoked access to an app',
};

const NDYBITS_REASON_LABELS: Record<string, string> = {
  daily_login: 'Daily Login Reward',
  referral_bonus: 'Referral Bonus',
  purchase_reward: 'Purchase Reward',
  reward_redemption: 'Reward Redemption',
};

export type ActivityType = 'SECURITY' | 'CRYNDY_PURCHASE' | 'NDYBITS' | 'MEMBERSHIP';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  label: string;
  createdAt: Date;
  meta?: Record<string, unknown>;
}

/**
 * The dashboard's "Recent Activity" panel — the current user's own
 * activity only (not an ecosystem-wide feed across every user), merged
 * from four sources that already exist for other reasons. No new
 * tracking table: this reads the same rows SecurityEvent/CryndyPurchase/
 * NdybitsLedgerEntry/Membership already write for their own purposes.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyActivity(userId: string): Promise<ActivityItem[]> {
    const [securityEvents, cryndyPurchases, ndybitsEntries, memberships] =
      await Promise.all([
        this.prisma.securityEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ITEMS_LIMIT,
        }),
        this.prisma.cryndyPurchase.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ITEMS_LIMIT,
          select: { id: true, createdAt: true, status: true },
        }),
        this.prisma.ndybitsLedgerEntry.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ITEMS_LIMIT,
        }),
        this.prisma.membership.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: ITEMS_LIMIT,
          select: { id: true, createdAt: true, cancelledAt: true, tier: true },
        }),
      ]);

    const items: ActivityItem[] = [
      ...securityEvents.map((e) => ({
        id: e.id,
        type: 'SECURITY' as const,
        label: SECURITY_EVENT_LABELS[e.type] ?? e.type,
        createdAt: e.createdAt,
      })),
      ...cryndyPurchases.map((p) => ({
        id: p.id,
        type: 'CRYNDY_PURCHASE' as const,
        label: 'CRYNDY purchase',
        createdAt: p.createdAt,
        meta: { status: p.status },
      })),
      ...ndybitsEntries.map((e) => ({
        id: e.id,
        type: 'NDYBITS' as const,
        label: NDYBITS_REASON_LABELS[e.reason] ?? e.reason,
        createdAt: e.createdAt,
        meta: { amount: e.amount },
      })),
      // A cancelled membership contributes a second, separate activity
      // item (using cancelledAt as its own timestamp) alongside the
      // original "started" item — both are real transitions worth
      // showing, not just the row's createdAt.
      ...memberships.flatMap((m) => {
        const startItem: ActivityItem = {
          id: `${m.id}:started`,
          type: 'MEMBERSHIP',
          label: `Membership started (${m.tier})`,
          createdAt: m.createdAt,
        };
        if (!m.cancelledAt) return [startItem];
        return [
          startItem,
          {
            id: `${m.id}:cancelled`,
            type: 'MEMBERSHIP' as const,
            label: `Membership cancelled (${m.tier})`,
            createdAt: m.cancelledAt,
          },
        ];
      }),
    ];

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return items.slice(0, ITEMS_LIMIT);
  }
}
