import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(50, {message: 'name can only be up to 50 characters'})
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {message: 'color must be in proper hex format: (#416600)'})
  color?: string | null;
}
