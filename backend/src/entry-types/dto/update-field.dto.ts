import { IsBoolean, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateFieldDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(50, {message: 'name can only be up to 50 characters'})
  name?: string;

  @IsOptional()
  @IsBoolean({message: 'required must be true or false'})
  required?: boolean;

  @IsOptional()
  @IsObject({message: 'config must be an object'})
  config?: Record<string, any>;

  @IsOptional()
  @IsBoolean({message: 'confirmClear must be true or false'})
  confirmClear?: boolean;
}
