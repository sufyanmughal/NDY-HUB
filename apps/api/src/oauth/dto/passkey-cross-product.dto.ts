import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

// Cross-product passkey ceremonies (NDYMAIL and future non-NDYHUB
// products) — same client_id/client_secret authentication as
// TokenController's password grant, since there's no NDYHUB session to
// rely on. See CrossProductPasskeyController's doc comment.
export class BeginCrossProductPasskeyRegistrationDto {
  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;

  // Re-confirms the account's password as proof of identity for starting
  // registration — see PasskeyService/TokenController's doc comments for
  // why a fresh password check is used here instead of reusing the OAuth
  // refresh_token for a purpose it wasn't scoped for.
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

export class VerifyCrossProductPasskeyRegistrationDto {
  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;

  @IsString()
  challengeId!: string;

  @IsObject()
  response!: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  deviceLabel?: string;
}

export class BeginCrossProductPasskeyLoginDto {
  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;
}

export class VerifyCrossProductPasskeyLoginDto {
  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;

  @IsString()
  challengeId!: string;

  @IsObject()
  response!: AuthenticationResponseJSON;
}
