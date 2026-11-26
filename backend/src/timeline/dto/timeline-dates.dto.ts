import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class TimelineDatesDto {
  @IsInt({message: 'startYear must be a whole number between -1000000 and 1000000'})
  @Min(-1000000, {message: 'startYear must be a whole number between -1000000 and 1000000'})
  @Max(1000000, {message: 'startYear must be a whole number between -1000000 and 1000000'})
  startYear: number;

  @IsOptional()
  @IsInt({message: 'startMonth must be a whole number between 1 and 12'})
  @Min(1, {message: 'startMonth must be a whole number between 1 and 12'})
  @Max(12, {message: 'startMonth must be a whole number between 1 and 12'})
  startMonth?: number | null;

  @IsOptional()
  @IsInt({message: 'startDay must be a whole number between 1 and 31'})
  @Min(1, {message: 'startDay must be a whole number between 1 and 31'})
  @Max(31, {message: 'startDay must be a whole number between 1 and 31'})
  startDay?: number | null;

  @IsOptional()
  @IsInt({message: 'startHour must be a whole number between 0 and 23'})
  @Min(0, {message: 'startHour must be a whole number between 0 and 23'})
  @Max(23, {message: 'startHour must be a whole number between 0 and 23'})
  startHour?: number | null;

  @IsOptional()
  @IsInt({message: 'startMinute must be a whole number between 0 and 59'})
  @Min(0, {message: 'startMinute must be a whole number between 0 and 59'})
  @Max(59, {message: 'startMinute must be a whole number between 0 and 59'})
  startMinute?: number | null;

  @IsOptional()
  @IsInt({message: 'endYear must be a whole number between -1000000 and 1000000'})
  @Min(-1000000, {message: 'endYear must be a whole number between -1000000 and 1000000'})
  @Max(1000000, {message: 'endYear must be a whole number between -1000000 and 1000000'})
  endYear?: number | null;

  @IsOptional()
  @IsInt({message: 'endMonth must be a whole number between 1 and 12'})
  @Min(1, {message: 'endMonth must be a whole number between 1 and 12'})
  @Max(12, {message: 'endMonth must be a whole number between 1 and 12'})
  endMonth?: number | null;

  @IsOptional()
  @IsInt({message: 'endDay must be a whole number between 1 and 31'})
  @Min(1, {message: 'endDay must be a whole number between 1 and 31'})
  @Max(31, {message: 'endDay must be a whole number between 1 and 31'})
  endDay?: number | null;

  @IsOptional()
  @IsInt({message: 'endHour must be a whole number between 0 and 23'})
  @Min(0, {message: 'endHour must be a whole number between 0 and 23'})
  @Max(23, {message: 'endHour must be a whole number between 0 and 23'})
  endHour?: number | null;

  @IsOptional()
  @IsInt({message: 'endMinute must be a whole number between 0 and 59'})
  @Min(0, {message: 'endMinute must be a whole number between 0 and 59'})
  @Max(59, {message: 'endMinute must be a whole number between 0 and 59'})
  endMinute?: number | null;
}
