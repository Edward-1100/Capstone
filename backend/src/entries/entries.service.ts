import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { PoolClient } from 'pg';
import { detectImageType } from '../common/utils/image-type';
import { DatabaseService } from '../database/database.service';
import { applyFieldValues } from '../entry-types/field-values';
import { NestingService } from '../nesting/nesting.service';
import { StorageService } from '../storage/storage.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

const MAX_IMAGES = 5;
const MAX_TAG_FILTERS = 50;

const MAX_SEARCH_LENGTH = 100;

export interface ListEntriesQuery {
  q?: string;
  types?: string | string[];
  excludeTypes?: string | string[];
  tags?: string | string[];
  excludeTags?: string | string[];
  tagMode?: string;
  inside?: string | string[];
  excludeInside?: string | string[];
  relations?: string | string[];
  excludeRelations?: string | string[];
}

function parseList(value: unknown, name: string, message: string) {
  if (value === undefined || value === '') {
    return [];
  }

  const parts = Array.isArray(value) ? value : [value];

  if (!parts.every((part) => typeof part === 'string')) {
    throw new BadRequestException(message);
  }

  const items = Array.from(new Set(parts.join(',').split(',').map((item) => item.trim()).filter((item) => item !== '')));

  if (items.length > MAX_TAG_FILTERS) {
    throw new BadRequestException(`${name} can only have up to ${MAX_TAG_FILTERS} tags`);
  }

  return items;
}

function parseIds(value: unknown, name: string, allowNone = false) {
  const message = allowNone ? `${name} must be valid ids or none` : `${name} must be valid ids`;
  const ids = parseList(value, name, message);

  if (!ids.every((item) => isUUID(item) || (allowNone && item === 'none'))) {
    throw new BadRequestException(message);
  }

  return ids;
}

function parseRelations(value: unknown, name: string) {
  const message = `${name} must look like typeId:from or to:entryId`;
  const items = parseList(value, name, message);
  const parsed = items.map((item) => item.split(':'));
  const valid = parsed.every((parts) => parts.length === 3 && isUUID(parts[0]) && (parts[1] === 'from' || parts[1] === 'to') && isUUID(parts[2]));

  if (!valid) {
    throw new BadRequestException(message);
  }

  return {types: parsed.map((parts) => parts[0]), sides: parsed.map((parts) => parts[1]), entries: parsed.map((parts) => parts[2])};
}

function splitNone(ids: string[]) {
  return {ids: ids.filter((item) => item !== 'none'), none: ids.includes('none')};
}

@Injectable()
export class EntriesService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService, private readonly nesting: NestingService) {}

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

  private renameLinks(client: PoolClient, worldId: string, entryId: string, oldName: string, newName: string) {
    const pattern = `\\[\\[${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`;
    const replacement = `[[${newName.replace(/\\/g, '\\\\')}]]`;

    return client.query(
      `UPDATE entries
       SET description = regexp_replace(description, $2, $3, 'gi'), version = version + 1, updated_at = now()
       WHERE world_id = $1 AND deleted_at IS NULL AND description ~* $2
         AND NOT EXISTS (SELECT 1 FROM entries other WHERE other.world_id = $1 AND other.deleted_at IS NULL AND other.id <> $4 AND lower(other.name) = lower($5))`,
      [worldId, pattern, replacement, entryId, oldName],
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

  async list(worldId: string, query: ListEntriesQuery = {}) {
    if (query.tagMode !== undefined && query.tagMode !== 'all' && query.tagMode !== 'any') {
      throw new BadRequestException('tagMode must be all or any');
    }

    if (query.q !== undefined && typeof query.q !== 'string') {
      throw new BadRequestException('q must be text');
    }

    const search = (query.q ?? '').trim();

    if (search.length > MAX_SEARCH_LENGTH) {
      throw new BadRequestException(`q can only be up to ${MAX_SEARCH_LENGTH} characters`);
    }

    const types = splitNone(parseIds(query.types, 'types', true));
    const excludedTypes = splitNone(parseIds(query.excludeTypes, 'excludeTypes', true));
    const included = parseIds(query.tags, 'tags');
    const excluded = parseIds(query.excludeTags, 'excludeTags');
    const inside = parseIds(query.inside, 'inside');
    const outside = parseIds(query.excludeInside, 'excludeInside');
    const related = parseRelations(query.relations, 'relations');
    const unrelated = parseRelations(query.excludeRelations, 'excludeRelations');

    const result = await this.db.query(
      `SELECT e.id, e.type_id AS "typeId", e.name, e.version, e.created_at AS "createdAt", e.updated_at AS "updatedAt",
              t.name AS "typeName",
              (SELECT count(*)::int FROM relationships r WHERE r.from_entry_id = e.id OR r.to_entry_id = e.id) AS "relationshipCount",
              COALESCE((SELECT json_agg(json_build_object('id', tg.id, 'name', tg.name, 'color', tg.color, 'auto', et.auto) ORDER BY lower(tg.name))
                        FROM effective_entry_tags et JOIN tags tg ON tg.id = et.tag_id
                        WHERE et.entry_id = e.id), '[]'::json) AS tags
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.world_id = $1
         AND ($2::text = '' OR position(lower($2::text) in lower(e.name)) > 0 OR position(lower($2::text) in lower(e.description)) > 0)
         AND (cardinality($3::uuid[]) = 0 AND NOT $4::boolean OR e.type_id = ANY($3::uuid[]) OR ($4::boolean AND e.type_id IS NULL))
         AND NOT (COALESCE(e.type_id = ANY($5::uuid[]), false) OR ($6::boolean AND e.type_id IS NULL))
         AND (cardinality($7::uuid[]) = 0 OR (
           CASE WHEN $9::text = 'any'
             THEN EXISTS (SELECT 1 FROM effective_entry_tags et WHERE et.entry_id = e.id AND et.tag_id = ANY($7::uuid[]))
             ELSE (SELECT count(*) FROM effective_entry_tags et WHERE et.entry_id = e.id AND et.tag_id = ANY($7::uuid[])) = cardinality($7::uuid[])
           END))
         AND NOT EXISTS (SELECT 1 FROM effective_entry_tags et WHERE et.entry_id = e.id AND et.tag_id = ANY($8::uuid[]))
         AND (cardinality($10::uuid[]) = 0 OR $10::uuid[] && ARRAY(SELECT entry_ancestors(e.id)))
         AND NOT ($11::uuid[] && ARRAY(SELECT entry_ancestors(e.id)))
         AND NOT EXISTS (
           SELECT 1 FROM unnest($12::uuid[], $13::text[], $14::uuid[]) AS f(type_id, side, other_id)
           WHERE NOT EXISTS (
             SELECT 1 FROM relationships r
             WHERE r.relationship_type_id = f.type_id
               AND ((f.side = 'to' AND r.to_entry_id = f.other_id AND r.from_entry_id = e.id) OR (f.side = 'from' AND r.from_entry_id = f.other_id AND r.to_entry_id = e.id))
           ))
         AND NOT EXISTS (
           SELECT 1 FROM unnest($15::uuid[], $16::text[], $17::uuid[]) AS f(type_id, side, other_id)
           WHERE EXISTS (
             SELECT 1 FROM relationships r
             WHERE r.relationship_type_id = f.type_id
               AND ((f.side = 'to' AND r.to_entry_id = f.other_id AND r.from_entry_id = e.id) OR (f.side = 'from' AND r.from_entry_id = f.other_id AND r.to_entry_id = e.id))
           ))
       ORDER BY lower(e.name)`,
      [worldId, search, types.ids, types.none, excludedTypes.ids, excludedTypes.none, included, excluded, query.tagMode ?? 'all', inside, outside, related.types, related.sides, related.entries, unrelated.types, unrelated.sides, unrelated.entries],
    );

    return result.rows;
  }

  async findOne(worldId: string, entryId: string) {
    const result = await this.db.query(
      `SELECT e.id, e.type_id AS "typeId", e.parent_id AS "parentId", e.name, e.description, e.version, e.fields,
              e.created_at AS "createdAt", e.updated_at AS "updatedAt",
              t.name AS "typeName"
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
    const parent = entry.parentId
      ? await this.db.query('SELECT id, name FROM active_entries WHERE id = $1 AND world_id = $2', [entry.parentId, worldId])
      : null;
    const children = await this.db.query('SELECT id, name FROM active_entries WHERE parent_id = $1 AND world_id = $2 ORDER BY lower(name)', [entryId, worldId]);

    return Object.assign({}, entry, {
      images: withUrls,
      typeFields: typeFields ? typeFields.rows : [],
      parent: parent && parent.rows[0] ? parent.rows[0] : null,
      children: children.rows,
    });
  }

  async create(worldId: string, userId: string, dto: CreateEntryDto) {
    try {
      const id = await this.db.transaction(async (client) => {
        const definitions = await this.loadFields(client, worldId, dto.typeId ?? null);
        const fields = applyFieldValues(definitions, {}, dto.fields ?? {});

        if (dto.parentId) {
          await this.nesting.assertParent(client, worldId, null, dto.typeId ?? null, dto.parentId);
        }

        const result = await client.query(
          `INSERT INTO entries (world_id, type_id, name, description, created_by, fields, parent_id)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
           RETURNING id`,
          [worldId, dto.typeId ?? null, dto.name.trim(), dto.description ?? '', userId, JSON.stringify(fields), dto.parentId ?? null],
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
          'SELECT name, type_id, parent_id, fields, version FROM entries WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL',
          [entryId, worldId],
        );
        const entry = current.rows[0];

        if (!entry) {
          throw new NotFoundException('Entry not found');
        }

        if (entry.version !== dto.version) {
          throw new ConflictException('Entry was changed by someone else');
        }

        const typeId = dto.typeId !== undefined ? dto.typeId : entry.type_id;
        const typeChanged = dto.typeId !== undefined && dto.typeId !== entry.type_id;

        if (dto.parentId && dto.parentId !== entry.parent_id) {
          await this.nesting.assertParent(client, worldId, entryId, typeId, dto.parentId);
        }

        let fields = entry.fields;

        if (dto.fields !== undefined) {
          const definitions = await this.loadFields(client, worldId, typeId);

          fields = applyFieldValues(definitions, entry.fields, dto.fields);
        }

        const result = await client.query(
          `UPDATE entries
           SET name = COALESCE($3, name),
               description = COALESCE($4, description),
               type_id = CASE WHEN $5::boolean THEN $6::uuid ELSE type_id END,
               fields = $8::jsonb,
               parent_id = CASE WHEN $9::boolean THEN $10::uuid ELSE parent_id END,
               version = version + 1,
               updated_at = now()
           WHERE id = $1 AND world_id = $2 AND version = $7 AND deleted_at IS NULL
           RETURNING name`,
          [entryId, worldId, dto.name?.trim() ?? null, dto.description ?? null, dto.typeId !== undefined, dto.typeId ?? null, dto.version, JSON.stringify(fields), dto.parentId !== undefined, dto.parentId ?? null],
        );

        if (!result.rows[0]) {
          throw new ConflictException('Entry was changed by someone else');
        }

        if (typeChanged) {
          const links = await this.nesting.brokenLinks(client, worldId, [entryId]);

          await this.nesting.unlinkOrThrow(client, worldId, links, dto.confirmUnlink === true, entryId);
        }

        await this.log(client, worldId, entryId, 'updated', result.rows[0].name, userId);

        if (result.rows[0].name !== entry.name) {
          await this.renameLinks(client, worldId, entryId, entry.name, result.rows[0].name);
        }
      });

      return await this.findOne(worldId, entryId);
    } catch (err: any) {
      return this.rethrow(err);
    }
  }

  remove(worldId: string, entryId: string, userId: string) {
    return this.db.transaction(async (client) => {
      await this.nesting.lockWorld(client, worldId);

      const result = await client.query(
        `UPDATE entries
         SET deleted_at = now(), deleted_by = $3, purge_after = now() + interval '7 days'
         WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL
         RETURNING name, parent_id AS "parentId"`,
        [entryId, worldId, userId],
      );
      const entry = result.rows[0];

      if (!entry) {
        throw new NotFoundException('Entry not found');
      }

      await this.nesting.promoteChildren(client, worldId, entryId, entry.parentId ?? null);
      await this.log(client, worldId, entryId, 'deleted', entry.name, userId);

      return {deleted: true};
    });
  }

  async parentOptions(worldId: string, typeId?: string, entryId?: string) {
    if (!typeId || !isUUID(typeId)) {
      throw new BadRequestException('typeId must be a valid id');
    }

    if (entryId && !isUUID(entryId)) {
      throw new BadRequestException('entryId must be a valid id');
    }

    return this.nesting.parentOptions(this.db, worldId, typeId, entryId);
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
