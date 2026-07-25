// What's still mock, honestly: recent activity count/feed, transactions
// history, and the platforms list — none of those have a backend yet.
// Everything else that used to live here (CRYNDY, NDYBITS, membership,
// identity) is a real fetch now — see use-cryndy.ts, use-ndybits.ts,
// use-membership.ts, use-passport.ts.

export const mockUser = {
  recentActivityCount: 12,
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

export const mockConnectedPlatformsCount = mockPlatforms.filter(
  (p) => p.status === "Connected",
).length;
