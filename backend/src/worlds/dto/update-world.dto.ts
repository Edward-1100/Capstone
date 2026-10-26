import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateWorldDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/, {message: 'Name can not be blank'})
  @MaxLength(100, {message: 'name can only be up to 100 characters'})
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, {message: 'description can only be up to 5000 characters'})
  description?: string;

  @IsOptional()
  @IsIn(['public', 'private'], {message: 'Visibility must be either public or private'})
  visibility?: string;
}
