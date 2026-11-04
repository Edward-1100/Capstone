import { IsString, Matches, MaxLength } from 'class-validator';

export class CommentDto {
  @IsString({message: 'comment must be text'})
  @Matches(/\S/, {message: 'comment can not be blank'})
  @MaxLength(5000, {message: 'comment can only be up to 5000 characters'})
  body: string;
}
