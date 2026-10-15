import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateWorldDto } from './dto/create-world.dto';
import { UpdateWorldDto } from './dto/update-world.dto';

const WORLD_COLUMNS = `id, name, description, visibility, thumbnail_key AS "thumbnailKey", created_at AS "createdAt", updated_at AS "updatedAt"`;

@Injectable()
export class WorldsService {
  constructor(private readonly db: DatabaseService) {}

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

      return Object.assign({}, world, {role: 'owner'});
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

    return result.rows;
  }

  async findOne(id: string, role: string) {
    const result = await this.db.query(`SELECT ${WORLD_COLUMNS} FROM worlds WHERE id = $1`, [id]);
    const world = result.rows[0];

    if (!world) {
      throw new NotFoundException('World not found');
    }

    return Object.assign({}, world, {role});
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

    return Object.assign({}, world, {role: 'owner'});
  }

  async remove(id: string, confirmName: string) {
    const result = await this.db.query('SELECT name FROM worlds WHERE id = $1', [id]);
    const world = result.rows[0];

    if (!world) {
      throw new NotFoundException('World not found');
    }

    if (confirmName !== world.name) {
      throw new BadRequestException('Confirmation does not match world name');
    }

    await this.db.query('DELETE FROM worlds WHERE id = $1', [id]);

    return {deleted: true};
  }
}
