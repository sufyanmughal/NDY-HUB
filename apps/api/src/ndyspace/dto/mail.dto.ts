import {
  IsArray,
  IsBoolean,
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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccNdyIds?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentDriveFileIds?: string[];
}

export class SaveDraftDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientNdyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccNdyIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentDriveFileIds?: string[];

  // Present when editing an existing draft (its EmailRecipient row id) —
  // absent means "create a new draft".
  @IsOptional()
  @IsString()
  draftId?: string;
}

export class SendDraftDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientNdyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccNdyIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentDriveFileIds?: string[];
}

export class UpdateEmailRecipientDto {
  @IsOptional()
  @IsIn(['INBOX', 'SENT', 'DRAFTS', 'TRASH'])
  folder?: 'INBOX' | 'SENT' | 'DRAFTS' | 'TRASH';

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsBoolean()
  isStarred?: boolean;
}
