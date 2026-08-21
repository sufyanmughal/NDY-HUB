import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class ReportEcosystemEventDto {
  @IsString()
  @MinLength(1)
  eventType!: string;

  // The permanent internal userId (uuid), never the public ndyId — per
  // the client's explicit "every product should reference the same
  // permanent internal NDYHUB UUID" requirement, same convention already
  // used by ndy-economy's ReportEventDto.
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  sourceEventId!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
