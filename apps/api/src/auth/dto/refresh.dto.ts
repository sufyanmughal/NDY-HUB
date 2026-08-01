import { IsOptional, IsString } from 'class-validator';

// Optional: a browser request carries its refresh token in the httpOnly
// cookie instead (see AuthController.refresh/.logout) — the body field
// stays for NDYAPPS and other clients with no cookie jar to rely on.
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
