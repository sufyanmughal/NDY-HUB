import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const ORIGIN_TYPES = [
  'user_direct',
  'ai_command',
  'agent',
  'trigger',
  'external_api',
] as const;

export class ActionOriginDto {
  @IsIn(ORIGIN_TYPES)
  type!: (typeof ORIGIN_TYPES)[number];

  @IsOptional()
  @IsString()
  detail?: string;
}

export class SubmitActionDto {
  @IsString()
  @MinLength(1)
  actionKey!: string;

  @IsString()
  @MinLength(1)
  workspaceId!: string;

  @IsObject()
  origin!: ActionOriginDto;

  @IsObject()
  params!: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  intentToken?: string;
}
