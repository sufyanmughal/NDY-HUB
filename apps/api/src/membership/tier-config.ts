import { MembershipTier } from '@prisma/client';

// Placeholder pricing — the proposal flags tier names AND pricing as things
// the client still needs to confirm before this is real. These numbers
// exist so the API and dashboard have something concrete to render; treat
// every price here as illustrative, not committed.
export interface TierConfig {
  label: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  benefits: string[];
}

export const TIER_CONFIG: Record<MembershipTier, TierConfig> = {
  RISE: {
    label: 'NDY Rise',
    monthlyPriceCents: 900,
    annualPriceCents: 9_000,
    benefits: ['Core NDY HUB access', 'Standard support'],
  },
  FLOW: {
    label: 'NDY Flow',
    monthlyPriceCents: 1_900,
    annualPriceCents: 19_000,
    benefits: [
      'Everything in Rise',
      'Priority support',
      'Early feature access',
    ],
  },
  PULSE: {
    label: 'NDY Pulse',
    monthlyPriceCents: 3_900,
    annualPriceCents: 39_000,
    benefits: [
      'Everything in Flow',
      'Reduced CRYNDY fees',
      'Extended transaction history',
    ],
  },
  VAULT: {
    label: 'NDY Vault',
    monthlyPriceCents: 7_900,
    annualPriceCents: 79_000,
    benefits: [
      'Everything in Pulse',
      'Higher CRYNDY purchase limits',
      'Dedicated account review',
    ],
  },
  MODE: {
    label: 'NDY Mode',
    monthlyPriceCents: 14_900,
    annualPriceCents: 149_000,
    benefits: [
      'Everything in Vault',
      'Business-tier verification',
      'API access',
    ],
  },
  LEGACY: {
    label: 'NDY Legacy',
    monthlyPriceCents: 29_900,
    annualPriceCents: 299_000,
    benefits: [
      'Everything in Mode',
      'White-glove onboarding',
      'Direct line to support',
    ],
  },
};
