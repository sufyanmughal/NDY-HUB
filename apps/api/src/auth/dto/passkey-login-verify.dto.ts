import { IsObject, IsString } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class PasskeyLoginVerifyDto {
  @IsString()
  challengeId!: string;

  // See PasskeyRegisterVerifyDto for why this stays a plain object —
  // verifyAuthenticationResponse validates its shape itself.
  @IsObject()
  response!: AuthenticationResponseJSON;
}
