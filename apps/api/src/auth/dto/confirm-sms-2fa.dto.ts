import { IsString, Matches } from 'class-validator';

export class ConfirmSms2faDto {
  // Resubmitted from the setup step — there's no server-side pending
  // record to look this up from (Sinch owns the in-flight verification,
  // not us), so the frontend carries it in its own step-1-to-step-2 state
  // and sends it again here, same number it just texted a code to.
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/)
  phoneE164!: string;

  @IsString()
  code!: string;
}
