import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class ConsentDto {
  @IsString()
  clientId!: string;

  @IsString()
  redirectUri!: string;

  @IsString()
  scope!: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsBoolean()
  approve!: boolean;

  // Echoed back from the query string the browser landed on /oauth/consent
  // with (itself forwarded from /oauth/authorize) — this endpoint is a
  // fresh trust boundary (a POST body, not guaranteed to have come from
  // that redirect), so codeChallengeMethod is still validated here rather
  // than trusted just because the GET step already checked it once.
  @IsOptional()
  @IsString()
  codeChallenge?: string;

  @IsOptional()
  @IsIn(['S256'])
  codeChallengeMethod?: string;
}
