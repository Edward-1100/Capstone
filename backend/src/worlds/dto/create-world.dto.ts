import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateWorldDto {
  @IsString()
  @Matches(/\S/, {message: 'Name can not be blank'})
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['public', 'private'], {message: 'Visibility must be either public or private'})
  visibility?: string;
}
