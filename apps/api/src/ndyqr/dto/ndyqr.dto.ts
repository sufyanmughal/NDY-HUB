import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NdyQrType } from '@prisma/client';

/** Brand colors must be plain hex so they can be interpolated into SVG/canvas
 * safely on the renderer side — never arbitrary CSS. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export class CreateNdyQrDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  // Absolute URL only — this is what a scan resolves to. The whole point of
  // a dynamic QR is that this stays editable after the code is printed.
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  destination!: string;

  @IsOptional()
  @IsEnum(NdyQrType)
  type?: NdyQrType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaign?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brandStyle?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'colorFrom must be a hex color like #e600f0' })
  colorFrom?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'colorTo must be a hex color like #38bdf8' })
  colorTo?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;
}

export class UpdateNdyQrDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  destination?: string;

  @IsOptional()
  @IsEnum(NdyQrType)
  type?: NdyQrType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  campaign?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  brandStyle?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'colorFrom must be a hex color like #e600f0' })
  colorFrom?: string;

  @IsOptional()
  @Matches(HEX_COLOR, { message: 'colorTo must be a hex color like #38bdf8' })
  colorTo?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  logoUrl?: string;
}
