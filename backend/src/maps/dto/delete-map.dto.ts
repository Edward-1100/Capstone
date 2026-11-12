import { IsString } from 'class-validator';

export class DeleteMapDto {
  @IsString()
  confirmName: string;
}
