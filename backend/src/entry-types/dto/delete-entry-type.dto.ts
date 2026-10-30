import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class DeleteEntryTypeDto {
  @IsString()
  confirmName: string;

  @IsOptional()
  @IsUUID()
  moveToTypeId?: string;

  @IsOptional()
  @IsBoolean({message: 'confirmUnlink must be true or false'})
  confirmUnlink?: boolean;
}
