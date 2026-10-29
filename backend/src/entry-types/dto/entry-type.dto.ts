import { IsString, Matches, MaxLength } from 'class-validator';

export class EntryTypeDto {
  @IsString()
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(50, {message: 'name can only be up to 50 characters'})
  name: string;
}
