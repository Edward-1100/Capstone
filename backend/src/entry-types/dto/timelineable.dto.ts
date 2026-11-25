import { IsBoolean } from 'class-validator';

export class TimelineableDto {
  @IsBoolean({message: 'timelineable must be true or false'})
  timelineable: boolean;
}
