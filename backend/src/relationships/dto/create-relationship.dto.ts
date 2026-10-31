import { IsUUID } from 'class-validator';

export class CreateRelationshipDto {
  @IsUUID('all', {message: 'typeId must be a valid id'})
  typeId: string;

  @IsUUID('all', {message: 'fromEntryId must be a valid id'})
  fromEntryId: string;

  @IsUUID('all', {message: 'toEntryId must be a valid id'})
  toEntryId: string;
}
