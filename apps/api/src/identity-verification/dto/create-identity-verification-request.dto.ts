import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIdentityVerificationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  evidenceNote?: string;
}
