import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email!: string;

  // Same deep-link routing hint as RegisterDto.clientId — see
  // verification-redirect.util.ts.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientId?: string;
}
