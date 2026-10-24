import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DeleteEntryTypeDto {
  @IsString()
  confirmName: string;

  @IsOptional()
  @IsUUID()
  moveToTypeId?: string;
}
