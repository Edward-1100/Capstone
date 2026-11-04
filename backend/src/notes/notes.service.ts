import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NoteDto } from './dto/note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly db: DatabaseService) {}

  private async activeEntry(worldId: string, entryId: string) {
    const result = await this.db.query('SELECT id FROM active_entries WHERE id = $1 AND world_id = $2', [entryId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Entry not found');
    }
  }

  private async find(worldId: string, noteId: string) {
    const result = await this.db.query(
      `SELECT n.id, n.body, n.author_id AS "authorId", u.username AS "authorName",
              n.created_at AS "createdAt", n.updated_at AS "updatedAt", n.updated_at > n.created_at AS edited
       FROM notes n
       JOIN active_entries e ON e.id = n.entry_id
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.id = $1 AND n.world_id = $2`,
      [noteId, worldId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Note not found');
    }

    return result.rows[0];
  }

  async list(worldId: string, entryId: string) {
    await this.activeEntry(worldId, entryId);

    const result = await this.db.query(
      `SELECT n.id, n.body, n.author_id AS "authorId", u.username AS "authorName",
              n.created_at AS "createdAt", n.updated_at AS "updatedAt", n.updated_at > n.created_at AS edited
       FROM notes n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.entry_id = $1 AND n.world_id = $2
       ORDER BY n.created_at DESC, n.id DESC`,
      [entryId, worldId],
    );

    return result.rows;
  }

  async create(worldId: string, entryId: string, userId: string, dto: NoteDto) {
    await this.activeEntry(worldId, entryId);

    const created = await this.db.query(
      'INSERT INTO notes (world_id, entry_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING id',
      [worldId, entryId, userId, dto.body.trim()],
    );

    return this.find(worldId, created.rows[0].id);
  }

  async update(worldId: string, noteId: string, userId: string, dto: NoteDto) {
    const note = await this.find(worldId, noteId);

    if (note.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own notes');
    }

    await this.db.query('UPDATE notes SET body = $3, updated_at = now() WHERE id = $1 AND world_id = $2', [noteId, worldId, dto.body.trim()]);

    return this.find(worldId, noteId);
  }

  async remove(worldId: string, noteId: string, userId: string, role: string) {
    const note = await this.find(worldId, noteId);

    if (note.authorId !== userId && role !== 'owner') {
      throw new ForbiddenException('You can only delete your own notes');
    }

    await this.db.query('DELETE FROM notes WHERE id = $1 AND world_id = $2', [noteId, worldId]);

    return {deleted: true};
  }
}
