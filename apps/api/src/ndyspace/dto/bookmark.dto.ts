import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateBookmarkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  url!: string;
}
