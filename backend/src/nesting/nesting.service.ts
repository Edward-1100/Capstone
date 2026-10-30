import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

export interface Queryable {
  query(text: string, params?: any[]): Promise<any>;
}

export interface BrokenLink {
  entryId: string;
  name: string;
  parentId: string;
  parentName: string;
}

const MAX_LISTED_LINKS = 100;

@Injectable()
export class NestingService {
  async lockWorld(client: Queryable, worldId: string) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('nesting:' || $1::text))`, [worldId]);
  }

  async assertParent(client: Queryable, worldId: string, entryId: string | null, typeId: string | null, parentId: string) {
    await this.lockWorld(client, worldId);

    if (entryId && entryId === parentId) {
      throw new BadRequestException('An entry can not be its own parent');
    }

    if (!typeId) {
      throw new BadRequestException('Entries without a type can not be nested');
    }

    const type = await client.query(
      'SELECT name, nestable, any_parent AS "anyParent" FROM entry_types WHERE id = $1 AND world_id = $2',
      [typeId, worldId],
    );
    const child = type.rows[0];

    if (!child) {
      throw new BadRequestException('Type not found in this world');
    }

    if (!child.nestable) {
      throw new BadRequestException('Entries of this type can not be nested');
    }

    const found = await client.query(
      `SELECT e.type_id AS "typeId", t.name AS "typeName", t.nestable
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.id = $1 AND e.world_id = $2`,
      [parentId, worldId],
    );
    const parent = found.rows[0];

    if (!parent) {
      throw new BadRequestException('Parent not found in this world');
    }

    if (!parent.nestable) {
      throw new BadRequestException('That entry can not have entries nested in it');
    }

    if (!child.anyParent) {
      const rule = await client.query(
        'SELECT 1 FROM type_parent_rules WHERE type_id = $1 AND parent_type_id = $2',
        [typeId, parent.typeId],
      );

      if (!rule.rows[0]) {
        throw new BadRequestException(`${child.name} can not be nested inside ${parent.typeName}`);
      }
    }

    if (entryId) {
      const cycle = await client.query(
        `WITH RECURSIVE ancestors AS (
           SELECT id, parent_id FROM entries WHERE id = $1 AND world_id = $2
           UNION
           SELECT e.id, e.parent_id FROM entries e JOIN ancestors a ON e.id = a.parent_id WHERE e.world_id = $2
         )
         SELECT 1 FROM ancestors WHERE id = $3`,
        [parentId, worldId, entryId],
      );

      if (cycle.rows[0]) {
        throw new BadRequestException('That entry is nested inside this one, so it can not be its parent');
      }
    }
  }

  async brokenLinks(client: Queryable, worldId: string, entryIds?: string[]): Promise<BrokenLink[]> {
    const result = await client.query(
      `SELECT c.id AS "entryId", c.name, c.parent_id AS "parentId", p.name AS "parentName"
       FROM active_entries c
       JOIN active_entries p ON p.id = c.parent_id AND p.world_id = c.world_id
       LEFT JOIN entry_types ct ON ct.id = c.type_id
       LEFT JOIN entry_types pt ON pt.id = p.type_id
       WHERE c.world_id = $1
         AND ($2::uuid[] IS NULL OR c.id = ANY($2::uuid[]) OR c.parent_id = ANY($2::uuid[]))
         AND NOT (
           COALESCE(ct.nestable, false) AND COALESCE(pt.nestable, false)
           AND (ct.any_parent OR EXISTS (SELECT 1 FROM type_parent_rules r WHERE r.type_id = ct.id AND r.parent_type_id = pt.id))
         )
       ORDER BY lower(c.name)`,
      [worldId, entryIds ?? null],
    );

    return result.rows;
  }

  async unlinkOrThrow(client: Queryable, worldId: string, links: BrokenLink[], confirmed: boolean, exceptId?: string) {
    if (links.length === 0) {
      return 0;
    }

    if (!confirmed) {
      const noun = links.length === 1 ? 'link' : 'links';

      throw new ConflictException({
        message: `This change would remove ${links.length} nesting ${noun}`,
        count: links.length,
        links: links.slice(0, MAX_LISTED_LINKS),
      });
    }

    await client.query(
      `UPDATE entries
       SET parent_id = NULL, version = version + (CASE WHEN id = $3::uuid THEN 0 ELSE 1 END), updated_at = now()
       WHERE world_id = $1 AND id = ANY($2::uuid[])`,
      [worldId, links.map((link) => link.entryId), exceptId ?? null],
    );

    return links.length;
  }

  async promoteChildren(client: Queryable, worldId: string, entryId: string, parentId: string | null) {
    if (parentId) {
      await client.query(
        `UPDATE entries c
         SET parent_id = $3::uuid, version = c.version + 1, updated_at = now()
         WHERE c.parent_id = $1 AND c.world_id = $2 AND c.deleted_at IS NULL
           AND EXISTS (
             SELECT 1
             FROM entry_types ct, active_entries p, entry_types pt
             WHERE ct.id = c.type_id AND p.id = $3::uuid AND pt.id = p.type_id
               AND ct.nestable AND pt.nestable
               AND (ct.any_parent OR EXISTS (SELECT 1 FROM type_parent_rules r WHERE r.type_id = ct.id AND r.parent_type_id = pt.id))
           )`,
        [entryId, worldId, parentId],
      );
    }

    await client.query(
      'UPDATE entries SET parent_id = NULL, version = version + 1, updated_at = now() WHERE parent_id = $1 AND world_id = $2 AND deleted_at IS NULL',
      [entryId, worldId],
    );
  }

  async parentOptions(client: Queryable, worldId: string, typeId: string, entryId?: string) {
    const result = await client.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM entries WHERE parent_id = $3::uuid AND world_id = $1
         UNION
         SELECT e.id FROM entries e JOIN descendants d ON e.parent_id = d.id WHERE e.world_id = $1
       )
       SELECT e.id, e.name, e.type_id AS "typeId", t.name AS "typeName"
       FROM active_entries e
       JOIN entry_types t ON t.id = e.type_id
       JOIN entry_types ct ON ct.id = $2 AND ct.world_id = $1
       WHERE e.world_id = $1
         AND t.nestable
         AND ct.nestable
         AND (ct.any_parent OR EXISTS (SELECT 1 FROM type_parent_rules r WHERE r.type_id = ct.id AND r.parent_type_id = t.id))
         AND ($3::uuid IS NULL OR (e.id <> $3::uuid AND e.id NOT IN (SELECT id FROM descendants)))
       ORDER BY lower(e.name)`,
      [worldId, typeId, entryId ?? null],
    );

    return result.rows;
  }
}
