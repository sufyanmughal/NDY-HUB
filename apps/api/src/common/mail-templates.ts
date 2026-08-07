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
// Sampled from the four corners of the actual NDJOYIT HUB logo artwork
// (public/email-logo.jpeg — a soft pink/lilac/blue gradient background
// baked into the image itself, not a transparent mark) so the email's own
// background reads as a continuation of the logo rather than a visible
// seam where a plain white card meets a colorful image.
const BRAND_BG = '#eef0f5';
const BRAND_BORDER = '#e4e1ee';

interface EmailLayoutArgs {
  /** e.g. "NDYAPPS" or "NDY HUB" — whichever product initiated the flow. */
  productName: string;
  preheader: string;
  greeting: string;
  intro: string;
  /** Clickable-button mode (verification email). Mutually exclusive with
   * `code` — exactly one of the two is provided by each caller. */
  actionUrl?: string;
  actionLabel?: string;
  /** Typed-in-code mode (password reset). A large, letter-spaced digit
   * block instead of a button — nothing to click, the user reads it and
   * types it into the app. */
  code?: string;
  /** e.g. "This code expires in 4 minutes and 59 seconds." */
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
  code,
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
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:${BRAND_BG}; border-radius:16px; border:1px solid ${BRAND_BORDER}; overflow:hidden;">

          <!-- Header — the logo artwork carries its own soft gradient
               background, matched by BRAND_BG above, so it sits directly
               on the card with no white seam around it. -->
          <tr>
            <td style="padding:32px 32px 8px; text-align:center;">
              ${
                logoUrl
                  ? `<img src="${logoUrl}" alt="NDJOYIT HUB" width="220" style="display:block; margin:0 auto; max-width:100%; height:auto; border-radius:12px;" />`
                  : `<div style="font-size:15px; font-weight:700; letter-spacing:0.08em; color:${BRAND_INK}; text-transform:uppercase;">${productName}</div>`
              }
            </td>
          </tr>

          <!-- Body — a white inner panel, so the code/button still has
               real contrast against the tinted card background above. -->
          <tr>
            <td style="padding:8px 16px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px;">
                <tr>
                  <td style="padding:28px 28px 24px;">
                    <p style="margin:0 0 16px; font-size:16px; line-height:1.5; color:${BRAND_INK};">${greeting}</p>
                    <p style="margin:0 0 28px; font-size:15px; line-height:1.6; color:${BRAND_MUTED};">${intro}</p>

                    ${
                      code
                        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td style="border-radius:10px; background-color:${BRAND_BG}; border:1px solid ${BRAND_BORDER}; padding:18px 32px;">
                          <span style="display:block; font-size:32px; font-weight:700; letter-spacing:0.3em; color:${BRAND_INK}; font-family:'SF Mono',Consolas,Menlo,monospace;">${code}</span>
                        </td>
                      </tr>
                    </table>`
                        : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                      <tr>
                        <td style="border-radius:10px; background-color:${BRAND_INDIGO};">
                          <a href="${actionUrl}" target="_blank" style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">${actionLabel}</a>
                        </td>
                      </tr>
                    </table>`
                    }

                    <p style="margin:0 0 8px; font-size:13px; line-height:1.5; color:${BRAND_MUTED};">${expiryNote}</p>
                    <p style="margin:0; font-size:13px; line-height:1.5; color:${BRAND_MUTED};">If you didn't request this, you can safely ignore this email.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 32px; text-align:center;">
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
      expiryNote: 'This link expires in 4 minutes and 59 seconds.',
      logoUrl: args.logoUrl,
    }),
  };
}

export function passwordResetEmail(args: {
  fullName: string | null;
  code: string;
  logoUrl?: string;
  productName?: string;
}): { subject: string; html: string } {
  const productName = args.productName ?? 'NDY HUB';
  const greeting = args.fullName ? `Hello ${args.fullName},` : 'Hello,';
  return {
    subject: `Your ${productName} Password Reset Code`,
    html: emailLayout({
      productName,
      preheader: 'Use this code to reset your NDY HUB password.',
      greeting,
      intro: `We received a request to reset the password for your NDY Identity. Enter the code below to continue.`,
      code: args.code,
      expiryNote: 'This code expires in 4 minutes and 59 seconds.',
      logoUrl: args.logoUrl,
    }),
  };
}
