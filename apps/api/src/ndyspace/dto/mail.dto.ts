import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Internal-send only — see the Email model's doc comment. Recipients are
// resolved by NDY ID (the one identifier every NDYSPACE user already has),
// not a free-text email address, since there's no external delivery here.
export class SendEmailDto {
  @IsArray()
  @IsString({ each: true })
  recipientNdyIds!: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;
}

export class UpdateEmailRecipientDto {
  @IsOptional()
  @IsIn(['INBOX', 'SENT', 'DRAFTS', 'TRASH'])
  folder?: 'INBOX' | 'SENT' | 'DRAFTS' | 'TRASH';

  @IsOptional()
  isRead?: boolean;

  @IsOptional()
  isStarred?: boolean;
}
