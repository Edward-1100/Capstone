import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';

export class SaveRuleDto {
  @IsOptional()
  @IsIn(['all', 'any'], {message: 'match must be all or any'})
  match?: string;

  @IsOptional()
  @IsArray({message: 'conditions must be a list'})
  @ArrayMaxSize(20, {message: 'A rule can have up to 20 conditions'})
  conditions?: any[];
}
