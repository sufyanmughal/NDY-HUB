// Placeholder data for the dashboard shell (milestone 2). Nothing here is
// wired to the Core API yet — that happens once milestone 1's auth/session
// endpoints are in place and this becomes a real authenticated fetch.

export const mockUser = {
  firstName: "Teun",
  fullName: "Teun Rietdijk",
  ndyId: "NDY-4F82XK",
  passportVerified: true,
  verificationLevel: 2,
  ndyappsConnected: true,
  membership: "NDY Flow",
  cryndyBalance: 2450,
  ndybitsBalance: 18750,
  connectedPlatformsCount: 6,
  recentActivityCount: 12,
  lastLogin: { when: "Today, 14:32", where: "Amsterdam, Netherlands" },
};

export const mockTransactions = [
  { label: "CRYNDY Purchase", detail: "2,000 CRYNDY", status: "Completed", when: "Today" },
  { label: "Membership Payment", detail: "NDY Flow — Monthly", status: "Completed", when: "2 days ago" },
  { label: "NDYBITS Reward", detail: "Daily Login Reward", status: "Completed", when: "3 days ago" },
  { label: "CRYNDY Bonus", detail: "Referral Bonus", status: "Completed", when: "5 days ago" },
] as const;

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
