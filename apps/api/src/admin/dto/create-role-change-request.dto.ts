import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateRoleChangeRequestDto {
  @IsUUID()
  targetUserId!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  reason?: string;
}
