import { IsBoolean } from 'class-validator';

export class RuleEntryDto {
  @IsBoolean({message: 'exclude must be true or false'})
  exclude: boolean;
}
