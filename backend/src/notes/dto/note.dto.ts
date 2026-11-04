import { IsString, Matches, MaxLength } from 'class-validator';

export class NoteDto {
  @IsString({message: 'note must be text'})
  @Matches(/\S/, {message: 'note can not be blank'})
  @MaxLength(5000, {message: 'note can only be up to 5000 characters'})
  body: string;
}
