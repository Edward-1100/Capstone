import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export const NEST_MODES = ['none', 'chosen', 'all', 'own'];

export class NestingDto {
  @IsIn(NEST_MODES, {message: 'mode must be none, chosen, all, or own'})
  mode: string;

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
