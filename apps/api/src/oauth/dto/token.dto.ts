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

  // Optional at the DTO level — required for CONFIDENTIAL clients, absent
  // for PUBLIC ones (native/mobile apps never have a secret to send, see
  // OAuthClientType). TokenController enforces which is actually required
  // once it knows the client's type, same "controller checks what
  // grant_type/client_type actually require" discipline as every other
  // conditional field here.
  @IsOptional()
  @IsString()
  client_secret?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  refresh_token?: string;

  // Required only if the authorization_code was issued with a
  // code_challenge — checked in the controller, not here, since that
  // depends on the code being redeemed first.
  @IsOptional()
  @IsString()
  code_verifier?: string;
}
