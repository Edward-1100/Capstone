import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BlocksService {
  constructor(private readonly db: DatabaseService) {}

  list(userId: string) {
    return this.db
      .query(
        `SELECT b.blocked_user_id AS "userId", u.username, b.created_at AS "createdAt"
         FROM user_blocks b
         JOIN users u ON u.id = b.blocked_user_id
         WHERE b.user_id = $1
         ORDER BY lower(u.username)`,
        [userId],
      )
      .then((result) => result.rows);
  }

  async add(userId: string, username: string) {
    const found = await this.db.query('SELECT id FROM users WHERE lower(username) = lower($1)', [username.trim()]);
    const target = found.rows[0];

    if (!target) {
      throw new NotFoundException('No user with that username');
    }

    if (target.id === userId) {
      throw new BadRequestException('You can not block yourself');
    }

    await this.db.query(
      'INSERT INTO user_blocks (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, target.id],
    );

    return this.list(userId);
  }

  async remove(userId: string, blockedUserId: string) {
    await this.db.query('DELETE FROM user_blocks WHERE user_id = $1 AND blocked_user_id = $2', [userId, blockedUserId]);

    return this.list(userId);
  }
}
