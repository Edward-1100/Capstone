import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Queryable } from '../nesting/nesting.service';
import { CreateRelationshipTypeDto } from './dto/create-relationship-type.dto';
import { DeleteRelationshipTypeDto } from './dto/delete-relationship-type.dto';
import { UpdateRelationshipTypeDto } from './dto/update-relationship-type.dto';
import { RelationshipsService } from './relationships.service';

@Injectable()
export class RelationshipTypesService {
  constructor(private readonly db: DatabaseService, private readonly relationships: RelationshipsService) {}

  private async load(client: Queryable, worldId: string, typeId?: string) {
    const types = await client.query(
      `SELECT rt.id, rt.name, rt.description, rt.is_symmetric AS symmetric, rt.from_any AS "fromAny", rt.to_any AS "toAny", rt.created_at AS "createdAt",
              (SELECT count(*)::int
               FROM relationships r
               JOIN active_entries f ON f.id = r.from_entry_id
               JOIN active_entries t ON t.id = r.to_entry_id
               WHERE r.relationship_type_id = rt.id) AS "relationshipCount"
       FROM relationship_types rt
       WHERE rt.world_id = $1 AND ($2::uuid IS NULL OR rt.id = $2::uuid)
       ORDER BY lower(rt.name)`,
      [worldId, typeId ?? null],
    );
    const ends = await client.query(
      'SELECT relationship_type_id AS "typeId", side, entry_type_id AS "entryTypeId" FROM relationship_type_ends WHERE world_id = $1',
      [worldId],
    );

    return types.rows.map((type: any) => Object.assign({}, type, {
      fromTypeIds: ends.rows.filter((end: any) => end.typeId === type.id && end.side === 'from').map((end: any) => end.entryTypeId),
      toTypeIds: ends.rows.filter((end: any) => end.typeId === type.id && end.side === 'to').map((end: any) => end.entryTypeId),
    }));
  }

  private async checkEntryTypes(client: Queryable, worldId: string, ids?: string[]) {
    if (!ids || ids.length === 0) {
      return;
    }

    const valid = await client.query('SELECT id FROM entry_types WHERE world_id = $1 AND id = ANY($2::uuid[])', [worldId, ids]);

    if (valid.rows.length !== ids.length) {
      throw new BadRequestException('Choose entry types from this world');
    }
  }

  private async saveEnds(client: Queryable, worldId: string, typeId: string, side: string, any: boolean | undefined, ids?: string[]) {
    if (any === true) {
      await client.query('DELETE FROM relationship_type_ends WHERE relationship_type_id = $1 AND side = $2', [typeId, side]);

      return;
    }

    if (ids === undefined) {
      return;
    }

    await client.query('DELETE FROM relationship_type_ends WHERE relationship_type_id = $1 AND side = $2', [typeId, side]);

    if (ids.length > 0) {
      await client.query(
        'INSERT INTO relationship_type_ends (world_id, relationship_type_id, side, entry_type_id) SELECT $1, $2, $3, unnest($4::uuid[])',
        [worldId, typeId, side, ids],
      );
    }
  }

  private rethrow(err: any): never {
    if (err.code === '23505') {
      throw new ConflictException('A relationship type with that name already exists');
    }

    throw err;
  }

  list(worldId: string) {
    return this.load(this.db, worldId);
  }

  async create(worldId: string, dto: CreateRelationshipTypeDto) {
    try {
      return await this.db.transaction(async (client) => {
        await this.relationships.lock(client, worldId);
        await this.checkEntryTypes(client, worldId, dto.fromTypeIds);
        await this.checkEntryTypes(client, worldId, dto.toTypeIds);

        const fromAny = dto.fromAny ?? true;
        const toAny = dto.toAny ?? true;
        const result = await client.query(
          'INSERT INTO relationship_types (world_id, name, description, is_symmetric, from_any, to_any) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [worldId, dto.name.trim(), dto.description ?? '', dto.symmetric ?? false, fromAny, toAny],
        );
        const typeId = result.rows[0].id;

        await this.saveEnds(client, worldId, typeId, 'from', fromAny, dto.fromTypeIds);
        await this.saveEnds(client, worldId, typeId, 'to', toAny, dto.toTypeIds);

        return (await this.load(client, worldId, typeId))[0];
      });
    } catch (err: any) {
      return this.rethrow(err);
    }
  }

  async update(worldId: string, typeId: string, dto: UpdateRelationshipTypeDto) {
    try {
      return await this.db.transaction(async (client) => {
        await this.relationships.lock(client, worldId);

        const found = await client.query('SELECT id FROM relationship_types WHERE id = $1 AND world_id = $2 FOR UPDATE', [typeId, worldId]);

        if (!found.rows[0]) {
          throw new NotFoundException('Relationship type not found');
        }

        await this.checkEntryTypes(client, worldId, dto.fromTypeIds);
        await this.checkEntryTypes(client, worldId, dto.toTypeIds);

        await client.query(
          `UPDATE relationship_types
           SET name = COALESCE($3, name),
               description = COALESCE($4, description),
               from_any = COALESCE($5::boolean, from_any),
               to_any = COALESCE($6::boolean, to_any),
               updated_at = now()
           WHERE id = $1 AND world_id = $2`,
          [typeId, worldId, dto.name?.trim() ?? null, dto.description ?? null, dto.fromAny ?? null, dto.toAny ?? null],
        );

        await this.saveEnds(client, worldId, typeId, 'from', dto.fromAny, dto.fromTypeIds);
        await this.saveEnds(client, worldId, typeId, 'to', dto.toAny, dto.toTypeIds);

        const invalid = await this.relationships.findInvalid(client, worldId, typeId);

        if (invalid.length > 0 && dto.confirmRemove !== true) {
          const noun = invalid.length === 1 ? 'relationship' : 'relationships';

          throw new ConflictException({
            message: `This change would remove ${invalid.length} ${noun}`,
            count: invalid.length,
            relationships: invalid.slice(0, 100),
          });
        }

        if (invalid.length > 0) {
          await client.query('DELETE FROM relationships WHERE id = ANY($1::uuid[])', [invalid.map((item: any) => item.id)]);
        }

        const type = (await this.load(client, worldId, typeId))[0];

        return Object.assign({}, type, {removedRelationships: invalid.length});
      });
    } catch (err: any) {
      return this.rethrow(err);
    }
  }

  remove(worldId: string, typeId: string, dto: DeleteRelationshipTypeDto) {
    return this.db.transaction(async (client) => {
      await this.relationships.lock(client, worldId);

      const found = await client.query('SELECT name FROM relationship_types WHERE id = $1 AND world_id = $2 FOR UPDATE', [typeId, worldId]);
      const type = found.rows[0];

      if (!type) {
        throw new NotFoundException('Relationship type not found');
      }

      if (dto.confirmName !== type.name) {
        throw new BadRequestException('Confirmation does not match type name');
      }

      const removed = await client.query('SELECT count(*)::int AS count FROM relationships WHERE relationship_type_id = $1', [typeId]);

      await client.query('DELETE FROM relationship_types WHERE id = $1 AND world_id = $2', [typeId, worldId]);

      return {deleted: true, removedRelationships: removed.rows[0].count};
    });
  }
}
