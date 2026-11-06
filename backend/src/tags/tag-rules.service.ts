import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../database/database.service';
import { Queryable } from '../nesting/nesting.service';
import { SaveRuleDto } from './dto/save-rule.dto';

const MAX_CONDITIONS = 20;
const PREVIEW_LIMIT = 200;
const SIDES = ['from', 'to', 'either'];

interface Condition {
  exclude: boolean;
  kind: string;
  entryTypeId: string | null;
  relationshipTypeId: string | null;
  side: string | null;
  otherAny: boolean;
  otherEntryId: string | null;
  insideEntryId: string | null;
}

function cleanCondition(raw: any): Condition {
  if (!raw || typeof raw !== 'object') {
    throw new BadRequestException('kind must be type, relationship or inside');
  }

  const condition: Condition = {exclude: raw.exclude === true, kind: raw.kind, entryTypeId: null, relationshipTypeId: null, side: null, otherAny: true, otherEntryId: null, insideEntryId: null};

  if (raw.kind === 'type') {
    if (!isUUID(raw.entryTypeId)) {
      throw new BadRequestException('Choose an entry type');
    }

    condition.entryTypeId = raw.entryTypeId;
  } else if (raw.kind === 'relationship') {
    if (!isUUID(raw.relationshipTypeId)) {
      throw new BadRequestException('Choose a relationship type');
    }

    condition.relationshipTypeId = raw.relationshipTypeId;
    condition.side = raw.side ?? 'either';

    if (!SIDES.includes(condition.side as string)) {
      throw new BadRequestException('side must be from, to or either');
    }

    condition.otherAny = raw.otherAny !== false;

    if (!condition.otherAny) {
      if (!isUUID(raw.otherEntryId)) {
        throw new BadRequestException('Choose an entry');
      }

      condition.otherEntryId = raw.otherEntryId;
    }
  } else if (raw.kind === 'inside') {
    if (!isUUID(raw.insideEntryId)) {
      throw new BadRequestException('Choose an entry');
    }

    condition.insideEntryId = raw.insideEntryId;
  } else {
    throw new BadRequestException('kind must be type, relationship or inside');
  }

  return condition;
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => value !== null)));
}

@Injectable()
export class TagRulesService {
  constructor(private readonly db: DatabaseService) {}

  private async checkTag(client: Queryable, worldId: string, tagId: string) {
    const result = await client.query('SELECT rule_match AS "match" FROM tags WHERE id = $1 AND world_id = $2', [tagId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Tag not found');
    }

    return result.rows[0];
  }

  private async checkActiveEntry(client: Queryable, worldId: string, entryId: string) {
    const result = await client.query('SELECT id FROM active_entries WHERE id = $1 AND world_id = $2', [entryId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Entry not found');
    }
  }

  private async checkReferences(client: Queryable, worldId: string, conditions: Condition[]) {
    const typeIds = unique(conditions.map((item) => item.entryTypeId));
    const relationshipTypeIds = unique(conditions.map((item) => item.relationshipTypeId));
    const entryIds = unique(conditions.map((item) => item.otherEntryId).concat(conditions.map((item) => item.insideEntryId)));

    if (typeIds.length > 0) {
      const found = await client.query('SELECT id FROM entry_types WHERE world_id = $1 AND id = ANY($2::uuid[])', [worldId, typeIds]);

      if (found.rows.length !== typeIds.length) {
        throw new BadRequestException('Choose entry types from this world');
      }
    }

    if (relationshipTypeIds.length > 0) {
      const found = await client.query('SELECT id FROM relationship_types WHERE world_id = $1 AND id = ANY($2::uuid[])', [worldId, relationshipTypeIds]);

      if (found.rows.length !== relationshipTypeIds.length) {
        throw new BadRequestException('Choose relationship types from this world');
      }
    }

    if (entryIds.length > 0) {
      const found = await client.query('SELECT id FROM active_entries WHERE world_id = $1 AND id = ANY($2::uuid[])', [worldId, entryIds]);

      if (found.rows.length !== entryIds.length) {
        throw new BadRequestException('Choose entries from this world');
      }
    }
  }

  async get(worldId: string, tagId: string) {
    const tag = await this.checkTag(this.db, worldId, tagId);
    const result = await this.db.query(
      `SELECT c.id, c.exclude, c.kind, c.entry_type_id AS "entryTypeId", c.relationship_type_id AS "relationshipTypeId", c.side,
              c.other_any AS "otherAny", c.other_entry_id AS "otherEntryId", c.inside_entry_id AS "insideEntryId",
              tag_condition_broken(c) AS broken
       FROM tag_rule_conditions c
       WHERE c.tag_id = $1
       ORDER BY c.position, c.id`,
      [tagId],
    );

    return {match: tag.match, conditions: result.rows, paused: result.rows.some((item: any) => item.broken)};
  }

  async save(worldId: string, tagId: string, dto: SaveRuleDto) {
    const raw = dto.conditions;

    if (raw !== undefined && raw.length > MAX_CONDITIONS) {
      throw new BadRequestException(`A rule can have up to ${MAX_CONDITIONS} conditions`);
    }

    const conditions = raw === undefined ? undefined : raw.map(cleanCondition);

    await this.db.transaction(async (client) => {
      const found = await client.query('SELECT id FROM tags WHERE id = $1 AND world_id = $2 FOR UPDATE', [tagId, worldId]);

      if (!found.rows[0]) {
        throw new NotFoundException('Tag not found');
      }

      if (conditions !== undefined) {
        await this.checkReferences(client, worldId, conditions);
        await client.query('DELETE FROM tag_rule_conditions WHERE tag_id = $1', [tagId]);

        for (let index = 0; index < conditions.length; index += 1) {
          const item = conditions[index];

          await client.query(
            `INSERT INTO tag_rule_conditions (world_id, tag_id, position, exclude, kind, entry_type_id, relationship_type_id, side, other_any, other_entry_id, inside_entry_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [worldId, tagId, index, item.exclude, item.kind, item.entryTypeId, item.relationshipTypeId, item.side, item.otherAny, item.otherEntryId, item.insideEntryId],
          );
        }
      }

      if (dto.match !== undefined) {
        await client.query('UPDATE tags SET rule_match = $2, updated_at = now() WHERE id = $1', [tagId, dto.match]);
      }
    });

    return this.get(worldId, tagId);
  }

  async preview(worldId: string, tagId: string) {
    await this.checkTag(this.db, worldId, tagId);

    const applied = await this.db.query(
      `SELECT e.id, e.name, t.name AS "typeName", (x.entry_id IS NOT NULL) AS added
       FROM auto_entry_tags a
       JOIN active_entries e ON e.id = a.entry_id
       LEFT JOIN entry_types t ON t.id = e.type_id
       LEFT JOIN tag_rule_entries x ON x.tag_id = a.tag_id AND x.entry_id = a.entry_id AND NOT x.exclude
       WHERE a.tag_id = $1
       ORDER BY lower(e.name), e.id
       LIMIT $2`,
      [tagId, PREVIEW_LIMIT],
    );
    const total = await this.db.query('SELECT count(*)::int AS count FROM auto_entry_tags WHERE tag_id = $1', [tagId]);
    const excluded = await this.db.query(
      `SELECT e.id, e.name, t.name AS "typeName"
       FROM tag_rule_entries x
       JOIN active_entries e ON e.id = x.entry_id
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE x.tag_id = $1 AND x.exclude
       ORDER BY lower(e.name), e.id`,
      [tagId],
    );

    return {entries: applied.rows, total: total.rows[0].count, excluded: excluded.rows};
  }

  async setEntry(worldId: string, tagId: string, entryId: string, exclude: boolean) {
    await this.checkTag(this.db, worldId, tagId);
    await this.checkActiveEntry(this.db, worldId, entryId);

    await this.db.query(
      `INSERT INTO tag_rule_entries (world_id, tag_id, entry_id, exclude) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tag_id, entry_id) DO UPDATE SET exclude = EXCLUDED.exclude`,
      [worldId, tagId, entryId, exclude],
    );

    return {entryId, exclude};
  }

  async clearEntry(worldId: string, tagId: string, entryId: string) {
    await this.checkTag(this.db, worldId, tagId);
    await this.db.query('DELETE FROM tag_rule_entries WHERE tag_id = $1 AND entry_id = $2 AND world_id = $3', [tagId, entryId, worldId]);

    return {deleted: true};
  }
}
