import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserMemoryType } from '@prisma/client';

export class CreateMemoryDto {
  @IsEnum(UserMemoryType)
  type!: UserMemoryType;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;
}

export class UpdateMemoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content!: string;
}
