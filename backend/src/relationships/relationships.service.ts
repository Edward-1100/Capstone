import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Queryable } from '../nesting/nesting.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';

function allows(any: boolean, ids: string[], typeId: string | null) {
  return any || (typeId !== null && ids.includes(typeId));
}

@Injectable()
export class RelationshipsService {
  constructor(private readonly db: DatabaseService) {}

  async lock(client: Queryable, worldId: string) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('relationships:' || $1::text))`, [worldId]);
  }

  async findInvalid(client: Queryable, worldId: string, typeId?: string, limit = 1000) {
    const result = await client.query(
      `SELECT r.id, rt.id AS "typeId", rt.name AS "typeName", f.id AS "fromId", f.name AS "fromName", t.id AS "toId", t.name AS "toName"
       FROM relationships r
       JOIN relationship_types rt ON rt.id = r.relationship_type_id
       JOIN active_entries f ON f.id = r.from_entry_id
       JOIN active_entries t ON t.id = r.to_entry_id
       WHERE r.world_id = $1
         AND ($2::uuid IS NULL OR r.relationship_type_id = $2::uuid)
         AND NOT (
           ((rt.from_any OR EXISTS (SELECT 1 FROM relationship_type_ends e WHERE e.relationship_type_id = rt.id AND e.side = 'from' AND e.entry_type_id = f.type_id))
            AND (rt.to_any OR EXISTS (SELECT 1 FROM relationship_type_ends e WHERE e.relationship_type_id = rt.id AND e.side = 'to' AND e.entry_type_id = t.type_id)))
           OR (rt.is_symmetric
            AND (rt.from_any OR EXISTS (SELECT 1 FROM relationship_type_ends e WHERE e.relationship_type_id = rt.id AND e.side = 'from' AND e.entry_type_id = t.type_id))
            AND (rt.to_any OR EXISTS (SELECT 1 FROM relationship_type_ends e WHERE e.relationship_type_id = rt.id AND e.side = 'to' AND e.entry_type_id = f.type_id)))
         )
       ORDER BY lower(rt.name), lower(f.name), lower(t.name)
       LIMIT $3`,
      [worldId, typeId ?? null, limit],
    );

    return result.rows;
  }

  async listForEntry(worldId: string, entryId: string) {
    const entry = await this.db.query('SELECT id FROM active_entries WHERE id = $1 AND world_id = $2', [entryId, worldId]);

    if (!entry.rows[0]) {
      throw new NotFoundException('Entry not found');
    }

    const result = await this.db.query(
      `SELECT r.id, rt.id AS "typeId", rt.name AS "typeName", rt.is_symmetric AS symmetric,
              CASE WHEN r.from_entry_id = $1 THEN 'out' ELSE 'in' END AS direction,
              o.id AS "otherId", o.name AS "otherName", ot.name AS "otherTypeName"
       FROM relationships r
       JOIN relationship_types rt ON rt.id = r.relationship_type_id
       JOIN active_entries o ON o.id = (CASE WHEN r.from_entry_id = $1 THEN r.to_entry_id ELSE r.from_entry_id END)
       LEFT JOIN entry_types ot ON ot.id = o.type_id
       WHERE r.world_id = $2 AND (r.from_entry_id = $1 OR r.to_entry_id = $1)
       ORDER BY lower(rt.name), lower(o.name)`,
      [entryId, worldId],
    );

    return result.rows;
  }

  create(worldId: string, userId: string, dto: CreateRelationshipDto) {
    return this.db.transaction(async (client) => {
      await this.lock(client, worldId);

      if (dto.fromEntryId === dto.toEntryId) {
        throw new BadRequestException('An entry can not have a relationship with itself');
      }

      const found = await client.query(
        'SELECT name, is_symmetric AS symmetric, from_any AS "fromAny", to_any AS "toAny" FROM relationship_types WHERE id = $1 AND world_id = $2',
        [dto.typeId, worldId],
      );
      const type = found.rows[0];

      if (!type) {
        throw new NotFoundException('Relationship type not found');
      }

      const entries = await client.query(
        `SELECT e.id, e.type_id AS "typeId", t.name AS "typeName"
         FROM active_entries e
         LEFT JOIN entry_types t ON t.id = e.type_id
         WHERE e.world_id = $1 AND e.id = ANY($2::uuid[])`,
        [worldId, [dto.fromEntryId, dto.toEntryId]],
      );
      const from = entries.rows.find((entry) => entry.id === dto.fromEntryId);
      const to = entries.rows.find((entry) => entry.id === dto.toEntryId);

      if (!from || !to) {
        throw new BadRequestException('Entry not found in this world');
      }

      const ends = await client.query('SELECT side, entry_type_id AS "entryTypeId" FROM relationship_type_ends WHERE relationship_type_id = $1', [dto.typeId]);
      const fromIds = ends.rows.filter((end) => end.side === 'from').map((end) => end.entryTypeId);
      const toIds = ends.rows.filter((end) => end.side === 'to').map((end) => end.entryTypeId);
      const forward = allows(type.fromAny, fromIds, from.typeId) && allows(type.toAny, toIds, to.typeId);
      const backward = type.symmetric && allows(type.fromAny, fromIds, to.typeId) && allows(type.toAny, toIds, from.typeId);

      if (!forward && !backward) {
        throw new BadRequestException(`${type.name} can not connect ${from.typeName ?? 'entries without a type'} to ${to.typeName ?? 'entries without a type'}`);
      }

      const existing = await client.query(
        `SELECT 1 FROM relationships
         WHERE relationship_type_id = $1
           AND ((from_entry_id = $2 AND to_entry_id = $3) OR ($4::boolean AND from_entry_id = $3 AND to_entry_id = $2))`,
        [dto.typeId, dto.fromEntryId, dto.toEntryId, type.symmetric],
      );

      if (existing.rows[0]) {
        throw new ConflictException('Those entries already have that relationship');
      }

      const created = await client.query(
        'INSERT INTO relationships (world_id, relationship_type_id, from_entry_id, to_entry_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [worldId, dto.typeId, dto.fromEntryId, dto.toEntryId, userId],
      );

      return {id: created.rows[0].id, typeId: dto.typeId, fromEntryId: dto.fromEntryId, toEntryId: dto.toEntryId};
    });
  }

  async remove(worldId: string, relationshipId: string) {
    const result = await this.db.query('DELETE FROM relationships WHERE id = $1 AND world_id = $2', [relationshipId, worldId]);

    if (result.rowCount === 0) {
      throw new NotFoundException('Relationship not found');
    }

    return {deleted: true};
  }
}
