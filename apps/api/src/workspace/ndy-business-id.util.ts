import { customAlphabet } from 'nanoid';

// Same excludes-ambiguous-chars alphabet as common/ndy-id.util.ts's user
// core ID and ndy-economy's Bridge Transaction Ref — one mental model for
// "what a human-facing NDY-issued code looks like" across the ecosystem.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const nanoid = customAlphabet(ALPHABET, 6);

/**
 * A Workspace-level identity code, e.g. "NDY-BIZ-4F82XK" — the business
 * equivalent of a user's NDY ID, but scoped to a tenant (Workspace), not a
 * person. This is the first real use of the "BIZ" type segment that
 * common/ndy-id.util.ts has reserved on User since Milestone 1 but never
 * actually assigned — per this plan's own note, that's deliberately
 * finally used here, at the Workspace level, rather than retrofitted onto
 * User (a business is a tenant, not a personal identity type).
 */
export function generateNdyBusinessId(): string {
  return `NDY-BIZ-${nanoid()}`;
}
