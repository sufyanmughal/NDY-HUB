import { IsString, Matches } from 'class-validator';

export class Sms2faSetupDto {
  // E.164: leading +, 1-15 digits total, first digit non-zero.
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/)
  phoneE164!: string;
}
