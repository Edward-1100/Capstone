import { IsString } from 'class-validator';

export class DeleteWorldDto {
  @IsString()
  confirmName: string;
}
