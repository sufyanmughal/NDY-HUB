import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewIdentityVerificationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
