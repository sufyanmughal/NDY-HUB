/**
 * Shared HTML layout for every NDY HUB transactional email. Table-based
 * layout with inline styles throughout — deliberate, not legacy habit:
 * Gmail/Outlook strip <style> blocks and flexbox/grid support is
 * inconsistent across clients, so inline styles on table cells is still
 * the only markup that renders identically everywhere. Kept to a single
 * function (not a templating engine) since there are only two emails
 * today; revisit if a third or fourth template makes the duplication
 * worth factoring out.
 */

const BRAND_INDIGO = '#4f46e5';
const BRAND_INK = '#0f172a';
const BRAND_MUTED = '#64748b';
const BRAND_BORDER = '#e2e8f0';
const BRAND_BG = '#f8fafc';

interface EmailLayoutArgs {
  /** e.g. "NDYAPPS" or "NDY HUB" — whichever product initiated the flow. */
  productName: string;
  preheader: string;
  greeting: string;
  intro: string;
  /** The link the button points at. */
  actionUrl: string;
  actionLabel: string;
  /** e.g. "This link expires in 24 hours." */
  expiryNote: string;
  logoUrl?: string;
}

function emailLayout({
  productName,
  preheader,
  greeting,
  intro,
  actionUrl,
  actionLabel,
  expiryNote,
  logoUrl,
}: EmailLayoutArgs): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${productName}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND_BG}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preheader: hidden preview text shown in inbox lists, not in the body -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND_BG}; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:16px; border:1px solid ${BRAND_BORDER}; overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px; text-align:center; border-bottom:1px solid ${BRAND_BORDER};">
              ${
                logoUrl
                  ? `<img src="${logoUrl}" alt="NDY HUB" width="40" height="34" style="display:block; margin:0 auto 12px;" />`
                  : ''
              }
              <div style="font-size:15px; font-weight:700; letter-spacing:0.08em; color:${BRAND_INK}; text-transform:uppercase;">${productName}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; font-size:16px; line-height:1.5; color:${BRAND_INK};">${greeting}</p>
              <p style="margin:0 0 28px; font-size:15px; line-height:1.6; color:${BRAND_MUTED};">${intro}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:10px; background-color:${BRAND_INDIGO};">
                    <a href="${actionUrl}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">${actionLabel}</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:${BRAND_MUTED};">${expiryNote}</p>
              <p style="margin:0; font-size:13px; line-height:1.5; color:${BRAND_MUTED};">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; text-align:center; background-color:${BRAND_BG}; border-top:1px solid ${BRAND_BORDER};">
              <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:${BRAND_MUTED};">${productName} — Powered by NDY HUB</p>
              <p style="margin:0; font-size:12px; color:${BRAND_MUTED};">One Identity. One Passport. One Ecosystem.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function verificationEmail(args: {
  fullName: string | null;
  verifyUrl: string;
  logoUrl?: string;
  productName?: string;
}): { subject: string; html: string } {
  const productName = args.productName ?? 'NDYAPPS';
  const greeting = args.fullName ? `Hello ${args.fullName},` : 'Hello,';
  return {
    subject: `Your ${productName} Verification Code`,
    html: emailLayout({
      productName,
      preheader: `Confirm your email to activate your NDY Identity.`,
      greeting,
      intro: `Welcome to ${productName}. Confirm your email address below to activate your NDY Identity and finish setting up your account.`,
      actionUrl: args.verifyUrl,
      actionLabel: 'Verify Email Address',
      expiryNote: 'This link expires in 24 hours.',
      logoUrl: args.logoUrl,
    }),
  };
}

export function passwordResetEmail(args: {
  fullName: string | null;
  resetUrl: string;
  logoUrl?: string;
  productName?: string;
}): { subject: string; html: string } {
  const productName = args.productName ?? 'NDY HUB';
  const greeting = args.fullName ? `Hello ${args.fullName},` : 'Hello,';
  return {
    subject: `Reset Your ${productName} Password`,
    html: emailLayout({
      productName,
      preheader: 'Reset your NDY HUB password.',
      greeting,
      intro: `We received a request to reset the password for your NDY Identity. Click below to choose a new one.`,
      actionUrl: args.resetUrl,
      actionLabel: 'Reset Password',
      expiryNote: 'This link expires in 1 hour.',
      logoUrl: args.logoUrl,
    }),
  };
}
