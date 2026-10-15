import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async findByEmail(email: string) {
    const result = await this.db.query(
      'SELECT id, email, username, password_hash FROM users WHERE email = $1',
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string) {
    const result = await this.db.query(
      'SELECT id, email, username FROM users WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async create(email: string, username: string, passwordHash: string) {
    const result = await this.db.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username`,
      [email, username, passwordHash],
    );
    return result.rows[0];
  }
}
