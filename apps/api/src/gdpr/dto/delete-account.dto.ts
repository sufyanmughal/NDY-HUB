import { Equals, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  currentPassword!: string;

  // A typed confirmation phrase, on top of the password check — the same
  // "type DELETE to confirm" pattern used everywhere destructive account
  // actions live, so a single stray click can't trigger it.
  @Equals('DELETE')
  confirm!: string;
}
