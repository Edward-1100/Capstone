import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateMapDto {
  @IsString({message: 'name must be text'})
  @Matches(/\S/, {message: 'name can not be blank'})
  @MaxLength(100, {message: 'name can only be up to 100 characters'})
  name: string;
}
