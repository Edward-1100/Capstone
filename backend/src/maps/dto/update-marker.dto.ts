import { IsNumber, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class UpdateMarkerDto {
  @IsOptional()
  @IsNumber({}, {message: 'x must be a number'})
  @Min(0, {message: 'x must be between 0 and 1'})
  @Max(1, {message: 'x must be between 0 and 1'})
  x?: number;

  @IsOptional()
  @IsNumber({}, {message: 'y must be a number'})
  @Min(0, {message: 'y must be between 0 and 1'})
  @Max(1, {message: 'y must be between 0 and 1'})
  y?: number;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {message: 'color must be in proper hex format: (#416600)'})
  color?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {message: 'innerColor must be in proper hex format: (#416600)'})
  innerColor?: string;

  @IsOptional()
  @IsUUID('all', {message: 'imageId must be a valid id'})
  imageId?: string | null;

  @IsOptional()
  @IsNumber({}, {message: 'imageScale must be a number'})
  @Min(1, {message: 'imageScale must be between 1 and 4'})
  @Max(4, {message: 'imageScale must be between 1 and 4'})
  imageScale?: number;

  @IsOptional()
  @IsNumber({}, {message: 'imageX must be a number'})
  @Min(-1, {message: 'imageX must be between -1 and 1'})
  @Max(1, {message: 'imageX must be between -1 and 1'})
  imageX?: number;

  @IsOptional()
  @IsNumber({}, {message: 'imageY must be a number'})
  @Min(-1, {message: 'imageY must be between -1 and 1'})
  @Max(1, {message: 'imageY must be between -1 and 1'})
  imageY?: number;
}
