import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConsentDto {
  @IsString()
  clientId!: string;

  @IsString()
  redirectUri!: string;

  @IsString()
  scope!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsBoolean()
  approve!: boolean;
}
