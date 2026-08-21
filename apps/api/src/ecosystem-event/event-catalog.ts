// The registered ecosystem event-type catalog — Phase B of
// identity-architecture-hardening-plan.md. Same "add real ones as clients
// need them, not speculatively" discipline as oauth/scopes.ts: this is
// intentionally not exhaustive of every event the client's message
// listed as an example. Namespaced, dot-separated
// ("<domain>.<past-tense-or-noun-state>") so future additions read
// consistently without a style debate each time.
export const ECOSYSTEM_EVENT_TYPES: Record<string, string> = {
  'identity.updated': "A user's core identity fields changed",
  'profile.updated': "A user's Passport/profile fields changed",
  'membership.changed': "A user's membership tier or status changed",
  'verification.changed': "A user's verification level changed",
  'connection.created': 'A user connected/linked another product or account',
  'reward.earned':
    'A user earned a reward outside the NDYBITS reward flow (e.g. a badge)',
  'booking.created': 'A user created a booking (NDYSTAYS, etc.)',
  'quiz.completed': 'A user completed a quiz (NDYQUIZ)',
  'steps.goal_completed': 'A user hit a step goal (NDJOYITSTEPS)',
};

export const ALL_ECOSYSTEM_EVENT_TYPES = Object.keys(ECOSYSTEM_EVENT_TYPES);

export function isRegisteredEventType(eventType: string): boolean {
  return ALL_ECOSYSTEM_EVENT_TYPES.includes(eventType);
}
