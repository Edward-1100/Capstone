import { IsString } from 'class-validator';

export class DeleteRelationshipTypeDto {
  @IsString()
  confirmName: string;
}
