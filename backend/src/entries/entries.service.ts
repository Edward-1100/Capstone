import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PoolClient } from 'pg';
import { detectImageType } from '../common/utils/image-type';
import { DatabaseService } from '../database/database.service';
import { applyFieldValues } from '../entry-types/field-values';
import { StorageService } from '../storage/storage.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

const MAX_IMAGES = 5;

@Injectable()
export class EntriesService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

  private rethrow(err: any): never {
    if (err.code === '23503') {
      throw new BadRequestException('Type not found in this world');
    }

    throw err;
  }

  private log(client: PoolClient, worldId: string, entryId: string, action: string, name: string, userId: string) {
    return client.query(
      'INSERT INTO activity_log (world_id, entry_id, action, entry_name, user_id) VALUES ($1, $2, $3, $4, $5)',
      [worldId, entryId, action, name, userId],
    );
  }

  private async lockEntry(client: PoolClient, worldId: string, entryId: string) {
    const result = await client.query(
      'SELECT id, name FROM entries WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL FOR UPDATE',
      [entryId, worldId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Entry not found');
    }

    return result.rows[0];
  }

  private async touch(client: PoolClient, worldId: string, entryId: string, name: string, userId: string) {
    await client.query('UPDATE entries SET updated_at = now() WHERE id = $1', [entryId]);
    await this.log(client, worldId, entryId, 'updated', name, userId);
  }

  private async loadFields(client: PoolClient, worldId: string, typeId: string | null) {
    if (!typeId) {
      return [];
    }

    const type = await client.query('SELECT 1 FROM entry_types WHERE id = $1 AND world_id = $2', [typeId, worldId]);

    if (!type.rows[0]) {
      throw new BadRequestException('Type not found in this world');
    }

    const result = await client.query(
      'SELECT id, name, field_type AS "fieldType", config FROM type_fields WHERE type_id = $1',
      [typeId],
    );

    return result.rows;
  }

  private checkImage(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const type = detectImageType(file.buffer);

    if (!type) {
      throw new BadRequestException('File must be PNG, JPEG, or WebP');
    }

    return type;
  }

  async list(worldId: string, typeId?: string) {
    if (typeId && typeId !== 'none' && !isUUID(typeId)) {
      throw new BadRequestException('typeId must be a valid id or none');
    }

    const result = await this.db.query(
      `SELECT e.id, e.type_id AS "typeId", e.name, e.version, e.updated_at AS "updatedAt",
              t.name AS "typeName", t.kind AS "typeKind"
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.world_id = $1
         AND ($2::text IS NULL OR ($2::text = 'none' AND e.type_id IS NULL) OR e.type_id::text = $2::text)
       ORDER BY lower(e.name)`,
      [worldId, typeId || null],
    );

    return result.rows;
  }

  async findOne(worldId: string, entryId: string) {
    const result = await this.db.query(
      `SELECT e.id, e.type_id AS "typeId", e.name, e.description, e.version, e.fields,
              e.created_at AS "createdAt", e.updated_at AS "updatedAt",
              t.name AS "typeName", t.kind AS "typeKind"
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.id = $1 AND e.world_id = $2`,
      [entryId, worldId],
    );
    const entry = result.rows[0];

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    const images = await this.db.query(
      'SELECT id, storage_key, position FROM entry_images WHERE entry_id = $1 ORDER BY position',
      [entryId],
    );
    const withUrls = await Promise.all(images.rows.map(async (row) => ({id: row.id, position: row.position, url: await this.storage.getUrl(row.storage_key)})));
    const typeFields = entry.typeId
      ? await this.db.query('SELECT id, name, field_type AS "fieldType", required, position, config FROM type_fields WHERE type_id = $1 ORDER BY position, created_at', [entry.typeId])
      : null;

    return Object.assign({}, entry, {images: withUrls, typeFields: typeFields ? typeFields.rows : []});
  }

  async create(worldId: string, userId: string, dto: CreateEntryDto) {
    try {
      const id = await this.db.transaction(async (client) => {
        const definitions = await this.loadFields(client, worldId, dto.typeId ?? null);
        const fields = applyFieldValues(definitions, {}, dto.fields ?? {});
        const result = await client.query(
          `INSERT INTO entries (world_id, type_id, name, description, created_by, fields)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb)
           RETURNING id`,
          [worldId, dto.typeId ?? null, dto.name.trim(), dto.description ?? '', userId, JSON.stringify(fields)],
        );
        const entryId = result.rows[0].id;

        await this.log(client, worldId, entryId, 'created', dto.name.trim(), userId);

        return entryId;
      });

      return await this.findOne(worldId, id);
    } catch (err: any) {
      return this.rethrow(err);
    }
  }

  async update(worldId: string, entryId: string, userId: string, dto: UpdateEntryDto) {
    try {
      await this.db.transaction(async (client) => {
        const current = await client.query(
          'SELECT name, type_id, fields, version FROM entries WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL',
          [entryId, worldId],
        );
        const entry = current.rows[0];

        if (!entry) {
          throw new NotFoundException('Entry not found');
        }

        if (entry.version !== dto.version) {
          throw new ConflictException('Entry was changed by someone else');
        }

        let fields = entry.fields;

        if (dto.fields !== undefined) {
          const definitions = await this.loadFields(client, worldId, dto.typeId !== undefined ? dto.typeId : entry.type_id);

          fields = applyFieldValues(definitions, entry.fields, dto.fields);
        }

        const result = await client.query(
          `UPDATE entries
           SET name = COALESCE($3, name),
               description = COALESCE($4, description),
               type_id = CASE WHEN $5::boolean THEN $6::uuid ELSE type_id END,
               fields = $8::jsonb,
               version = version + 1,
               updated_at = now()
           WHERE id = $1 AND world_id = $2 AND version = $7 AND deleted_at IS NULL
           RETURNING name`,
          [entryId, worldId, dto.name?.trim() ?? null, dto.description ?? null, dto.typeId !== undefined, dto.typeId ?? null, dto.version, JSON.stringify(fields)],
        );

        if (!result.rows[0]) {
          throw new ConflictException('Entry was changed by someone else');
        }

        await this.log(client, worldId, entryId, 'updated', result.rows[0].name, userId);
      });

      return await this.findOne(worldId, entryId);
    } catch (err: any) {
      return this.rethrow(err);
    }
  }

  remove(worldId: string, entryId: string, userId: string) {
    return this.db.transaction(async (client) => {
      const result = await client.query(
        `UPDATE entries
         SET deleted_at = now(), deleted_by = $3, purge_after = now() + interval '7 days'
         WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL
         RETURNING name`,
        [entryId, worldId, userId],
      );
      const entry = result.rows[0];

      if (!entry) {
        throw new NotFoundException('Entry not found');
      }

      await this.log(client, worldId, entryId, 'deleted', entry.name, userId);

      return {deleted: true};
    });
  }

  async addImage(worldId: string, entryId: string, userId: string, file: Express.Multer.File | undefined) {
    const type = this.checkImage(file);
    const key = `worlds/${worldId}/entries/${entryId}/${randomUUID()}.${type.ext}`;
    const state = {uploaded: false};

    try {
      await this.db.transaction(async (client) => {
        const entry = await this.lockEntry(client, worldId, entryId);
        const used = await client.query('SELECT position FROM entry_images WHERE entry_id = $1', [entryId]);
        const taken = used.rows.map((row) => row.position);
        let position = 0;

        while (taken.includes(position)) {
          position += 1;
        }

        if (position >= MAX_IMAGES) {
          throw new BadRequestException('An entry can have up to 5 images');
        }

        await this.storage.upload(key, file!.buffer, type.mime);
        state.uploaded = true;

        await client.query(
          'INSERT INTO entry_images (entry_id, storage_key, position) VALUES ($1, $2, $3)',
          [entryId, key, position],
        );
        await this.touch(client, worldId, entryId, entry.name, userId);
      });
    } catch (err) {
      if (state.uploaded) {
        await this.storage.remove(key).catch(() => null);
      }

      throw err;
    }

    return this.findOne(worldId, entryId);
  }

  async replaceImage(worldId: string, entryId: string, imageId: string, userId: string, file: Express.Multer.File | undefined) {
    const type = this.checkImage(file);
    const key = `worlds/${worldId}/entries/${entryId}/${randomUUID()}.${type.ext}`;
    const state = {uploaded: false, oldKey: null as string | null};

    try {
      await this.db.transaction(async (client) => {
        const entry = await this.lockEntry(client, worldId, entryId);
        const image = await client.query(
          'SELECT storage_key FROM entry_images WHERE id = $1 AND entry_id = $2',
          [imageId, entryId],
        );

        if (!image.rows[0]) {
          throw new NotFoundException('Image not found');
        }

        state.oldKey = image.rows[0].storage_key;

        await this.storage.upload(key, file!.buffer, type.mime);
        state.uploaded = true;

        await client.query('UPDATE entry_images SET storage_key = $2 WHERE id = $1', [imageId, key]);
        await this.touch(client, worldId, entryId, entry.name, userId);
      });
    } catch (err) {
      if (state.uploaded) {
        await this.storage.remove(key).catch(() => null);
      }

      throw err;
    }

    if (state.oldKey) {
      await this.storage.remove(state.oldKey).catch(() => null);
    }

    return this.findOne(worldId, entryId);
  }

  async removeImage(worldId: string, entryId: string, imageId: string, userId: string) {
    const state = {key: null as string | null};

    await this.db.transaction(async (client) => {
      const entry = await this.lockEntry(client, worldId, entryId);
      const removed = await client.query(
        'DELETE FROM entry_images WHERE id = $1 AND entry_id = $2 RETURNING storage_key',
        [imageId, entryId],
      );

      if (!removed.rows[0]) {
        throw new NotFoundException('Image not found');
      }

      state.key = removed.rows[0].storage_key;

      await this.touch(client, worldId, entryId, entry.name, userId);
    });

    if (state.key) {
      await this.storage.remove(state.key).catch(() => null);
    }

    return this.findOne(worldId, entryId);
  }
}
