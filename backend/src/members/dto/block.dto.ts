import { IsString, Matches, MaxLength } from 'class-validator';

export class BlockDto {
  @IsString({message: 'username must be text'})
  @Matches(/\S/, {message: 'username can not be blank'})
  @MaxLength(45, {message: 'username can only be up to 45 characters'})
  username: string;
}
