import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, {message: 'email must be a valid email'})
  email: string;

  @IsString()
  @MinLength(3, {message: 'username must be 3 characters or longer'})
  @MaxLength(45, {message: 'username can only be up to 45 characters'})
  username: string;

  @IsString()
  @MinLength(6, {message: 'password must be 6 characters or longer'})
  @MaxLength(72, {message: 'password can only be up to 72 characters'})
  password: string;
}
