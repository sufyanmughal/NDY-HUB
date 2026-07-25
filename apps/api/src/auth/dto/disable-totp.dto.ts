import { IsString } from 'class-validator';

export class DisableTotpDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  code!: string;
}
