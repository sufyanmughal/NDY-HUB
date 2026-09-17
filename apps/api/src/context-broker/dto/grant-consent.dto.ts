import { ArrayNotEmpty, IsArray, IsEnum, IsString, MinLength } from 'class-validator';
import { AiAgentConsentScope } from '@prisma/client';

export class GrantAiAgentConsentDto {
  /** The AI agent's public OAuth client id. */
  @IsString()
  @MinLength(1)
  oauthClientId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AiAgentConsentScope, { each: true })
  scopes!: AiAgentConsentScope[];
}
