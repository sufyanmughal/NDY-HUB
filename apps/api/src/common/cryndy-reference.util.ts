import { customAlphabet } from 'nanoid';

const digits = customAlphabet('0123456789', 6);

/**
 * Generates a candidate human-facing purchase reference, e.g.
 * "CRY-2026-07-000184". Looks sequential but isn't — the suffix is random,
 * which is fine since `reference` is a display value, not the idempotency
 * key (that's `providerTransactionId`). Callers must retry on unique-
 * constraint collision, same as generateNdyId.
 */
export function generatePurchaseReference(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `CRY-${year}-${month}-${digits()}`;
}
