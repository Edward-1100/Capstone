import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class CreateEntryDto {
  @IsString()
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(100, {message: 'name can only be up to 100 characters'})
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000, {message: 'description can only be up to 20000 characters'})
  description?: string;

  @IsOptional()
  @IsUUID('all', {message: 'typeId must be a valid id'})
  typeId?: string | null;
}
