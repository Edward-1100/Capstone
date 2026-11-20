import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export const MAX_GRAPH_NODES = 3000;
export const GROUPABLE_FIELD_TYPES = ['number', 'boolean', 'scale', 'choice', 'multi_choice'];

export function groupableValues(fields: Record<string, any> | null, groupableIds: Set<string>) {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields ?? {})) {
    if (groupableIds.has(key) && value !== null && value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

@Injectable()
export class GraphService {
  constructor(private readonly db: DatabaseService) {}

  async get(worldId: string) {
    const [entries, types, tags, relationshipTypes, fields, entryTags, edges] = await Promise.all([
      this.db.query(
        'SELECT id, name, type_id AS "typeId", fields FROM active_entries WHERE world_id = $1 ORDER BY updated_at DESC LIMIT $2',
        [worldId, MAX_GRAPH_NODES + 1],
      ),
      this.db.query('SELECT id, name FROM entry_types WHERE world_id = $1 ORDER BY lower(name)', [worldId]),
      this.db.query('SELECT id, name, color FROM tags WHERE world_id = $1 ORDER BY lower(name)', [worldId]),
      this.db.query('SELECT id, name FROM relationship_types WHERE world_id = $1 ORDER BY lower(name)', [worldId]),
      this.db.query(
        `SELECT f.id, f.type_id AS "typeId", f.name, f.field_type AS "fieldType", f.config
         FROM type_fields f
         JOIN entry_types t ON t.id = f.type_id
         WHERE t.world_id = $1 AND f.field_type = ANY($2)
         ORDER BY f.name, f.position`,
        [worldId, GROUPABLE_FIELD_TYPES],
      ),
      this.db.query('SELECT entry_id AS "entryId", tag_id AS "tagId" FROM effective_entry_tags WHERE world_id = $1', [worldId]),
      this.db.query(
        'SELECT id, relationship_type_id AS "typeId", from_entry_id AS "from", to_entry_id AS "to" FROM relationships WHERE world_id = $1',
        [worldId],
      ),
    ]);

    const truncated = entries.rows.length > MAX_GRAPH_NODES;
    const rows = truncated ? entries.rows.slice(0, MAX_GRAPH_NODES) : entries.rows;
    const ids = new Set<string>(rows.map((row: any) => row.id));
    const groupableIds = new Set<string>(fields.rows.map((row: any) => row.id));
    const tagsByEntry = new Map<string, string[]>();

    for (const row of entryTags.rows) {
      if (ids.has(row.entryId)) {
        tagsByEntry.set(row.entryId, (tagsByEntry.get(row.entryId) ?? []).concat(row.tagId));
      }
    }

    return {
      truncated,
      nodes: rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        typeId: row.typeId,
        tagIds: tagsByEntry.get(row.id) ?? [],
        values: groupableValues(row.fields, groupableIds),
      })),
      edges: edges.rows.filter((edge: any) => ids.has(edge.from) && ids.has(edge.to)),
      types: types.rows,
      tags: tags.rows,
      relationshipTypes: relationshipTypes.rows,
      fields: fields.rows,
    };
  }
}
