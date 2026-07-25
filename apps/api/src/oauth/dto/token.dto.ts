import { IsIn, IsOptional, IsString } from 'class-validator';

// Deliberately loose (most fields optional at the class-validator level) —
// which fields are actually required depends on grant_type, checked in the
// controller so the error message can say exactly what's missing rather
// than a generic validation failure.
export class TokenDto {
  @IsIn(['authorization_code', 'refresh_token'])
  grant_type!: 'authorization_code' | 'refresh_token';

  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  refresh_token?: string;
}
