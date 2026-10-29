import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DeleteEntryTypeDto } from './dto/delete-entry-type.dto';
import { EntryTypeDto } from './dto/entry-type.dto';

const TYPE_COLUMNS = `id, name, created_at AS "createdAt"`;

@Injectable()
export class EntryTypesService {
  constructor(private readonly db: DatabaseService) {}

  async list(worldId: string) {
    const result = await this.db.query(
      `SELECT t.id, t.name, t.created_at AS "createdAt",
              (SELECT count(*)::int FROM active_entries e WHERE e.type_id = t.id) AS "entryCount"
       FROM entry_types t
       WHERE t.world_id = $1
       ORDER BY lower(t.name)`,
      [worldId],
    );
    const fields = await this.db.query(
      `SELECT f.id, f.type_id AS "typeId", f.name, f.field_type AS "fieldType", f.required, f.position, f.config,
              (SELECT count(*)::int FROM active_entries e WHERE e.type_id = f.type_id AND e.fields ? f.id::text) AS "usageCount"
       FROM type_fields f
       JOIN entry_types t ON t.id = f.type_id
       WHERE t.world_id = $1
       ORDER BY f.position, f.created_at`,
      [worldId],
    );

    return result.rows.map((type) => Object.assign({}, type, {fields: fields.rows.filter((field) => field.typeId === type.id)}));
  }

  async create(worldId: string, dto: EntryTypeDto) {
    try {
      const result = await this.db.query(
        `INSERT INTO entry_types (world_id, name) VALUES ($1, $2) RETURNING ${TYPE_COLUMNS}`,
        [worldId, dto.name.trim()],
      );

      return Object.assign({}, result.rows[0], {entryCount: 0, fields: []});
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('A type with that name already exists');
      }

      throw err;
    }
  }

  async update(worldId: string, typeId: string, dto: EntryTypeDto) {
    try {
      const result = await this.db.query(
        `UPDATE entry_types
         SET name = $3,
             updated_at = now()
         WHERE id = $1 AND world_id = $2
         RETURNING ${TYPE_COLUMNS}`,
        [typeId, worldId, dto.name.trim()],
      );
      const type = result.rows[0];

      if (!type) {
        throw new NotFoundException('Entry type not found');
      }

      return type;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('A type with that name already exists');
      }

      throw err;
    }
  }

  remove(worldId: string, typeId: string, dto: DeleteEntryTypeDto) {
    return this.db.transaction(async (client) => {
      const found = await client.query(
        'SELECT name FROM entry_types WHERE id = $1 AND world_id = $2 FOR UPDATE',
        [typeId, worldId],
      );
      const type = found.rows[0];

      if (!type) {
        throw new NotFoundException('Entry type not found');
      }

      if (dto.confirmName !== type.name) {
        throw new BadRequestException('Confirmation does not match type name');
      }

      let targetId: string | null = null;

      if (dto.moveToTypeId) {
        const target = await client.query(
          'SELECT id FROM entry_types WHERE id = $1 AND world_id = $2',
          [dto.moveToTypeId, worldId],
        );

        if (!target.rows[0] || dto.moveToTypeId === typeId) {
          throw new BadRequestException('Choose another type to move entries to');
        }

        targetId = dto.moveToTypeId;
      }

      const moved = await client.query(
        `UPDATE entries
         SET type_id = $3, version = version + 1, updated_at = now()
         WHERE type_id = $1 AND world_id = $2`,
        [typeId, worldId, targetId],
      );

      await client.query('DELETE FROM entry_types WHERE id = $1 AND world_id = $2', [typeId, worldId]);

      return {deleted: true, affectedEntries: moved.rowCount};
    });
  }
}
