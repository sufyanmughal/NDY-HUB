import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { OAuthClientType } from '@prisma/client';

// class-validator's @IsUrl rejects custom URI schemes (ndjoyit://callback,
// com.ndjoyit.app:/oauthredirect) by default — exactly the redirect_uri
// shape a native/mobile OAuth client needs (RFC 8252). Loosened to "looks
// like scheme://... or scheme:/..." rather than requiring http(s), while
// still rejecting anything with no scheme at all (a bare path/host isn't
// a valid redirect target for any client type).
const REDIRECT_URI_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:(\/\/)?.+/;

export class CreateClientDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @Matches(REDIRECT_URI_PATTERN, {
    each: true,
    message:
      'each redirect URI must include a scheme, e.g. https://... or a custom scheme like ndjoyit://callback',
  })
  redirectUris!: string[];

  @IsArray()
  @IsString({ each: true })
  allowedScopes!: string[];

  // Defaults to CONFIDENTIAL (existing behavior, unchanged) — an admin
  // registering a native/mobile app must explicitly opt into PUBLIC.
  // See OAuthClientType's schema doc comment for what each means.
  @IsOptional()
  @IsEnum(OAuthClientType)
  clientType?: OAuthClientType;
}
