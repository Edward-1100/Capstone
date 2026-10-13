import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(45)
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
