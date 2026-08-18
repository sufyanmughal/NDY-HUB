import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBusinessWorkspaceRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  businessName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
