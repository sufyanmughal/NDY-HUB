import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class CreateWorkspaceInviteDto {
  @IsEmail()
  invitedEmail!: string;

  @IsEnum(WorkspaceRole)
  invitedRole!: WorkspaceRole;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invitedDepartment?: string;
}
