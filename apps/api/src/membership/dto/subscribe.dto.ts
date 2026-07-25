import { IsEnum } from 'class-validator';
import { BillingCycle, MembershipTier } from '@prisma/client';

export class SubscribeDto {
  @IsEnum(MembershipTier)
  tier!: MembershipTier;

  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;
}
