import { IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class UpdateEntryDto {
  @IsInt({message: 'version must be a whole number'})
  @Min(1, {message: 'version must be 1 or higher'})
  version: number;

  @IsOptional()
  @IsString()
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(100, {message: 'name can only be up to 100 characters'})
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000, {message: 'description can only be up to 20000 characters'})
  description?: string;

  @IsOptional()
  @IsUUID('all', {message: 'typeId must be a valid id'})
  typeId?: string | null;

  @IsOptional()
  @IsObject({message: 'fields must be an object'})
  fields?: Record<string, any>;
}
