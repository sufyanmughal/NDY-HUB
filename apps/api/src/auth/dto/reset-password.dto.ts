import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  // 6-digit numeric code, typed in from the email — see
  // AuthService.resetPassword for why this needs email + code together
  // rather than the code alone.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
