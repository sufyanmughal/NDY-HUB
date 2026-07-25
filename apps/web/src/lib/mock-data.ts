// Placeholder data for the dashboard shell (milestone 2). Nothing here is
// wired to the Core API yet — that happens once milestone 1's auth/session
// endpoints are in place and this becomes a real authenticated fetch.

// Membership is the only field left here that's genuinely still mock —
// CRYNDY and NDYBITS balances, and the connected-platforms count, are
// derived below from the same mock purchase/ledger/platform data the
// /cryndy, /ndybits, and /platforms pages use, so the dashboard overview
// and Passport page can't silently drift out of sync with them the way
// hardcoded duplicates would.
export const mockUser = {
  firstName: "Teun",
  fullName: "Teun Rietdijk",
  ndyId: "NDY-4F82XK",
  passportVerified: true,
  verificationLevel: 2,
  ndyappsConnected: true,
  membership: "NDY Flow",
  recentActivityCount: 12,
  lastLogin: { when: "Today, 14:32", where: "Amsterdam, Netherlands" },
};

export const mockTransactions = [
  { label: "CRYNDY Purchase", detail: "2,000 CRYNDY", status: "Completed", when: "Today" },
  { label: "Membership Payment", detail: "NDY Flow — Monthly", status: "Completed", when: "2 days ago" },
  { label: "NDYBITS Reward", detail: "Daily Login Reward", status: "Completed", when: "3 days ago" },
  { label: "CRYNDY Bonus", detail: "Referral Bonus", status: "Completed", when: "5 days ago" },
] as const;

// Mirrors apps/api's CryndyPurchaseStatus enum (prisma/schema.prisma) and the
// shape GET /cryndy/me actually returns, so wiring in a real fetch later is a
// matter of swapping this constant for the response body, not reshaping data.
export type CryndyPurchaseStatus =
  | "PAYMENT_PENDING"
  | "PAYMENT_CONFIRMED"
  | "UNDER_REVIEW"
  | "VERIFIED"
  | "ALLOCATED"
  | "LOCKED"
  | "AVAILABLE"
  | "DISTRIBUTED_ON_CHAIN"
  | "CANCELLED"
  | "REFUNDED";

export interface CryndyPurchase {
  id: string;
  reference: string;
  amountPaid: number;
  currency: string;
  cryndyAmount: number;
  bonusAmount: number;
  packageName: string | null;
  paymentMethod: string;
  status: CryndyPurchaseStatus;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  allocatedAt: string | null;
}

export const mockCryndyPurchases: CryndyPurchase[] = [
  {
    id: "cp-1",
    reference: "CRY-2026-07-000184",
    amountPaid: 5000,
    currency: "USD",
    cryndyAmount: 20000,
    bonusAmount: 2000,
    packageName: "Growth Package",
    paymentMethod: "bank_transfer",
    status: "AVAILABLE",
    createdAt: "2026-06-02T10:15:00.000Z",
    updatedAt: "2026-06-04T09:00:00.000Z",
    verifiedAt: "2026-06-03T08:00:00.000Z",
    allocatedAt: "2026-06-03T12:00:00.000Z",
  },
  {
    id: "cp-2",
    reference: "CRY-2026-07-000241",
    amountPaid: 1500,
    currency: "USD",
    cryndyAmount: 6000,
    bonusAmount: 300,
    packageName: "Starter Package",
    paymentMethod: "card",
    status: "LOCKED",
    createdAt: "2026-06-20T14:30:00.000Z",
    updatedAt: "2026-06-22T11:00:00.000Z",
    verifiedAt: "2026-06-21T09:00:00.000Z",
    allocatedAt: "2026-06-22T11:00:00.000Z",
  },
  {
    id: "cp-3",
    reference: "CRY-2026-07-000309",
    amountPaid: 2500,
    currency: "USD",
    cryndyAmount: 10000,
    bonusAmount: 0,
    packageName: "Growth Package",
    paymentMethod: "crypto",
    status: "ALLOCATED",
    createdAt: "2026-07-10T08:45:00.000Z",
    updatedAt: "2026-07-11T10:00:00.000Z",
    verifiedAt: "2026-07-11T09:00:00.000Z",
    allocatedAt: "2026-07-11T10:00:00.000Z",
  },
  {
    id: "cp-4",
    reference: "CRY-2026-07-000355",
    amountPaid: 800,
    currency: "USD",
    cryndyAmount: 3200,
    bonusAmount: 0,
    packageName: null,
    paymentMethod: "card",
    status: "UNDER_REVIEW",
    createdAt: "2026-07-18T16:00:00.000Z",
    updatedAt: "2026-07-18T16:05:00.000Z",
    verifiedAt: null,
    allocatedAt: null,
  },
  {
    id: "cp-5",
    reference: "CRY-2026-07-000398",
    amountPaid: 1200,
    currency: "USD",
    cryndyAmount: 4800,
    bonusAmount: 0,
    packageName: "Starter Package",
    paymentMethod: "card",
    status: "PAYMENT_PENDING",
    createdAt: "2026-07-24T09:20:00.000Z",
    updatedAt: "2026-07-24T09:20:00.000Z",
    verifiedAt: null,
    allocatedAt: null,
  },
];

const CRYNDY_STATUSES: CryndyPurchaseStatus[] = [
  "PAYMENT_PENDING",
  "PAYMENT_CONFIRMED",
  "UNDER_REVIEW",
  "VERIFIED",
  "ALLOCATED",
  "LOCKED",
  "AVAILABLE",
  "DISTRIBUTED_ON_CHAIN",
  "CANCELLED",
  "REFUNDED",
];

// Same aggregation GET /cryndy/me does server-side: sum per status, and only
// count AVAILABLE/DISTRIBUTED_ON_CHAIN toward the spendable balance. Kept in
// sync by hand for now since this is mock data, not a fetch.
export const mockCryndyBreakdown: Record<
  CryndyPurchaseStatus,
  { count: number; cryndyAmount: number }
> = Object.fromEntries(
  CRYNDY_STATUSES.map((status) => [status, { count: 0, cryndyAmount: 0 }]),
) as Record<CryndyPurchaseStatus, { count: number; cryndyAmount: number }>;

let mockCryndyAvailableBalance = 0;
for (const purchase of mockCryndyPurchases) {
  const total = purchase.cryndyAmount + purchase.bonusAmount;
  mockCryndyBreakdown[purchase.status].count += 1;
  mockCryndyBreakdown[purchase.status].cryndyAmount += total;
  if (purchase.status === "AVAILABLE" || purchase.status === "DISTRIBUTED_ON_CHAIN") {
    mockCryndyAvailableBalance += total;
  }
}
export { mockCryndyAvailableBalance };

export interface NdybitsLedgerEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export const mockNdybitsLedger: NdybitsLedgerEntry[] = [
  { id: "nb-1", amount: 500, reason: "daily_login", createdAt: "2026-07-25T08:00:00.000Z" },
  { id: "nb-2", amount: 2000, reason: "referral_bonus", createdAt: "2026-07-22T13:10:00.000Z" },
  { id: "nb-3", amount: 500, reason: "daily_login", createdAt: "2026-07-22T08:00:00.000Z" },
  { id: "nb-4", amount: 1500, reason: "purchase_reward", createdAt: "2026-06-20T14:35:00.000Z" },
  { id: "nb-5", amount: -250, reason: "reward_redemption", createdAt: "2026-06-15T10:00:00.000Z" },
  { id: "nb-6", amount: 500, reason: "daily_login", createdAt: "2026-06-10T08:00:00.000Z" },
];

export const mockNdybitsBalance = mockNdybitsLedger.reduce(
  (sum, entry) => sum + entry.amount,
  0,
);

export const mockPlatforms = [
  { name: "NDJOYIT", status: "Connected" as const },
  { name: "CRYNDY", status: "Connected" as const },
  { name: "CRYNDY Presale", status: "Connected" as const },
  { name: "NDJOYIT Business", status: "Connected" as const },
  { name: "NDYQUIZ", status: "Coming Soon" as const },
  { name: "NDYXTRA", status: "Coming Soon" as const },
  { name: "NDYSTAYS", status: "Coming Soon" as const },
  { name: "NDJOYMENTS", status: "Coming Soon" as const },
  { name: "NDYCOLLECT", status: "Coming Soon" as const },
  { name: "NDYNEX", status: "Coming Soon" as const },
];

export const mockConnectedPlatformsCount = mockPlatforms.filter(
  (p) => p.status === "Connected",
).length;
