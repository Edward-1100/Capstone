import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class NestingDto {
  @IsBoolean({message: 'nestable must be true or false'})
  nestable: boolean;

  @IsOptional()
  @IsBoolean({message: 'anyParent must be true or false'})
  anyParent?: boolean;

  @IsOptional()
  @IsArray({message: 'parentTypeIds must be a list'})
  @ArrayMaxSize(200, {message: 'parentTypeIds can only have up to 200 types'})
  @ArrayUnique({message: 'parentTypeIds can not repeat a type'})
  @IsUUID('all', {each: true, message: 'parentTypeIds must be valid ids'})
  parentTypeIds?: string[];

  @IsOptional()
  @IsBoolean({message: 'confirmUnlink must be true or false'})
  confirmUnlink?: boolean;
}
