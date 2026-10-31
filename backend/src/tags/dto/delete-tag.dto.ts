import { IsString } from 'class-validator';

export class DeleteTagDto {
  @IsString()
  confirmName: string;
}
