import { IsOptional, IsString } from 'class-validator';

// Apple posts this as application/x-www-form-urlencoded (response_mode=form_post
// is required whenever the authorize request asks for name/email scopes).
// `user` is only ever present on the very first authorization — a JSON
// string (not an object; Apple sends it as one more form field) with
// whatever of {name, email} the user allowed through, since Apple's
// id_token itself never carries a name claim.
export class AppleCallbackDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  user?: string;
}
