import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { detectImageType } from '../common/utils/image-type';
import { BUILT_IN_TYPES } from '../entry-types/built-in-types';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { CreateWorldDto } from './dto/create-world.dto';
import { UpdateWorldDto } from './dto/update-world.dto';

const WORLD_COLUMNS = `id, name, description, visibility, thumbnail_key AS "thumbnailKey", created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class WorldsService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

  private async withUrl(world: any) {
    const thumbnailUrl = world.thumbnailKey ? await this.storage.getUrl(world.thumbnailKey) : null;

    return Object.assign({}, world, {thumbnailUrl});
  }

  create(userId: string, dto: CreateWorldDto) {
    return this.db.transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO worlds (name, description, visibility)
         VALUES ($1, $2, $3)
         RETURNING ${WORLD_COLUMNS}`,
        [dto.name.trim(), dto.description ?? '', dto.visibility ?? 'private'],
      );
      const world = result.rows[0];

      await client.query(
        'INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, $3)',
        [world.id, userId, 'owner'],
      );

      for (const type of BUILT_IN_TYPES) {
        await client.query(
          'INSERT INTO entry_types (world_id, name, kind) VALUES ($1, $2, $3)',
          [world.id, type.name, type.kind],
        );
      }

      return Object.assign({}, world, {role: 'owner', thumbnailUrl: null});
    });
  }

  async listForUser(userId: string) {
    const result = await this.db.query(
      `SELECT w.id, w.name, w.description, w.visibility, w.thumbnail_key AS "thumbnailKey",
              w.created_at AS "createdAt", w.updated_at AS "updatedAt", m.role
       FROM worlds w
       JOIN world_members m ON m.world_id = w.id
       WHERE m.user_id = $1
       ORDER BY w.updated_at DESC`,
      [userId],
    );

    return Promise.all(result.rows.map((row) => this.withUrl(row)));
  }

  async findOne(id: string, role: string) {
    const result = await this.db.query(`SELECT ${WORLD_COLUMNS} FROM worlds WHERE id = $1`, [id]);
    const world = result.rows[0];

    if (!world) {
      throw new NotFoundException('World not found');
    }

    return this.withUrl(Object.assign({}, world, {role}));
  }

  async update(id: string, dto: UpdateWorldDto) {
    const result = await this.db.query(
      `UPDATE worlds
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           visibility = COALESCE($4, visibility),
           updated_at = now()
       WHERE id = $1
       RETURNING ${WORLD_COLUMNS}`,
      [id, dto.name?.trim() ?? null, dto.description ?? null, dto.visibility ?? null],
    );
    const world = result.rows[0];

    if (!world) {
      throw new NotFoundException('World not found');
    }

    return this.withUrl(Object.assign({}, world, {role: 'owner'}));
  }

  async setThumbnail(id: string, file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const type = detectImageType(file.buffer);

    if (!type) {
      throw new BadRequestException('File must be PNG, JPEG, or WebP');
    }

    const existing = await this.db.query('SELECT thumbnail_key FROM worlds WHERE id = $1', [id]);
    const oldKey = existing.rows[0]?.thumbnail_key ?? null;
    const key = `worlds/${id}/thumbnail-${randomUUID()}.${type.ext}`;

    await this.storage.upload(key, file.buffer, type.mime);
    await this.db.query('UPDATE worlds SET thumbnail_key = $2, updated_at = now() WHERE id = $1', [id, key]);

    if (oldKey) {
      await this.storage.remove(oldKey).catch(() => null);
    }

    return this.findOne(id, 'owner');
  }

  async removeThumbnail(id: string) {
    const existing = await this.db.query('SELECT thumbnail_key FROM worlds WHERE id = $1', [id]);
    const key = existing.rows[0]?.thumbnail_key ?? null;

    await this.db.query('UPDATE worlds SET thumbnail_key = NULL, updated_at = now() WHERE id = $1', [id]);

    if (key) {
      await this.storage.remove(key).catch(() => null);
    }

    return this.findOne(id, 'owner');
  }

  async remove(id: string, confirmName: string) {
    const result = await this.db.query('SELECT name, thumbnail_key FROM worlds WHERE id = $1', [id]);
    const world = result.rows[0];

    if (!world) {
      throw new NotFoundException('World not found');
    }

    if (confirmName !== world.name) {
      throw new BadRequestException('Confirmation does not match world name');
    }

    const images = await this.db.query(
      'SELECT i.storage_key FROM entry_images i JOIN entries e ON e.id = i.entry_id WHERE e.world_id = $1',
      [id],
    );

    await this.db.query('DELETE FROM worlds WHERE id = $1', [id]);

    if (world.thumbnail_key) {
      await this.storage.remove(world.thumbnail_key).catch(() => null);
    }

    for (const row of images.rows) {
      await this.storage.remove(row.storage_key).catch(() => null);
    }

    return {deleted: true};
  }
}
