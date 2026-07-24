import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LoginRequestMethod } from '@prisma/client';

export class CreateLoginRequestDto {
  @IsEnum(LoginRequestMethod)
  method!: LoginRequestMethod;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  browser?: string;
}
