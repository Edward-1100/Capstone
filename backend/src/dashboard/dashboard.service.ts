import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RelationshipsService } from '../relationships/relationships.service';
import { StorageService } from '../storage/storage.service';
import { canReviewSuggestions, canSee, canSubmitSuggestion, readSettings } from './dashboard.settings';

const EXCERPT_LENGTH = 600;

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService, private readonly relationships: RelationshipsService, private readonly storage: StorageService) {}

  private async recent(worldId: string, action: string) {
    const result = await this.db.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (l.entry_id) l.id, l.entry_name AS name, l.created_at AS at, u.username AS by, ae.id AS "entryId", ae.name AS "currentName"
         FROM activity_log l
         LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN active_entries ae ON ae.id = l.entry_id
         WHERE l.world_id = $1 AND l.action = $2
         ORDER BY l.entry_id, l.created_at DESC
       ) recent
       ORDER BY at DESC
       LIMIT 5`,
      [worldId, action],
    );

    return result.rows;
  }

  private async attention(worldId: string) {
    const untyped = await this.db.query(
      'SELECT id, name FROM active_entries WHERE world_id = $1 AND type_id IS NULL ORDER BY updated_at DESC LIMIT 20',
      [worldId],
    );
    const missingRequired = await this.db.query(
      `SELECT e.id AS "entryId", e.name, f.name AS "fieldName"
       FROM active_entries e
       JOIN type_fields f ON f.type_id = e.type_id AND f.required
       WHERE e.world_id = $1 AND NOT (e.fields ? f.id::text)
       ORDER BY e.name, f.position
       LIMIT 50`,
      [worldId],
    );
    const outOfRange = await this.db.query(
      `SELECT e.id AS "entryId", e.name, f.name AS "fieldName"
       FROM active_entries e
       JOIN type_fields f ON f.type_id = e.type_id AND f.field_type = 'scale'
       WHERE e.world_id = $1
         AND e.fields ? f.id::text
         AND CASE WHEN jsonb_typeof(e.fields -> f.id::text) = 'number'
               THEN (e.fields -> f.id::text)::numeric < (f.config ->> 'min')::numeric OR (e.fields -> f.id::text)::numeric > (f.config ->> 'max')::numeric
               ELSE false
             END
       ORDER BY e.name
       LIMIT 50`,
      [worldId],
    );
    const invalidRelationships = await this.relationships.findInvalid(this.db, worldId, undefined, 50);
    const pausedRules = await this.db.query(
      `SELECT t.id AS "tagId", t.name AS "tagName"
       FROM paused_tag_rules p
       JOIN tags t ON t.id = p.tag_id
       WHERE p.world_id = $1
       ORDER BY lower(t.name)
       LIMIT 50`,
      [worldId],
    );

    return {untyped: untyped.rows, missingRequired: missingRequired.rows, outOfRange: outOfRange.rows, invalidRelationships, pausedRules: pausedRules.rows};
  }

  private async entriesByType(worldId: string) {
    const result = await this.db.query(
      `SELECT t.id AS "typeId", t.name, count(*)::int AS count
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.world_id = $1
       GROUP BY t.id, t.name
       ORDER BY count(*) DESC, lower(t.name) NULLS LAST`,
      [worldId],
    );

    return result.rows;
  }

  private async imageUrl(key: string | null) {
    return key ? this.storage.getUrl(key) : null;
  }

  private async items(worldId: string, table: string, pinned: boolean) {
    const base = await this.db.query(
      `SELECT i.id, i.kind, i.layout, i.message, i.entry_id AS "entryId", i.relationship_id AS "relationshipId", i.field_ids AS "fieldIds",
              i.created_at AS "addedAt", u.username AS "addedBy"${pinned ? ', i.note_id AS "noteId"' : ''}
       FROM ${table} i
       LEFT JOIN users u ON u.id = i.added_by
       WHERE i.world_id = $1
       ORDER BY i.created_at DESC`,
      [worldId],
    );
    const rows: any[] = base.rows;

    if (rows.length === 0) {
      return [];
    }

    const relationshipIds = rows.filter((row) => row.kind === 'relationship').map((row) => row.relationshipId);
    const relationships = relationshipIds.length === 0 ? [] : (await this.db.query(
      `SELECT r.id, rt.name AS "typeName", r.from_entry_id AS "fromId", r.to_entry_id AS "toId"
       FROM relationships r
       JOIN relationship_types rt ON rt.id = r.relationship_type_id
       WHERE r.id = ANY($1::uuid[]) AND r.world_id = $2`,
      [relationshipIds, worldId],
    )).rows;
    const entryIds = rows.filter((row) => row.entryId).map((row) => row.entryId);

    for (const relationship of relationships) {
      entryIds.push(relationship.fromId, relationship.toId);
    }

    const entries = await this.db.query(
      `SELECT e.id, e.name, e.fields, t.name AS "typeName",
              left(regexp_replace(e.description, '\\s+', ' ', 'g'), ${EXCERPT_LENGTH}) AS excerpt,
              (SELECT i.storage_key FROM entry_images i WHERE i.entry_id = e.id ORDER BY i.position LIMIT 1) AS "imageKey"
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.id = ANY($1::uuid[]) AND e.world_id = $2`,
      [entryIds, worldId],
    );
    const byId = new Map<string, any>();

    await Promise.all(entries.rows.map(async (row: any) => {
      byId.set(row.id, Object.assign({}, row, {imageUrl: await this.imageUrl(row.imageKey)}));
    }));

    const fieldIds = rows.filter((row) => row.kind === 'details').flatMap((row) => row.fieldIds);
    const fields = fieldIds.length === 0 ? [] : (await this.db.query('SELECT id, name, field_type AS "fieldType", config FROM type_fields WHERE id = ANY($1::uuid[])', [fieldIds])).rows;
    const noteIds = rows.filter((row) => row.noteId).map((row) => row.noteId);
    const notes = noteIds.length === 0 ? [] : (await this.db.query(
      `SELECT n.id, n.body, COALESCE(n.author_label, u.username) AS author
       FROM notes n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.id = ANY($1::uuid[])`,
      [noteIds],
    )).rows;

    function person(id: string) {
      const entry = byId.get(id);

      return entry ? {entryId: entry.id, name: entry.name, typeName: entry.typeName, imageUrl: entry.imageUrl} : null;
    }

    const result: any[] = [];

    for (const row of rows) {
      const common = {id: row.id, kind: row.kind, layout: row.layout, message: row.message, addedAt: row.addedAt, addedBy: row.addedBy};

      if (row.kind === 'relationship') {
        const relationship = relationships.find((item: any) => item.id === row.relationshipId);
        const from = relationship ? person(relationship.fromId) : null;
        const to = relationship ? person(relationship.toId) : null;

        if (from && to) {
          result.push(Object.assign({}, common, {relationshipId: row.relationshipId, relationship: {typeName: relationship.typeName, from, to}}));
        }

        continue;
      }

      const entry = byId.get(row.entryId);

      if (!entry) {
        continue;
      }

      const item: any = Object.assign({}, common, {entryId: entry.id, name: entry.name, typeName: entry.typeName, excerpt: entry.excerpt, imageUrl: entry.imageUrl});

      if (row.kind === 'details') {
        item.details = row.fieldIds
          .map((fieldId: string) => fields.find((field: any) => field.id === fieldId))
          .filter((field: any) => field)
          .map((field: any) => Object.assign({}, field, {value: entry.fields[field.id] ?? null}));
      }

      if (pinned) {
        const note = notes.find((candidate: any) => candidate.id === row.noteId);

        item.noteId = note ? note.id : null;
        item.noteBody = note ? note.body : null;
        item.noteAuthor = note ? note.author : null;
      }

      result.push(item);
    }

    return result;
  }

  async get(worldId: string, role: string | null = 'owner') {
    const world = await this.db.query('SELECT announcement, dashboard_settings AS "settings" FROM worlds WHERE id = $1', [worldId]);
    const settings = readSettings(world.rows[0]?.settings);
    const show = {
      announcement: canSee(settings.announcement, role) && Boolean(world.rows[0]?.announcement),
      entries: canSee(settings.entries, role),
      attention: canSee(settings.attention, role),
      featured: canSee(settings.featured, role),
      pinned: canSee(settings.pinned, role),
      activity: canSee(settings.activity, role),
      suggest: canSubmitSuggestion(settings, role),
      review: canReviewSuggestions(settings, role),
    };

    const empty = {untyped: [], missingRequired: [], outOfRange: [], invalidRelationships: [], pausedRules: []};
    const attention = show.attention ? await this.attention(worldId) : empty;
    const open = show.review ? await this.db.query(`SELECT count(*)::int AS count FROM suggestions WHERE world_id = $1 AND status = 'open'`, [worldId]) : null;

    return Object.assign({
      show,
      announcement: show.announcement ? world.rows[0].announcement : '',
      entriesByType: show.entries ? await this.entriesByType(worldId) : [],
      featured: show.featured ? await this.items(worldId, 'featured_entries', false) : [],
      pinned: show.pinned ? await this.items(worldId, 'pinned_entries', true) : [],
      openSuggestions: open ? open.rows[0].count : 0,
      recentlyCreated: show.activity ? await this.recent(worldId, 'created') : [],
      recentlyModified: show.activity ? await this.recent(worldId, 'updated') : [],
      recentlyDeleted: show.activity ? await this.recent(worldId, 'deleted') : [],
    }, attention);
  }

  async stats(worldId: string) {
    const result = await this.db.query(
      `SELECT
         (SELECT count(*)::int FROM active_entries WHERE world_id = $1) AS entries,
         (SELECT count(*)::int FROM relationships WHERE world_id = $1) AS relationships,
         (SELECT count(*)::int FROM tags WHERE world_id = $1) AS tags,
         (SELECT count(*)::int FROM entry_types WHERE world_id = $1) AS "entryTypes",
         (SELECT count(*)::int FROM relationship_types WHERE world_id = $1) AS "relationshipTypes",
         (SELECT count(*)::int FROM maps WHERE world_id = $1) AS maps,
         (SELECT max_maps FROM worlds WHERE id = $1) AS "maxMaps",
         (SELECT count(*)::int FROM world_members WHERE world_id = $1) AS members`,
      [worldId],
    );

    const last = await this.db.query(
      `SELECT l.action, l.entry_name AS name, l.created_at AS at, u.username AS by, ae.id AS "entryId"
       FROM activity_log l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN active_entries ae ON ae.id = l.entry_id
       WHERE l.world_id = $1
       ORDER BY l.created_at DESC
       LIMIT 1`,
      [worldId],
    );

    return Object.assign({}, result.rows[0], {lastActivity: last.rows[0] || null});
  }
}
