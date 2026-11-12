import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { detectImageType } from '../common/utils/image-type';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';

const DEFAULT_COLOR = '#d93025';

@Injectable()
export class MapsService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

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

  private async loadMarkers(worldId: string, mapId: string | null, markerId: string | null) {
    const result = await this.db.query(
      `SELECT k.id, k.map_id AS "mapId", k.entry_id AS "entryId", e.name AS "entryName", t.name AS "typeName",
       k.x, k.y, k.color, k.inner_color AS "innerColor", k.image_scale AS "imageScale", k.image_x AS "imageX", k.image_y AS "imageY", k.image_id AS "imageId",
       COALESCE(ki.storage_key, fi.storage_key) AS "imageKey"
       FROM map_markers k
       JOIN active_entries e ON e.id = k.entry_id AND e.world_id = k.world_id
       JOIN entry_types t ON t.id = e.type_id AND t.mappable
       LEFT JOIN entry_images ki ON ki.id = k.image_id
       LEFT JOIN LATERAL (
       SELECT storage_key FROM entry_images WHERE entry_id = k.entry_id ORDER BY position LIMIT 1
       ) fi ON true
       WHERE k.world_id = $1
       AND ($2::uuid IS NULL OR k.map_id = $2::uuid)
       AND ($3::uuid IS NULL OR k.id = $3::uuid)
       ORDER BY lower(e.name)`,
      [worldId, mapId, markerId],
    );

    return Promise.all(result.rows.map(async (row) => ({
      id: row.id,
      mapId: row.mapId,
      entryId: row.entryId,
      entryName: row.entryName,
      typeName: row.typeName,
      x: row.x,
      y: row.y,
      color: row.color,
      innerColor: row.innerColor,
      imageScale: row.imageScale,
      imageX: row.imageX,
      imageY: row.imageY,
      imageId: row.imageId,
      imageUrl: row.imageKey ? await this.storage.getUrl(row.imageKey) : null,
    })));
  }

  private async checkEntryImage(entryId: string, imageId: string) {
    const image = await this.db.query('SELECT 1 FROM entry_images WHERE id = $1 AND entry_id = $2', [imageId, entryId]);

    if (!image.rows[0]) {
      throw new NotFoundException('Image not found');
    }
  }

  async list(worldId: string) {
    const maps = await this.db.query(
      `SELECT m.id, m.name, m.created_at AS "createdAt",
       (SELECT count(*)::int
       FROM map_markers k
       JOIN active_entries e ON e.id = k.entry_id AND e.world_id = k.world_id
       JOIN entry_types t ON t.id = e.type_id AND t.mappable
       WHERE k.map_id = m.id) AS "markerCount"
       FROM maps m
       WHERE m.world_id = $1
       ORDER BY lower(m.name), m.created_at`,
      [worldId],
    );
    const world = await this.db.query('SELECT max_maps AS "maxMaps" FROM worlds WHERE id = $1', [worldId]);

    return {maps: maps.rows, maxMaps: world.rows[0].maxMaps};
  }

  async findOne(worldId: string, mapId: string) {
    const found = await this.db.query(
      'SELECT id, name, storage_key AS "storageKey" FROM maps WHERE id = $1 AND world_id = $2',
      [mapId, worldId],
    );
    const map = found.rows[0];

    if (!map) {
      throw new NotFoundException('Map not found');
    }

    return {
      id: map.id,
      name: map.name,
      imageUrl: await this.storage.getUrl(map.storageKey),
      markers: await this.loadMarkers(worldId, mapId, null),
    };
  }

  async create(worldId: string, userId: string, name: string, file: Express.Multer.File | undefined) {
    const type = this.checkImage(file);
    const key = `worlds/${worldId}/maps/${randomUUID()}.${type.ext}`;
    const state = {uploaded: false};
    let mapId: string;

    try {
      mapId = await this.db.transaction(async (client) => {
        const world = await client.query('SELECT max_maps AS "maxMaps" FROM worlds WHERE id = $1 FOR UPDATE', [worldId]);
        const count = await client.query('SELECT count(*)::int AS count FROM maps WHERE world_id = $1', [worldId]);
        const max = world.rows[0].maxMaps;

        if (count.rows[0].count >= max) {
          throw new BadRequestException(`A world can have up to ${max} ${max === 1 ? 'map' : 'maps'}`);
        }

        await this.storage.upload(key, file!.buffer, type.mime);
        state.uploaded = true;

        const created = await client.query(
          'INSERT INTO maps (world_id, name, storage_key, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
          [worldId, name.trim(), key, userId],
        );

        return created.rows[0].id;
      });

    } catch (err) {
      if (state.uploaded) {
        await this.storage.remove(key).catch(() => null);
      }

      throw err;
    }

    return this.findOne(worldId, mapId);
  }

  async rename(worldId: string, mapId: string, name: string) {
    const result = await this.db.query(
      'UPDATE maps SET name = $3, updated_at = now() WHERE id = $1 AND world_id = $2 RETURNING id, name',
      [mapId, worldId, name.trim()],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Map not found');
    }

    return result.rows[0];
  }

  async remove(worldId: string, mapId: string, confirmName: string) {
    const found = await this.db.query('SELECT name, storage_key AS "storageKey" FROM maps WHERE id = $1 AND world_id = $2', [mapId, worldId]);
    const map = found.rows[0];

    if (!map) {
      throw new NotFoundException('Map not found');
    }

    if (confirmName !== map.name) {
      throw new BadRequestException('Confirmation does not match map name');
    }

    await this.db.query('DELETE FROM maps WHERE id = $1 AND world_id = $2', [mapId, worldId]);
    await this.storage.remove(map.storageKey).catch(() => null);

    return {deleted: true};
  }

  async createMarker(worldId: string, mapId: string, userId: string, dto: CreateMarkerDto) {
    const map = await this.db.query('SELECT 1 FROM maps WHERE id = $1 AND world_id = $2', [mapId, worldId]);

    if (!map.rows[0]) {
      throw new NotFoundException('Map not found');
    }

    const found = await this.db.query(
      `SELECT e.type_id AS "typeId", t.mappable
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.id = $1 AND e.world_id = $2`,
      [dto.entryId, worldId],
    );
    const entry = found.rows[0];

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    if (!entry.typeId) {
      throw new BadRequestException('Entries without a type can not be placed on a map');
    }

    if (!entry.mappable) {
      throw new BadRequestException('Entries of this type can not be placed on a map');
    }

    if (dto.imageId) {
      await this.checkEntryImage(dto.entryId, dto.imageId);
    }

    try {
      const created = await this.db.query(
        `INSERT INTO map_markers (map_id, world_id, entry_id, image_id, color, x, y, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [mapId, worldId, dto.entryId, dto.imageId ?? null, dto.color ?? DEFAULT_COLOR, dto.x, dto.y, userId],
      );
      const markers = await this.loadMarkers(worldId, null, created.rows[0].id);

      return markers[0];
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('That entry is already on this map');
      }

      throw err;
    }
  }

  async updateMarker(worldId: string, markerId: string, dto: UpdateMarkerDto) {
    const current = await this.loadMarkers(worldId, null, markerId);

    if (!current[0]) {
      throw new NotFoundException('Marker not found');
    }

    if (dto.imageId) {
      await this.checkEntryImage(current[0].entryId, dto.imageId);
    }

    await this.db.query(
      `UPDATE map_markers
       SET x = COALESCE($3::float8, x),
       y = COALESCE($4::float8, y),
       color = COALESCE($5::text, color),
       image_id = CASE WHEN $6::boolean THEN $7::uuid ELSE image_id END,
       inner_color = COALESCE($8::text, inner_color),
       image_scale = COALESCE($9::float8, image_scale),
       image_x = COALESCE($10::float8, image_x),
       image_y = COALESCE($11::float8, image_y),
       updated_at = now()
       WHERE id = $1 AND world_id = $2`,
      [markerId, worldId, dto.x ?? null, dto.y ?? null, dto.color ?? null, dto.imageId !== undefined, dto.imageId ?? null, dto.innerColor ?? null, dto.imageScale ?? null, dto.imageX ?? null, dto.imageY ?? null],
    );

    const markers = await this.loadMarkers(worldId, null, markerId);

    return markers[0];
  }

  async removeMarker(worldId: string, markerId: string) {
    const result = await this.db.query('DELETE FROM map_markers WHERE id = $1 AND world_id = $2 RETURNING id', [markerId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Marker not found');
    }

    return {deleted: true};
  }
}
