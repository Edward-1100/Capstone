import { IsBoolean } from 'class-validator';

export class MappableDto {
  @IsBoolean({message: 'mappable must be true or false'})
  mappable: boolean;
}
