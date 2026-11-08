import { IsIn } from 'class-validator';

export class MemberRoleDto {
  @IsIn(['viewer', 'editor'], {message: 'role must be viewer or editor'})
  role: 'viewer' | 'editor';
}
