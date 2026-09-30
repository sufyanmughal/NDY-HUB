import { resolveVerificationLink } from './verification-redirect.util';

describe('resolveVerificationLink', () => {
  const webAppUrl = 'https://ndyhub.com';
  const token = 'tok_abc123';

  it('falls back to the website link when no clientId is given', () => {
    expect(resolveVerificationLink(webAppUrl, token, undefined)).toBe(
      'https://ndyhub.com/verify-email?token=tok_abc123',
    );
  });

  it('falls back to the website link for an unrecognized clientId', () => {
    expect(resolveVerificationLink(webAppUrl, token, 'some-other-app')).toBe(
      'https://ndyhub.com/verify-email?token=tok_abc123',
    );
  });

  it('deep-links into NDJOYIT for clientId "ndjoyit"', () => {
    expect(resolveVerificationLink(webAppUrl, token, 'ndjoyit')).toBe(
      'ndjoyit://verify-email?token=tok_abc123',
    );
  });
});
