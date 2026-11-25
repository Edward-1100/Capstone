import { IsUUID } from 'class-validator';
import { TimelineDatesDto } from './timeline-dates.dto';

export class CreateTimelineEntryDto extends TimelineDatesDto {
  @IsUUID('all', {message: 'entryId must be a valid id'})
  entryId: string;
}
