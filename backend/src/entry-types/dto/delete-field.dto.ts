import { IsString } from 'class-validator';

export class DeleteFieldDto {
  @IsString()
  confirmName: string;
}
