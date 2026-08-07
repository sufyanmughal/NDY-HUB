import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Thin wrapper around Resend — same dev-mode-fallback pattern as
 * MembershipService's Stripe warning and PhotoStorageService's local-disk
 * fallback: without a real RESEND_API_KEY, this logs what would have been
 * sent instead of throwing, so register/login/forgot-password flows stay
 * fully testable locally without a live email account. Callers (AuthService)
 * never see the difference — send() never throws even if Resend's API call
 * fails, since a bounced/undeliverable email shouldn't fail the request
 * that triggered it (the token still exists; resend is always available).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    // Placeholder until a real sending domain is verified with Resend —
    // swap via env, no code change needed once ndyhub.com (or whichever
    // domain ends up in hand) is set up.
    this.fromAddress =
      this.config.get<string>('MAIL_FROM') ?? 'NDY HUB <onboarding@resend.dev>';
  }

  async send({ to, subject, html }: SendEmailArgs): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not configured — would have sent "${subject}" to ${to}`,
      );
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(`Resend rejected email to ${to}: ${error.message}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${to}: ${(err as Error).message}`,
      );
    }
  }
}
