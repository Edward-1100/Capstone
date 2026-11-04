import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateFieldDto } from './dto/create-field.dto';
import { DeleteFieldDto } from './dto/delete-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { MAX_FIELDS, normalizeConfig } from './field-values';

const FIELD_COLUMNS = `f.id, f.name, f.field_type AS "fieldType", f.required, f.position, f.config,
  (SELECT count(*)::int FROM active_entries e WHERE e.type_id = f.type_id AND e.fields ? f.id::text) AS "usageCount"`;

@Injectable()
export class FieldsService {
  constructor(private readonly db: DatabaseService) {}

  private usesOptions(value: any, removedIds: string[]) {
    return Array.isArray(value) ? value.some((id) => removedIds.includes(id)) : removedIds.includes(value);
  }

  private async clearOptions(client: PoolClient, worldId: string, fieldId: string, removedIds: string[], confirmed: boolean) {
    const found = await client.query(
      'SELECT id, fields FROM entries WHERE world_id = $1 AND fields ? $2::text FOR UPDATE',
      [worldId, fieldId],
    );
    const affected = found.rows.filter((row) => this.usesOptions(row.fields[fieldId], removedIds));

    if (affected.length === 0) {
      return;
    }

    if (!confirmed) {
      throw new ConflictException({message: `${affected.length} entries use options you removed`, affectedEntries: affected.length});
    }

    for (const row of affected) {
      const fields = Object.assign({}, row.fields);
      const value = fields[fieldId];
      const remaining = Array.isArray(value) ? value.filter((id: string) => !removedIds.includes(id)) : [];

      if (remaining.length > 0) {
        fields[fieldId] = remaining;
      } else {
        delete fields[fieldId];
      }

      await client.query(
        'UPDATE entries SET fields = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1',
        [row.id, JSON.stringify(fields)],
      );
    }
  }

  create(worldId: string, typeId: string, dto: CreateFieldDto) {
    return this.db.transaction(async (client) => {
      const type = await client.query(
        'SELECT id FROM entry_types WHERE id = $1 AND world_id = $2 FOR UPDATE',
        [typeId, worldId],
      );

      if (!type.rows[0]) {
        throw new NotFoundException('Entry type not found');
      }

      const stats = await client.query(
        'SELECT count(*)::int AS count, COALESCE(max(position), -1) AS last FROM type_fields WHERE type_id = $1',
        [typeId],
      );

      if (stats.rows[0].count >= MAX_FIELDS) {
        throw new BadRequestException(`A type can have up to ${MAX_FIELDS} fields`);
      }

      const config = normalizeConfig(dto.fieldType, dto.config);

      try {
        const result = await client.query(
          `INSERT INTO type_fields (type_id, name, field_type, required, position, config)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING id`,
          [typeId, dto.name.trim(), dto.fieldType, dto.required ?? false, stats.rows[0].last + 1, JSON.stringify(config)],
        );
        const created = await client.query(`SELECT ${FIELD_COLUMNS} FROM type_fields f WHERE f.id = $1`, [result.rows[0].id]);

        return created.rows[0];
      } catch (err: any) {
        if (err.code === '23505') {
          throw new ConflictException('A field with that name already exists');
        }

        throw err;
      }
    });
  }

  update(worldId: string, typeId: string, fieldId: string, dto: UpdateFieldDto) {
    return this.db.transaction(async (client) => {
      const found = await client.query(
        `SELECT f.id, f.field_type AS "fieldType", f.config
         FROM type_fields f
         JOIN entry_types t ON t.id = f.type_id
         WHERE f.id = $1 AND f.type_id = $2 AND t.world_id = $3
         FOR UPDATE OF f`,
        [fieldId, typeId, worldId],
      );
      const field = found.rows[0];

      if (!field) {
        throw new NotFoundException('Field not found');
      }

      let config = field.config;

      if (dto.config !== undefined) {
        config = normalizeConfig(field.fieldType, dto.config, field.config);

        if (field.fieldType === 'choice' || field.fieldType === 'multi_choice') {
          const kept = new Set(config.options.map((option: any) => option.id));
          const removedIds = (field.config.options ?? []).map((option: any) => option.id).filter((id: string) => !kept.has(id));

          if (removedIds.length > 0) {
            await this.clearOptions(client, worldId, fieldId, removedIds, dto.confirmClear === true);
          }
        }
      }

      try {
        await client.query(
          `UPDATE type_fields
           SET name = COALESCE($2, name),
               required = COALESCE($3, required),
               config = $4::jsonb,
               updated_at = now()
           WHERE id = $1`,
          [fieldId, dto.name?.trim() ?? null, dto.required ?? null, JSON.stringify(config)],
        );
      } catch (err: any) {
        if (err.code === '23505') {
          throw new ConflictException('A field with that name already exists');
        }

        throw err;
      }

      const updated = await client.query(`SELECT ${FIELD_COLUMNS} FROM type_fields f WHERE f.id = $1`, [fieldId]);

      return updated.rows[0];
    });
  }

  remove(worldId: string, typeId: string, fieldId: string, dto: DeleteFieldDto) {
    return this.db.transaction(async (client) => {
      const found = await client.query(
        `SELECT f.name
         FROM type_fields f
         JOIN entry_types t ON t.id = f.type_id
         WHERE f.id = $1 AND f.type_id = $2 AND t.world_id = $3
         FOR UPDATE OF f`,
        [fieldId, typeId, worldId],
      );
      const field = found.rows[0];

      if (!field) {
        throw new NotFoundException('Field not found');
      }

      if (dto.confirmName !== field.name) {
        throw new BadRequestException('Confirmation does not match field name');
      }

      await client.query('DELETE FROM type_fields WHERE id = $1', [fieldId]);

      const cleared = await client.query(
        'UPDATE entries SET fields = fields - $2::text, version = version + 1, updated_at = now() WHERE world_id = $1 AND fields ? $2::text',
        [worldId, fieldId],
      );

      return {deleted: true, affectedEntries: cleared.rowCount};
    });
  }
}
