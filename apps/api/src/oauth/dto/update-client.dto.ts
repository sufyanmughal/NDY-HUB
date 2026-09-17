import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Same redirect URI pattern as CreateClientDto — kept in sync deliberately,
// not imported, since these two DTOs are allowed to diverge later (e.g. if
// update ever needs a different validation rule) without one silently
// affecting the other.
const REDIRECT_URI_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:(\/\/)?.+/;

// Everything optional — a PATCH only sends the fields actually being
// changed, same convention as every other partial-update DTO in this
// codebase. clientId/clientType/secret are deliberately absent — see
// OAuthClientService.update's doc comment for why those aren't editable.
export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @Matches(REDIRECT_URI_PATTERN, {
    each: true,
    message:
      'each redirect URI must include a scheme, e.g. https://... or a custom scheme like ndjoyit://callback',
  })
  redirectUris?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedScopes?: string[];
}
