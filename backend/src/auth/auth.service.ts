import { ConflictException, Injectable, UnauthorizedException, } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.users.create(
        email,
        dto.username.trim(),
        passwordHash,
      );
      return this.issueToken(user);
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.toLowerCase().trim());
    const valid = user && (await bcrypt.compare(dto.password, user.password_hash));

    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueToken(user);
  }

  private async issueToken(user: {
    id: string;
    email: string;
    username: string;
  }) {

    const accessToken = await this.jwt.signAsync({sub: user.id});
    return {
      accessToken,
      user: {id: user.id, email: user.email, username: user.username},
    };
    
  }

}
