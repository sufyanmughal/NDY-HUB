import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({ require_tld: false }, { each: true })
  redirectUris!: string[];

  @IsArray()
  @IsString({ each: true })
  allowedScopes!: string[];
}
