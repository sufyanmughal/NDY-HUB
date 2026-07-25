import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * A TOTP secret can't be stored as a one-way hash the way a password is —
 * the server has to recompute the current code from it on every login, so
 * it needs to be reversible. AES-256-GCM keyed from TOTP_ENCRYPTION_KEY
 * instead of plaintext: a DB-only compromise shouldn't hand over every
 * user's second factor. SHA-256 over the configured key derives a fixed
 * 32-byte AES key regardless of what shape the env var is in, the same
 * convention as JWT_ACCESS_SECRET/JWT_REFRESH_SECRET elsewhere in this app.
 *
 * Unlike OidcKeysService's signing key, this one intentionally has no
 * ephemeral-if-unset fallback — an id_token silently rotating keys on
 * restart just means old tokens (already short-lived) stop verifying, but
 * a TOTP secret silently rotating on restart would permanently lock every
 * 2FA-enabled user out of their own account. TOTP_ENCRYPTION_KEY is a
 * required, persistent secret (same class as the JWT secrets), not a
 * dev-mode convenience.
 */

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptTotpSecret(
  plaintext: string,
  encryptionKey: string,
): string {
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

export function decryptTotpSecret(
  stored: string,
  encryptionKey: string,
): string {
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
