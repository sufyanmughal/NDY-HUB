import { IsString } from 'class-validator';

export class DisableSms2faDto {
  @IsString()
  currentPassword!: string;
}
