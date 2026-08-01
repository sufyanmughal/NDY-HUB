import { createHmac } from 'crypto';
import { NodeBase32Plugin, NodeCryptoPlugin } from './otplib-node-plugins';

describe('NodeCryptoPlugin', () => {
  const plugin = new NodeCryptoPlugin();

  it('hmac matches a direct Node crypto HMAC for the same inputs', () => {
    const key = new Uint8Array([1, 2, 3, 4, 5]);
    const data = new Uint8Array([9, 8, 7]);
    const expected = createHmac('sha1', key).update(data).digest();
    expect(Buffer.from(plugin.hmac('sha1', key, data))).toEqual(expected);
  });

  it('hmac supports sha256 and sha512 too', () => {
    const key = new Uint8Array([1, 2, 3]);
    const data = new Uint8Array([4, 5, 6]);
    for (const algorithm of ['sha256', 'sha512'] as const) {
      const expected = createHmac(algorithm, key).update(data).digest();
      expect(Buffer.from(plugin.hmac(algorithm, key, data))).toEqual(expected);
    }
  });

  it('randomBytes returns the requested length and is not all zeros', () => {
    const bytes = plugin.randomBytes(20);
    expect(bytes.length).toBe(20);
    expect(bytes.some((b) => b !== 0)).toBe(true);
  });

  it('randomBytes does not return the same value twice', () => {
    const a = plugin.randomBytes(20);
    const b = plugin.randomBytes(20);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('constantTimeEqual is true for identical values, false for different ones', () => {
    expect(plugin.constantTimeEqual('secret', 'secret')).toBe(true);
    expect(plugin.constantTimeEqual('secret', 'different')).toBe(false);
  });

  it('constantTimeEqual is false for different lengths rather than throwing', () => {
    expect(plugin.constantTimeEqual('short', 'a-lot-longer-value')).toBe(false);
  });

  it('constantTimeEqual works with Uint8Array inputs', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3]);
    const c = new Uint8Array([1, 2, 4]);
    expect(plugin.constantTimeEqual(a, b)).toBe(true);
    expect(plugin.constantTimeEqual(a, c)).toBe(false);
  });
});

describe('NodeBase32Plugin', () => {
  const plugin = new NodeBase32Plugin();

  it('round-trips arbitrary bytes through encode/decode', () => {
    const original = new Uint8Array([0, 1, 2, 3, 253, 254, 255, 128, 64, 17]);
    const encoded = plugin.encode(original);
    const decoded = plugin.decode(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('encodes a known RFC 4648 test vector correctly', () => {
    // "foobar" -> MZXW6YTBOI====== per RFC 4648 test vectors (unpadded here).
    const input = Buffer.from('foobar', 'utf8');
    const encoded = plugin.encode(new Uint8Array(input));
    expect(encoded).toBe('MZXW6YTBOI');
  });

  it('decodes a known RFC 4648 test vector correctly', () => {
    const decoded = plugin.decode('MZXW6YTBOI');
    expect(Buffer.from(decoded).toString('utf8')).toBe('foobar');
  });

  it('adds padding when requested, omits it by default', () => {
    const bytes = new Uint8Array([102, 111, 111]); // "foo"
    expect(plugin.encode(bytes)).toBe('MZXW6');
    expect(plugin.encode(bytes, { padding: true })).toBe('MZXW6===');
  });

  it('decode is case-insensitive and tolerates padding', () => {
    const upper = plugin.decode('MZXW6YTBOI');
    const lower = plugin.decode('mzxw6ytboi');
    const padded = plugin.decode('MZXW6YTBOI======');
    expect(Array.from(lower)).toEqual(Array.from(upper));
    expect(Array.from(padded)).toEqual(Array.from(upper));
  });

  it('decode throws on an invalid character', () => {
    expect(() => plugin.decode('not-valid-base32!')).toThrow(
      'Invalid base32 character',
    );
  });
});
