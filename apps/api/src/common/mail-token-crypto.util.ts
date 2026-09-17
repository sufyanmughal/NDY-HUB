import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Provider OAuth access/refresh tokens (Graph, Gmail, ...) have to be
 * reversible — NDY Mail Core calls the provider on the user's behalf and
 * needs the real token back, not a one-way hash. Same AES-256-GCM
 * construction as common/totp-crypto.util.ts (deliberately copied, not
 * imported/shared — see below), keyed from MAIL_TOKEN_ENCRYPTION_KEY.
 *
 * A DB-only compromise must not hand over every connected mailbox's
 * provider credentials (design doc §0/§3: "credentials/tokens server-side,
 * encrypted, linked to NDY ID — never in the app").
 *
 * Deliberately its own key/secret, not a reuse of TOTP_ENCRYPTION_KEY:
 * rotating or (in an incident) revoking the mail-token key must never be
 * able to also invalidate every user's 2FA, and vice versa — two
 * unrelated blast radii kept genuinely separate, same reasoning as why
 * JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are already distinct secrets
 * rather than one shared key doing double duty.
 */

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptMailToken(plaintext: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = randomBytes(12); // AES-GCM standard IV size
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // iv:authTag:ciphertext, each base64 — self-contained, no separate
  // columns needed for the IV/auth tag.
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptMailToken(stored: string, encryptionKey: string): string {
  const [ivB64, authTagB64, dataB64] = stored.split(':');
  const key = deriveKey(encryptionKey);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
