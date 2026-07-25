import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { StripeWebhookController } from './stripe-webhook.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on MembershipController
  controllers: [MembershipController, StripeWebhookController],
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
