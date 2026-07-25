import { IsString, MinLength, MaxLength } from 'class-validator';

export class ReplySupportTicketDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  reply!: string;
}
