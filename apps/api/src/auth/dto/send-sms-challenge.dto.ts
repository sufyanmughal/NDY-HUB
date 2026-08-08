import { IsString } from 'class-validator';

export class SendSmsChallengeDto {
  @IsString()
  challengeToken!: string;
}
