import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsUrl()
  profilePhotoUrl?: string;

  // --- Passport Card fields (all optional — see schema comment on User) ---

  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(56)
  country?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @IsOptional()
  @IsUrl()
  xUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  bioIsPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  countryIsPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  websiteIsPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  socialsIsPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  businessIsPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  phoneIsPublic?: boolean;
}
