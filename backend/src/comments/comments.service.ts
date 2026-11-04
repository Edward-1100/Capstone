import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CommentDto } from './dto/comment.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly db: DatabaseService) {}

  private async activeEntry(worldId: string, entryId: string) {
    const result = await this.db.query('SELECT id FROM active_entries WHERE id = $1 AND world_id = $2', [entryId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Entry not found');
    }
  }

  private async find(worldId: string, commentId: string) {
    const result = await this.db.query(
      `SELECT c.id, c.body, c.author_id AS "authorId", u.username AS "authorName",
              c.created_at AS "createdAt", c.updated_at AS "updatedAt", c.updated_at > c.created_at AS edited
       FROM comments c
       JOIN active_entries e ON e.id = c.entry_id
       LEFT JOIN users u ON u.id = c.author_id
       WHERE c.id = $1 AND c.world_id = $2`,
      [commentId, worldId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Comment not found');
    }

    return result.rows[0];
  }

  async list(worldId: string, entryId: string) {
    await this.activeEntry(worldId, entryId);

    const result = await this.db.query(
      `SELECT c.id, c.body, c.author_id AS "authorId", u.username AS "authorName",
              c.created_at AS "createdAt", c.updated_at AS "updatedAt", c.updated_at > c.created_at AS edited
       FROM comments c
       LEFT JOIN users u ON u.id = c.author_id
       WHERE c.entry_id = $1 AND c.world_id = $2
       ORDER BY c.created_at, c.id`,
      [entryId, worldId],
    );

    return result.rows;
  }

  async create(worldId: string, entryId: string, userId: string, dto: CommentDto) {
    await this.activeEntry(worldId, entryId);

    const created = await this.db.query(
      'INSERT INTO comments (world_id, entry_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING id',
      [worldId, entryId, userId, dto.body.trim()],
    );

    return this.find(worldId, created.rows[0].id);
  }

  async update(worldId: string, commentId: string, userId: string, dto: CommentDto) {
    const comment = await this.find(worldId, commentId);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    await this.db.query('UPDATE comments SET body = $3, updated_at = now() WHERE id = $1 AND world_id = $2', [commentId, worldId, dto.body.trim()]);

    return this.find(worldId, commentId);
  }

  async remove(worldId: string, commentId: string, userId: string, role: string) {
    const comment = await this.find(worldId, commentId);

    if (comment.authorId !== userId && role !== 'owner') {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.db.query('DELETE FROM comments WHERE id = $1 AND world_id = $2', [commentId, worldId]);

    return {deleted: true};
  }
}
