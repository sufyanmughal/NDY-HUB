import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsString()
  reason?: string;
}
