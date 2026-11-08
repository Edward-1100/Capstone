import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

export class InviteMemberDto {
  @IsString({message: 'username must be text'})
  @Matches(/\S/, {message: 'username can not be blank'})
  @MaxLength(45, {message: 'username can only be up to 45 characters'})
  username: string;

  @IsIn(['viewer', 'editor'], {message: 'role must be viewer or editor'})
  role: 'viewer' | 'editor';
}
