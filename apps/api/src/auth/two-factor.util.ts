export type TwoFactorMethod = 'TOTP' | 'SMS';

/**
 * The single source of truth for "which 2FA methods does this account
 * have enabled" — both AuthService.login() and
 * SocialAuthService.buildSuccessRedirect() used to each check
 * user.totpEnabledAt independently (a duplication the code's own comment
 * flagged), which meant widening the condition for a second method risked
 * fixing one call site and silently missing the other. Both now go
 * through this instead.
 */
export function enabledTwoFactorMethods(user: {
  totpEnabledAt: Date | null;
  smsEnabledAt: Date | null;
}): TwoFactorMethod[] {
  const methods: TwoFactorMethod[] = [];
  if (user.totpEnabledAt) methods.push('TOTP');
  if (user.smsEnabledAt) methods.push('SMS');
  return methods;
}
