// What's still mock, honestly: recent activity count/feed and the
// platforms list — neither has a backend yet. Everything else that used
// to live here (CRYNDY, NDYBITS, membership, transactions, identity) is a
// real fetch now — see use-cryndy.ts, use-ndybits.ts, use-membership.ts,
// use-transactions.ts, use-passport.ts.

export const mockUser = {
  recentActivityCount: 12,
};

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
