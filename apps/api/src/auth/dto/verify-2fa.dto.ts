import { IsString } from 'class-validator';

export class Verify2faDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  code!: string;
}
