import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptWorkspaceInviteDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
