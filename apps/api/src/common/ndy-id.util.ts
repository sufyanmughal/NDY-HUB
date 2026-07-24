import { customAlphabet } from 'nanoid';

// Deliberately excludes 0/O and 1/I/L so a support agent reading an NDY ID
// aloud over the phone can't misplace a character.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const nanoid = customAlphabet(ALPHABET, 6);

/**
 * Generates a candidate NDY ID, e.g. "NDY-4F82XK".
 * Callers must retry on unique-constraint collision — this function doesn't
 * touch the database, so it can't itself guarantee uniqueness.
 */
export function generateNdyId(): string {
  return `NDY-${nanoid()}`;
}
