import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class ConfirmEmailDto {
  @IsEmail()
  email!: string;

  // 6-digit numeric code, typed in from the email — same shape as
  // ResetPasswordDto.code, and for the same reason: a 6-digit code isn't
  // globally unique enough to look up on its own, so the lookup needs
  // email + code together.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
