import { IsOptional, IsString } from 'class-validator';

export class ReviewRoleChangeRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
