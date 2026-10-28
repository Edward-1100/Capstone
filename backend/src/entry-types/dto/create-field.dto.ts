import { IsBoolean, IsIn, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FIELD_TYPES } from '../field-values';

export class CreateFieldDto {
  @IsString()
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(50, {message: 'name can only be up to 50 characters'})
  name: string;

  @IsIn(FIELD_TYPES, {message: 'fieldType must be text, long_text, number, boolean, scale, choice, or multi_choice'})
  fieldType: string;

  @IsOptional()
  @IsBoolean({message: 'required must be true or false'})
  required?: boolean;

  @IsOptional()
  @IsObject({message: 'config must be an object'})
  config?: Record<string, any>;
}
