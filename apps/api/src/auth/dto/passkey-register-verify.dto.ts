import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export class PasskeyRegisterVerifyDto {
  @IsString()
  challengeId!: string;

  // @simplewebauthn/server's verifyRegistrationResponse does the actual
  // structural + cryptographic validation of this — re-declaring its
  // whole nested shape (id, rawId, response.attestationObject,
  // response.clientDataJSON, transports, clientExtensionResults...) as
  // class-validator decorators would just duplicate that, so this stays a
  // plain object and the library rejects anything malformed itself.
  @IsObject()
  response!: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  deviceLabel?: string;
}
