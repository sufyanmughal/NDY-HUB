import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  BillingCycle,
  MembershipStatus,
  MembershipTier,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TIER_CONFIG } from './tier-config';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SubscribeResult =
  | { mode: 'checkout'; checkoutUrl: string }
  | { mode: 'dev-activated'; membershipId: string };

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — subscribe() will activate memberships directly instead of going through Stripe Checkout. Fine for local dev, not for anything real.',
      );
    }
  }

  getTierCatalogue() {
    return TIER_CONFIG;
  }

  async getCurrentAndHistory(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const current =
      memberships.find((m) => m.status === MembershipStatus.ACTIVE) ?? null;
    return {
      current: current && serializeMembership(current),
      history: memberships.map(serializeMembership),
    };
  }

  /**
   * Real path (Stripe configured): creates a Checkout Session and returns
   * its URL — the Membership row only gets created once the webhook below
   * sees checkout.session.completed, same as the CRYNDY webhook pattern.
   *
   * Dev path (no Stripe key): activates the membership immediately, the
   * same "skip the part I don't have credentials for" shortcut as the QR
   * login's dev-approve button. Any existing ACTIVE membership is
   * cancelled first — subscribe() is also how an upgrade/downgrade works,
   * not just a first purchase.
   */
  async subscribe(
    userId: string,
    tier: MembershipTier,
    billingCycle: BillingCycle,
  ): Promise<SubscribeResult> {
    if (this.stripe) {
      const priceCents =
        billingCycle === BillingCycle.ANNUAL
          ? TIER_CONFIG[tier].annualPriceCents
          : TIER_CONFIG[tier].monthlyPriceCents;

      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: priceCents,
              recurring: {
                interval:
                  billingCycle === BillingCycle.ANNUAL ? 'year' : 'month',
              },
              product_data: { name: TIER_CONFIG[tier].label },
            },
            quantity: 1,
          },
        ],
        metadata: { userId, tier, billingCycle },
        success_url:
          this.config.getOrThrow<string>('WEB_APP_URL') +
          '/memberships?checkout=success',
        cancel_url:
          this.config.getOrThrow<string>('WEB_APP_URL') +
          '/memberships?checkout=cancelled',
      });

      if (!session.url) {
        throw new BadRequestException('Stripe did not return a checkout URL.');
      }
      return { mode: 'checkout', checkoutUrl: session.url };
    }

    await this.cancelActiveForUser(userId);
    const membership = await this.prisma.membership.create({
      data: {
        userId,
        tier,
        billingCycle,
        status: MembershipStatus.ACTIVE,
        currentPeriodEnd: addBillingPeriod(new Date(), billingCycle),
      },
    });
    return { mode: 'dev-activated', membershipId: membership.id };
  }

  async cancel(userId: string, membershipId: string) {
    const result = await this.prisma.membership.updateMany({
      where: { id: membershipId, userId, status: MembershipStatus.ACTIVE },
      data: { status: MembershipStatus.CANCELLED, cancelledAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        'No active membership with that id for this user.',
      );
    }
  }

  /** Used both by subscribe()'s dev path and by the Stripe webhook once a
   * new subscription's checkout completes — a user should never have two
   * ACTIVE memberships at once. */
  private async cancelActiveForUser(userId: string) {
    await this.prisma.membership.updateMany({
      where: { userId, status: MembershipStatus.ACTIVE },
      data: { status: MembershipStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  /**
   * Stripe retries webhook deliveries until it gets a 2xx, so the same
   * event id can legitimately arrive more than once. Returns true the
   * first time an event id is seen (caller should process it), false on
   * every subsequent delivery of the same id (caller should no-op) — same
   * create-and-catch-P2002 idempotency shape as CryndyPurchase's
   * providerTransactionId.
   */
  async recordStripeEventOnce(eventId: string): Promise<boolean> {
    try {
      await this.prisma.processedStripeEvent.create({ data: { eventId } });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return false;
      }
      throw err;
    }
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.stripe) {
      throw new ConflictException('Stripe is not configured on this server.');
    }
    const endpointSecret = this.config.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      endpointSecret,
    );
  }

  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { userId, tier, billingCycle } = (session.metadata ?? {}) as {
      userId?: string;
      tier?: MembershipTier;
      billingCycle?: BillingCycle;
    };
    if (!userId || !tier || !billingCycle) {
      this.logger.error(
        `checkout.session.completed missing metadata: ${session.id}`,
      );
      return;
    }

    await this.cancelActiveForUser(userId);
    await this.prisma.membership.create({
      data: {
        userId,
        tier,
        billingCycle,
        status: MembershipStatus.ACTIVE,
        currentPeriodEnd: addBillingPeriod(new Date(), billingCycle),
        stripeSubscriptionId:
          typeof session.subscription === 'string'
            ? session.subscription
            : undefined,
        stripeCustomerId:
          typeof session.customer === 'string' ? session.customer : undefined,
      },
    });
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    await this.prisma.membership.updateMany({
      where: {
        stripeSubscriptionId: subscription.id,
        status: MembershipStatus.ACTIVE,
      },
      data: { status: MembershipStatus.CANCELLED, cancelledAt: new Date() },
    });
  }
}

function addBillingPeriod(from: Date, billingCycle: BillingCycle): Date {
  const days = billingCycle === BillingCycle.ANNUAL ? 365 : 30;
  return new Date(from.getTime() + days * MS_PER_DAY);
}

function serializeMembership(membership: {
  id: string;
  tier: MembershipTier;
  billingCycle: BillingCycle;
  status: MembershipStatus;
  startedAt: Date;
  currentPeriodEnd: Date;
  cancelledAt: Date | null;
}) {
  return {
    id: membership.id,
    tier: membership.tier,
    tierLabel: TIER_CONFIG[membership.tier].label,
    billingCycle: membership.billingCycle,
    status: membership.status,
    startedAt: membership.startedAt,
    currentPeriodEnd: membership.currentPeriodEnd,
    cancelledAt: membership.cancelledAt,
  };
}
