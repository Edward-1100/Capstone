import { IsNumber, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class CreateMarkerDto {
  @IsUUID('all', {message: 'entryId must be a valid id'})
  entryId: string;

  @IsNumber({}, {message: 'x must be a number'})
  @Min(0, {message: 'x must be between 0 and 1'})
  @Max(1, {message: 'x must be between 0 and 1'})
  x: number;

  @IsNumber({}, {message: 'y must be a number'})
  @Min(0, {message: 'y must be between 0 and 1'})
  @Max(1, {message: 'y must be between 0 and 1'})
  y: number;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {message: 'color must be in proper hex format: (#416600)'})
  color?: string;

  @IsOptional()
  @IsUUID('all', {message: 'imageId must be a valid id'})
  imageId?: string | null;
}
