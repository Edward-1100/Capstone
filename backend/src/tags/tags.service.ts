import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Queryable } from '../nesting/nesting.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { DeleteTagDto } from './dto/delete-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class TagsService {
  constructor(private readonly db: DatabaseService) {}

  private rethrow(err: any): never {
    if (err.code === '23505') {
      throw new ConflictException('A tag with that name already exists');
    }

    throw err;
  }

  private async load(client: Queryable, worldId: string, tagId?: string) {
    const result = await client.query(
      `SELECT t.id, t.name, t.color, t.created_at AS "createdAt",
              (SELECT count(*)::int FROM entry_tags et JOIN active_entries e ON e.id = et.entry_id WHERE et.tag_id = t.id) AS "entryCount"
       FROM tags t
       WHERE t.world_id = $1 AND ($2::uuid IS NULL OR t.id = $2::uuid)
       ORDER BY lower(t.name)`,
      [worldId, tagId ?? null],
    );

    return result.rows;
  }

  private async tagsOf(client: Queryable, entryId: string) {
    const result = await client.query(
      'SELECT t.id, t.name, t.color FROM entry_tags et JOIN tags t ON t.id = et.tag_id WHERE et.entry_id = $1 ORDER BY lower(t.name)',
      [entryId],
    );

    return result.rows;
  }

  private async activeEntry(client: Queryable, worldId: string, entryId: string) {
    const result = await client.query('SELECT name FROM active_entries WHERE id = $1 AND world_id = $2', [entryId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Entry not found');
    }

    return result.rows[0];
  }

  private async touch(client: Queryable, worldId: string, entryId: string, name: string, userId: string) {
    await client.query('UPDATE entries SET updated_at = now() WHERE id = $1', [entryId]);
    await client.query(
      'INSERT INTO activity_log (world_id, entry_id, action, entry_name, user_id) VALUES ($1, $2, $3, $4, $5)',
      [worldId, entryId, 'updated', name, userId],
    );
  }

  list(worldId: string) {
    return this.load(this.db, worldId);
  }

  async create(worldId: string, dto: CreateTagDto) {
    try {
      const result = await this.db.query(
        'INSERT INTO tags (world_id, name, color) VALUES ($1, $2, $3) RETURNING id',
        [worldId, dto.name.trim(), dto.color ? dto.color.toLowerCase() : null],
      );

      return (await this.load(this.db, worldId, result.rows[0].id))[0];
    } catch (err: any) {
      return this.rethrow(err);
    }
  }

  async update(worldId: string, tagId: string, dto: UpdateTagDto) {
    try {
      const result = await this.db.query(
        `UPDATE tags
         SET name = COALESCE($3, name),
             color = CASE WHEN $4::boolean THEN $5 ELSE color END,
             updated_at = now()
         WHERE id = $1 AND world_id = $2
         RETURNING id`,
        [tagId, worldId, dto.name?.trim() ?? null, dto.color !== undefined, dto.color ? dto.color.toLowerCase() : null],
      );

      if (!result.rows[0]) {
        throw new NotFoundException('Tag not found');
      }

      return (await this.load(this.db, worldId, tagId))[0];
    } catch (err: any) {
      return this.rethrow(err);
    }
  }

  remove(worldId: string, tagId: string, dto: DeleteTagDto) {
    return this.db.transaction(async (client) => {
      const found = await client.query('SELECT name FROM tags WHERE id = $1 AND world_id = $2 FOR UPDATE', [tagId, worldId]);
      const tag = found.rows[0];

      if (!tag) {
        throw new NotFoundException('Tag not found');
      }

      if (dto.confirmName !== tag.name) {
        throw new BadRequestException('Confirmation does not match tag name');
      }

      const used = await client.query(
        'SELECT count(*)::int AS count FROM entry_tags et JOIN active_entries e ON e.id = et.entry_id WHERE et.tag_id = $1',
        [tagId],
      );

      await client.query('DELETE FROM tags WHERE id = $1 AND world_id = $2', [tagId, worldId]);

      return {deleted: true, removedFrom: used.rows[0].count};
    });
  }

  async listForEntry(worldId: string, entryId: string) {
    await this.activeEntry(this.db, worldId, entryId);

    return this.tagsOf(this.db, entryId);
  }

  addToEntry(worldId: string, entryId: string, tagId: string, userId: string) {
    return this.db.transaction(async (client) => {
      const entry = await this.activeEntry(client, worldId, entryId);
      const tag = await client.query('SELECT id FROM tags WHERE id = $1 AND world_id = $2', [tagId, worldId]);

      if (!tag.rows[0]) {
        throw new NotFoundException('Tag not found');
      }

      const added = await client.query(
        'INSERT INTO entry_tags (entry_id, tag_id, world_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [entryId, tagId, worldId],
      );

      if (added.rowCount === 1) {
        await this.touch(client, worldId, entryId, entry.name, userId);
      }

      return this.tagsOf(client, entryId);
    });
  }

  removeFromEntry(worldId: string, entryId: string, tagId: string, userId: string) {
    return this.db.transaction(async (client) => {
      const entry = await this.activeEntry(client, worldId, entryId);
      const removed = await client.query('DELETE FROM entry_tags WHERE entry_id = $1 AND tag_id = $2 AND world_id = $3', [entryId, tagId, worldId]);

      if (removed.rowCount === 1) {
        await this.touch(client, worldId, entryId, entry.name, userId);
      }

      return this.tagsOf(client, entryId);
    });
  }
}
