import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NestingService } from '../nesting/nesting.service';
import { DeleteEntryTypeDto } from './dto/delete-entry-type.dto';
import { EntryTypeDto } from './dto/entry-type.dto';
import { NestingDto } from './dto/nesting.dto';

const TYPE_COLUMNS = `id, name, nestable, any_parent AS "anyParent", created_at AS "createdAt"`;

@Injectable()
export class EntryTypesService {
  constructor(private readonly db: DatabaseService, private readonly nesting: NestingService) {}

  async list(worldId: string) {
    const result = await this.db.query(
      `SELECT t.id, t.name, t.nestable, t.any_parent AS "anyParent", t.created_at AS "createdAt",
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
    const rules = await this.db.query('SELECT type_id AS "typeId", parent_type_id AS "parentTypeId" FROM type_parent_rules WHERE world_id = $1', [worldId]);

    return result.rows.map((type) => Object.assign({}, type, {
      fields: fields.rows.filter((field) => field.typeId === type.id),
      parentTypeIds: rules.rows.filter((rule) => rule.typeId === type.id).map((rule) => rule.parentTypeId),
    }));
  }

  async create(worldId: string, dto: EntryTypeDto) {
    try {
      const result = await this.db.query(
        `INSERT INTO entry_types (world_id, name) VALUES ($1, $2) RETURNING ${TYPE_COLUMNS}`,
        [worldId, dto.name.trim()],
      );

      return Object.assign({}, result.rows[0], {entryCount: 0, fields: [], parentTypeIds: []});
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

  setNesting(worldId: string, typeId: string, dto: NestingDto) {
    return this.db.transaction(async (client) => {
      await this.nesting.lockWorld(client, worldId);

      const found = await client.query('SELECT id FROM entry_types WHERE id = $1 AND world_id = $2 FOR UPDATE', [typeId, worldId]);

      if (!found.rows[0]) {
        throw new NotFoundException('Entry type not found');
      }

      if (dto.parentTypeIds !== undefined && dto.parentTypeIds.length > 0) {
        const valid = await client.query(
          'SELECT id FROM entry_types WHERE world_id = $1 AND id = ANY($2::uuid[]) AND (nestable OR ($3::boolean AND id = $4::uuid))',
          [worldId, dto.parentTypeIds, dto.nestable, typeId],
        );

        if (valid.rows.length !== dto.parentTypeIds.length) {
          throw new BadRequestException('Choose types that can be nested');
        }
      }

      await client.query(
        'UPDATE entry_types SET nestable = $3, any_parent = COALESCE($4::boolean, any_parent), updated_at = now() WHERE id = $1 AND world_id = $2',
        [typeId, worldId, dto.nestable, dto.anyParent ?? null],
      );

      if (dto.parentTypeIds !== undefined) {
        await client.query('DELETE FROM type_parent_rules WHERE type_id = $1', [typeId]);

        if (dto.parentTypeIds.length > 0) {
          await client.query(
            'INSERT INTO type_parent_rules (world_id, type_id, parent_type_id) SELECT $1, $2, unnest($3::uuid[])',
            [worldId, typeId, dto.parentTypeIds],
          );
        }
      }

      const links = await this.nesting.brokenLinks(client, worldId);
      const cleared = await this.nesting.unlinkOrThrow(client, worldId, links, dto.confirmUnlink === true);
      const type = await client.query(`SELECT ${TYPE_COLUMNS} FROM entry_types WHERE id = $1`, [typeId]);
      const rules = await client.query('SELECT parent_type_id AS "parentTypeId" FROM type_parent_rules WHERE type_id = $1', [typeId]);

      return Object.assign({}, type.rows[0], {parentTypeIds: rules.rows.map((rule) => rule.parentTypeId), clearedLinks: cleared});
    });
  }

  remove(worldId: string, typeId: string, dto: DeleteEntryTypeDto) {
    return this.db.transaction(async (client) => {
      await this.nesting.lockWorld(client, worldId);

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

      const links = await this.nesting.brokenLinks(client, worldId);
      const cleared = await this.nesting.unlinkOrThrow(client, worldId, links, dto.confirmUnlink === true);

      return {deleted: true, affectedEntries: moved.rowCount, clearedLinks: cleared};
    });
  }
}
