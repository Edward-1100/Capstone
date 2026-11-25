import { IsOptional, Matches } from 'class-validator';

export class TimelineColorDto {
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {message: 'color must be in proper hex format: (#416600)'})
  color?: string | null;
}
