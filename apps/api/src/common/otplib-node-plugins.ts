import { createHmac, randomBytes as nodeRandomBytes, timingSafeEqual } from 'crypto';
import type { Base32EncodeOptions, Base32Plugin, CryptoPlugin } from '@otplib/core';

/**
 * otplib's own recommended crypto/base32 plugins (NobleCryptoPlugin,
 * ScureBase32Plugin) pull in @noble/hashes and @scure/base, both pure ESM
 * with no CJS build. Vercel's NestJS deployment transpiles this app's source
 * per-file rather than bundling node_modules, so any `require()` reaching
 * those packages crashes with ERR_REQUIRE_ESM at runtime. otplib's plugin
 * interface is tiny (RFC 6238 HMAC + RFC 4648 base32) and Node's built-in
 * crypto module already does the hard part, so implementing it directly
 * here sidesteps the ESM dependency entirely instead of fighting the bundler.
 */
export class NodeCryptoPlugin implements CryptoPlugin {
  readonly name = 'node';

  hmac(algorithm: 'sha1' | 'sha256' | 'sha512', key: Uint8Array, data: Uint8Array): Uint8Array {
    return new Uint8Array(createHmac(algorithm, key).update(data).digest());
  }

  randomBytes(length: number): Uint8Array {
    return new Uint8Array(nodeRandomBytes(length));
  }

  constantTimeEqual(a: string | Uint8Array, b: string | Uint8Array): boolean {
    const bufA = typeof a === 'string' ? Buffer.from(a) : Buffer.from(a);
    const bufB = typeof b === 'string' ? Buffer.from(b) : Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class NodeBase32Plugin implements Base32Plugin {
  readonly name = 'node';

  encode(data: Uint8Array, options?: Base32EncodeOptions): string {
    let bits = '';
    for (const byte of data) bits += byte.toString(2).padStart(8, '0');

    let output = '';
    for (let i = 0; i < bits.length; i += 5) {
      const chunk = bits.slice(i, i + 5).padEnd(5, '0');
      output += BASE32_ALPHABET[parseInt(chunk, 2)];
    }

    if (options?.padding) {
      while (output.length % 8 !== 0) output += '=';
    }
    return output;
  }

  decode(str: string): Uint8Array {
    const cleaned = str.toUpperCase().replace(/=+$/, '');
    let bits = '';
    for (const char of cleaned) {
      const index = BASE32_ALPHABET.indexOf(char);
      if (index === -1) throw new Error(`Invalid base32 character: ${char}`);
      bits += index.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return new Uint8Array(bytes);
  }
}
