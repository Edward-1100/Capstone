import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateRelationshipTypeDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(50, {message: 'name can only be up to 50 characters'})
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, {message: 'description can only be up to 500 characters'})
  description?: string;

  @IsOptional()
  @IsBoolean({message: 'fromAny must be true or false'})
  fromAny?: boolean;

  @IsOptional()
  @IsArray({message: 'fromTypeIds must be a list'})
  @ArrayMaxSize(200, {message: 'fromTypeIds can only have up to 200 types'})
  @ArrayUnique({message: 'fromTypeIds can not repeat a type'})
  @IsUUID('all', {each: true, message: 'fromTypeIds must be valid ids'})
  fromTypeIds?: string[];

  @IsOptional()
  @IsBoolean({message: 'toAny must be true or false'})
  toAny?: boolean;

  @IsOptional()
  @IsArray({message: 'toTypeIds must be a list'})
  @ArrayMaxSize(200, {message: 'toTypeIds can only have up to 200 types'})
  @ArrayUnique({message: 'toTypeIds can not repeat a type'})
  @IsUUID('all', {each: true, message: 'toTypeIds must be valid ids'})
  toTypeIds?: string[];

  @IsOptional()
  @IsBoolean({message: 'confirmRemove must be true or false'})
  confirmRemove?: boolean;
}
