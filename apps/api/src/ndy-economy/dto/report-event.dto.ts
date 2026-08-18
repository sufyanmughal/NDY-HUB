import { IsString, MinLength } from 'class-validator';

export class ReportEventDto {
  @IsString()
  @MinLength(1)
  eventKey!: string;

  // The permanent internal userId (uuid), not the public ndyId — per the
  // client's explicit "every API action must use the permanent NDYHUB
  // UUID internally, never rely only on the public NDY ID" requirement.
  @IsString()
  @MinLength(1)
  userId!: string;

  @IsString()
  @MinLength(1)
  sourceEventId!: string;
}
