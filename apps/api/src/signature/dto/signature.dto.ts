import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** sha256 hex digest — the only shape contentHash may take, so a caller can
 * never pass raw document bytes (or an arbitrary string) into a field that is
 * meant to be a hash. Raw bytes never belong in this domain; use contentRef. */
const SHA256_HEX = /^[a-f0-9]{64}$/i;

export class SignatureSignerDto {
  /** An existing NDY HUB user to sign. Optional — a signer may instead be
   * identified only by email (invitedEmail) and gets bound to a real account
   * when they sign in. At least one of userId/email must be present; that is
   * enforced in the service (kept out of the DTO so the error can name the
   * offending signer index). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateSignatureRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @Matches(SHA256_HEX, {
    message: 'contentHash must be a sha256 hex digest (64 hex characters)',
  })
  contentHash!: string;

  /** Where the actual document lives — a DriveFile id or an external URL.
   * Never the document bytes. */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  contentRef?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SignatureSignerDto)
  signers!: SignatureSignerDto[];
}

export class SignDocumentDto {
  /** Explicit intent-to-sign acknowledgement. The exact consent language and
   * whether it is legally binding is an OPEN decision (see
   * docs/phase8-signature-trust-design.md §5.3) — it is accepted here for the
   * UI flow but not yet persisted on the signature record. Do not present this
   * as legally-binding e-signature until that decision is made. */
  @IsOptional()
  @IsBoolean()
  consent?: boolean;
}
