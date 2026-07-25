import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { MembershipService } from './membership.service';

/**
 * Structurally correct and ready for when a real Stripe account exists —
 * verified against the SDK's own signature check the same way the CRYNDY
 * webhook verifies its HMAC. Untested against a live Stripe account in
 * this environment (would need the Stripe CLI forwarding real events);
 * flagging that honestly rather than claiming more than was actually run.
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly membership: MembershipService) {}

  @Post()
  async handle(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string' || !req.rawBody) {
      throw new BadRequestException('Missing Stripe signature or raw body.');
    }

    const event = this.membership.verifyWebhookSignature(
      req.rawBody,
      signature,
    );

    switch (event.type) {
      case 'checkout.session.completed':
        await this.membership.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.membership.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        break; // other event types intentionally ignored for now
    }

    return { received: true };
  }
}
