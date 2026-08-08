import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SinchClient, Verification } from '@sinch/sdk-core';

/**
 * Thin wrapper around Sinch's Verification API — same dev-mode-fallback
 * pattern as MailService: without real SINCH_APPLICATION_KEY/SECRET, this
 * logs what would have happened instead of throwing, so SMS 2FA setup
 * stays inert (not crashing) in local dev without a live Sinch account.
 * Sinch owns the OTP itself here — we never generate, store, or hash a
 * code for this flow, unlike email verification/password reset. Neither
 * method throws; callers get a plain success/failure signal instead.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: SinchClient | null;

  constructor(private readonly config: ConfigService) {
    const applicationKey = this.config.get<string>('SINCH_APPLICATION_KEY');
    const applicationSecret = this.config.get<string>(
      'SINCH_APPLICATION_SECRET',
    );
    this.client =
      applicationKey && applicationSecret
        ? new SinchClient({ applicationKey, applicationSecret })
        : null;
  }

  /** Starts a new SMS verification, sending a one-time code to the given
   * E.164 number. Returns true once Sinch has accepted the send request —
   * there's no local id/code to hold onto, checkVerification() re-queries
   * Sinch by phone number instead. */
  async startVerification(phoneE164: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(
        `SINCH_APPLICATION_KEY not configured — would have sent an SMS code to ${phoneE164}`,
      );
      return false;
    }

    try {
      const request = Verification.startVerificationHelper.buildSmsRequest(
        phoneE164,
      );
      await this.client.verification.verifications.startSms(request);
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to start SMS verification for ${phoneE164}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Checks a user-submitted code against Sinch's records for the given
   * (already-verified-once, or currently-pending) phone number. Sinch
   * signals a wrong/expired code via a 200 response with
   * status !== 'SUCCESSFUL', not a non-2xx status — checked here, not
   * inferred from a thrown error. */
  async checkVerification(
    phoneE164: string,
    code: string,
  ): Promise<boolean> {
    if (!this.client) {
      this.logger.warn(
        `SINCH_APPLICATION_KEY not configured — cannot check SMS code for ${phoneE164}`,
      );
      return false;
    }

    try {
      const request =
        Verification.reportVerificationByIdentityHelper.buildSmsRequest(
          phoneE164,
          code,
        );
      const response =
        await this.client.verification.verifications.reportSmsByIdentity(
          request,
        );
      return response.status === 'SUCCESSFUL';
    } catch (err) {
      this.logger.error(
        `Failed to check SMS verification for ${phoneE164}: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
