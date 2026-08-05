import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // Full name is the only passport field that's actually required — it's
  // what gates DashboardGate's passportComplete check (see auth.service's
  // getMe()). Kept optional here at the DTO level only because OAuth/passkey
  // signups (social-auth.service.ts) can't collect it upfront and route
  // through /passport/complete afterwards instead; the password registration
  // form on the client always sends it.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  // --- Passport Card fields, collected up front by the real registration
  // form (components/register-form.tsx) so users fill these in once, at
  // account creation, instead of being routed through a separate step
  // later. All still optional here since OAuth/passkey signups skip this
  // form entirely and fill these in later via /passport/complete or
  // Settings. Mirrors UpdateProfileDto exactly. ---

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
}
