import { IsObject, IsOptional } from 'class-validator';

export class ExportDto {
  @IsObject({message: 'select must be an object'})
  select: Record<string, any>;

  @IsOptional()
  @IsObject({message: 'options must be an object'})
  options?: Record<string, any>;
}
