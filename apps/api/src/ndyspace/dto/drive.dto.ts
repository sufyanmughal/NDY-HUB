import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDriveFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

export class MoveDriveFileDto {
  @IsOptional()
  @IsString()
  folderId?: string | null;
}
