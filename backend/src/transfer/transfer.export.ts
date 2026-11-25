import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { FORMAT_NAME, FORMAT_VERSION, TransferDocument } from './transfer.format';
import { Manifest, Selection, buildManifest, closeSelection } from './transfer.manifest';

//const MAX_EXPORT_LENGTH = 200 * 1024 * 1024;
const DOWNLOAD_BATCH = 5;

export interface ExportOptions {
  images: boolean;
  comments: boolean;
  notes: boolean;
}

export interface LoadedWorld {
  doc: TransferDocument;
  entryImageKeys: Record<string, {position: number; key: string}[]>;
  mapKeys: Record<string, string>;
  thumbnailKey: string | null;
}

function group(rows: any[], key: string) {
  const result: Record<string, any[]> = {};

  for (const row of rows) {
    if (!result[row[key]]) {
      result[row[key]] = [];
    }

    result[row[key]].push(row);
  }

  return result;
}

function conditionValue(condition: any) {
  if (condition.op !== 'any' && condition.op !== 'all') {
    return condition.value ?? null;
  }

  const options = condition.fieldConfig?.options ?? [];

  return (condition.value ?? []).map((id: string) => options.find((option: any) => option.id === id)?.label).filter((label: any) => typeof label === 'string');
}

@Injectable()
export class TransferExportService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}

  async load(worldId: string): Promise<LoadedWorld> {
    const found = await this.db.query('SELECT name, description, thumbnail_key AS "thumbnailKey" FROM worlds WHERE id = $1', [worldId]);
    const world = found.rows[0];

    if (!world) {
      throw new NotFoundException('World not found');
    }

    const query = async (text: string) => (await this.db.query(text, [worldId])).rows;
    const types = await query('SELECT id, name, nest_mode AS "nestMode", mappable, timelineable FROM entry_types WHERE world_id = $1 ORDER BY lower(name)');
    const fields = group(await query('SELECT f.id, f.type_id AS "typeId", f.name, f.field_type AS "fieldType", f.required, f.position, f.config FROM type_fields f JOIN entry_types t ON t.id = f.type_id WHERE t.world_id = $1 ORDER BY f.position, lower(f.name)'), 'typeId');
    const rules = group(await query('SELECT type_id AS "typeId", parent_type_id AS "parentTypeId" FROM type_parent_rules WHERE world_id = $1'), 'typeId');
    const relationshipTypes = await query('SELECT id, name, description, from_any AS "fromAny", to_any AS "toAny" FROM relationship_types WHERE world_id = $1 ORDER BY lower(name)');
    const ends = group(await query('SELECT relationship_type_id AS "typeId", side, entry_type_id AS "entryTypeId" FROM relationship_type_ends WHERE world_id = $1'), 'typeId');
    const tags = await query('SELECT id, name, color, rule_match AS "ruleMatch" FROM tags WHERE world_id = $1 ORDER BY lower(name)');
    const conditions = group(await query('SELECT c.tag_id AS "tagId", c.exclude, c.kind, c.entry_type_id AS "typeId", c.relationship_type_id AS "relationshipTypeId", c.side, c.other_any AS "otherAny", c.other_entry_id AS "otherEntryId", c.inside_entry_id AS "insideEntryId", c.field_id AS "fieldId", c.op, c.value, f.type_id AS "fieldTypeId", f.config AS "fieldConfig" FROM tag_rule_conditions c LEFT JOIN type_fields f ON f.id = c.field_id WHERE c.world_id = $1 ORDER BY c.tag_id, c.position'), 'tagId');
    const entries = await query('SELECT id, type_id AS "typeId", name, description, fields, parent_id AS "parentId" FROM active_entries WHERE world_id = $1 ORDER BY created_at, id');
    const active = new Set(entries.map((entry) => entry.id));
    const timeline = new Map<string, any>();

    for (const row of await query('SELECT entry_id AS "entryId", start_year AS "startYear", start_month AS "startMonth", start_day AS "startDay", start_hour AS "startHour", start_minute AS "startMinute", end_year AS "endYear", end_month AS "endMonth", end_day AS "endDay", end_hour AS "endHour", end_minute AS "endMinute", color FROM timeline_entries WHERE world_id = $1')) {
      timeline.set(row.entryId, {startYear: row.startYear, startMonth: row.startMonth, startDay: row.startDay, startHour: row.startHour, startMinute: row.startMinute, endYear: row.endYear, endMonth: row.endMonth, endDay: row.endDay, endHour: row.endHour, endMinute: row.endMinute, color: row.color});
    }
    const ruleEntries = group((await query('SELECT tag_id AS "tagId", entry_id AS "entryId", exclude FROM tag_rule_entries WHERE world_id = $1')).filter((row) => active.has(row.entryId)), 'tagId');
    const entryTags = group(await query('SELECT entry_id AS "entryId", tag_id AS "tagId" FROM entry_tags WHERE world_id = $1'), 'entryId');
    const images = await query('SELECT i.id, i.entry_id AS "entryId", i.position, i.storage_key AS "storageKey" FROM entry_images i JOIN active_entries e ON e.id = i.entry_id WHERE e.world_id = $1 ORDER BY i.position');
    const imageById = new Map(images.map((image) => [image.id, image]));
    const imagesByEntry = group(images, 'entryId');
    const relationships = await query('SELECT r.id, r.relationship_type_id AS "typeId", r.from_entry_id AS "fromId", r.to_entry_id AS "toId" FROM relationships r JOIN active_entries f ON f.id = r.from_entry_id JOIN active_entries t ON t.id = r.to_entry_id WHERE r.world_id = $1 ORDER BY r.created_at, r.id');
    const maps = await query('SELECT id, name, storage_key AS "storageKey" FROM maps WHERE world_id = $1 ORDER BY lower(name), created_at');
    const markers = group(await query('SELECT k.map_id AS "mapId", k.entry_id AS "entryId", k.image_id AS "imageId", k.color, k.inner_color AS "innerColor", k.image_scale AS "imageScale", k.image_x AS "imageX", k.image_y AS "imageY", k.x, k.y FROM map_markers k JOIN active_entries e ON e.id = k.entry_id WHERE k.world_id = $1 ORDER BY k.created_at, k.id'), 'mapId');

    const doc: TransferDocument = {
      format: FORMAT_NAME,
      version: FORMAT_VERSION,
      exportedAt: null,
      exportedBy: null,
      world: {name: world.name, description: world.description, thumbnail: null},
      entryTypes: types.map((type) => ({
        ref: type.id,
        name: type.name,
        nestMode: type.nestMode,
        mappable: type.mappable,
        timelineable: type.timelineable,
        fields: (fields[type.id] ?? []).map((field) => ({ref: field.id, name: field.name, fieldType: field.fieldType, required: field.required, position: field.position, config: field.config})),
        parents: (rules[type.id] ?? []).map((rule) => rule.parentTypeId),
      })),
      relationshipTypes: relationshipTypes.map((type) => ({
        ref: type.id,
        name: type.name,
        description: type.description,
        fromAny: type.fromAny,
        toAny: type.toAny,
        from: (ends[type.id] ?? []).filter((end) => end.side === 'from').map((end) => end.entryTypeId),
        to: (ends[type.id] ?? []).filter((end) => end.side === 'to').map((end) => end.entryTypeId),
      })),
      tags: tags.map((tag) => ({
        ref: tag.id,
        name: tag.name,
        color: tag.color,
        ruleMatch: tag.ruleMatch,
        conditions: (conditions[tag.id] ?? []).map((condition) => ({
          exclude: condition.exclude,
          kind: condition.kind,
          typeRef: condition.typeId ?? condition.fieldTypeId,
          relationshipTypeRef: condition.relationshipTypeId,
          side: condition.side,
          otherAny: condition.otherAny,
          otherEntryRef: condition.otherEntryId,
          insideEntryRef: condition.insideEntryId,
          fieldRef: condition.fieldId,
          op: condition.op,
          value: conditionValue(condition),
        })),
        ruleEntries: (ruleEntries[tag.id] ?? []).map((item) => ({entryRef: item.entryId, exclude: item.exclude})),
      })),
      entries: entries.map((entry) => ({
        ref: entry.id,
        name: entry.name,
        typeRef: entry.typeId,
        description: entry.description,
        parentRef: entry.parentId,
        fields: entry.fields,
        tags: (entryTags[entry.id] ?? []).map((item) => item.tagId),
        images: (imagesByEntry[entry.id] ?? []).map((image) => ({position: image.position, data: null})),
        comments: [],
        notes: [],
        timeline: timeline.get(entry.id) ?? null,
      })),
      relationships: relationships.map((relationship) => ({ref: relationship.id, typeRef: relationship.typeId, fromRef: relationship.fromId, toRef: relationship.toId})),
      maps: maps.map((map) => ({
        ref: map.id,
        name: map.name,
        image: {data: null},
        markers: (markers[map.id] ?? []).map((marker) => ({
          entryRef: marker.entryId,
          imagePosition: marker.imageId && imageById.has(marker.imageId) ? imageById.get(marker.imageId).position : null,
          color: marker.color,
          innerColor: marker.innerColor,
          imageScale: marker.imageScale,
          imageX: marker.imageX,
          imageY: marker.imageY,
          x: marker.x,
          y: marker.y,
        })),
      })),
    };

    const entryImageKeys: Record<string, {position: number; key: string}[]> = {};

    for (const image of images) {
      if (!entryImageKeys[image.entryId]) {
        entryImageKeys[image.entryId] = [];
      }

      entryImageKeys[image.entryId].push({position: image.position, key: image.storageKey});
    }

    const mapKeys: Record<string, string> = {};

    for (const map of maps) {
      mapKeys[map.id] = map.storageKey;
    }

    return {doc, entryImageKeys, mapKeys, thumbnailKey: world.thumbnailKey};
  }

  async manifest(worldId: string) {
    const loaded = await this.load(worldId);
    const comments = await this.db.query('SELECT count(*)::int AS count FROM comments c JOIN active_entries e ON e.id = c.entry_id WHERE c.world_id = $1', [worldId]);
    const notes = await this.db.query('SELECT count(*)::int AS count FROM notes n JOIN active_entries e ON e.id = n.entry_id WHERE n.world_id = $1', [worldId]);
    const images = loaded.doc.entries.reduce((total, entry) => total + entry.images.length, 0);

    return {
      world: {name: loaded.doc.world.name},
      manifest: buildManifest(loaded.doc),
      totals: {comments: comments.rows[0].count, notes: notes.rows[0].count, images, thumbnail: loaded.thumbnailKey !== null},
    };
  }

  private async attachImages(loaded: LoadedWorld, options: ExportOptions) {
    const doc = loaded.doc;
    const jobs: {apply: (data: string) => void; key: string}[] = [];

    for (const entry of doc.entries) {
      const keys = loaded.entryImageKeys[entry.ref] ?? [];

      entry.images = options.images ? entry.images : [];

      for (const image of entry.images) {
        const match = keys.find((item) => item.position === image.position);

        if (match) {
          jobs.push({key: match.key, apply: (data) => {image.data = data;}});
        }
      }
    }

    for (const map of doc.maps) {
      jobs.push({key: loaded.mapKeys[map.ref], apply: (data) => {map.image = {data};}});
    }

    if (options.images && loaded.thumbnailKey) {
      doc.world.thumbnail = {data: null};
      jobs.push({key: loaded.thumbnailKey, apply: (data) => {doc.world.thumbnail = {data};}});
    }

    for (let index = 0; index < jobs.length; index += DOWNLOAD_BATCH) {
      await Promise.all(jobs.slice(index, index + DOWNLOAD_BATCH).map(async (job) => {
        const buffer = await this.storage.download(job.key);

        job.apply(buffer.toString('base64'));
      }));
    }
  }

  private async attachNotes(worldId: string, doc: TransferDocument, options: ExportOptions) {
    const byRef = new Map(doc.entries.map((entry) => [entry.ref, entry]));

    for (const kind of ['comments', 'notes'] as const) {
      if (!options[kind]) {
        continue;
      }

      const table = kind === 'comments' ? 'comments c' : 'notes c';
      const result = await this.db.query(
        `SELECT c.entry_id AS "entryId", COALESCE(c.author_label, u.username, 'Unknown') AS author, c.body, c.created_at AS "createdAt"
         FROM ${table}
         JOIN active_entries e ON e.id = c.entry_id
         LEFT JOIN users u ON u.id = c.author_id
         WHERE c.world_id = $1
         ORDER BY c.created_at, c.id`,
        [worldId],
      );

      for (const row of result.rows) {
        const entry = byRef.get(row.entryId);

        if (entry) {
          entry[kind].push({author: row.author, body: row.body, createdAt: new Date(row.createdAt).toISOString()});
        }
      }
    }
  }

  async build(worldId: string, username: string, selection: Selection, options: ExportOptions) {
    const loaded = await this.load(worldId);
    const manifest: Manifest = buildManifest(loaded.doc);
    const chosen = closeSelection(manifest, selection);
    const doc = loaded.doc;
    const has = (category: keyof Selection) => new Set(chosen[category]);
    const types = has('entryTypes');
    const relationshipTypes = has('relationshipTypes');
    const tags = has('tags');
    const entries = has('entries');
    const relationships = has('relationships');
    const maps = has('maps');

    if (chosen.entryTypes.length + chosen.relationshipTypes.length + chosen.tags.length + chosen.entries.length + chosen.relationships.length + chosen.maps.length === 0) {
      throw new BadRequestException('Select something to export');
    }

    doc.entryTypes = doc.entryTypes.filter((type) => types.has(type.ref));

    for (const type of doc.entryTypes) {
      type.parents = type.parents.filter((ref) => types.has(ref));
    }

    doc.relationshipTypes = doc.relationshipTypes.filter((type) => relationshipTypes.has(type.ref));

    for (const type of doc.relationshipTypes) {
      type.from = type.from.filter((ref) => types.has(ref));
      type.to = type.to.filter((ref) => types.has(ref));
    }

    doc.tags = doc.tags.filter((tag) => tags.has(tag.ref));
    doc.entries = doc.entries.filter((entry) => entries.has(entry.ref));

    for (const entry of doc.entries) {
      entry.tags = entry.tags.filter((ref) => tags.has(ref));
    }

    doc.relationships = doc.relationships.filter((relationship) => relationships.has(relationship.ref));
    doc.maps = doc.maps.filter((map) => maps.has(map.ref));

    for (const map of doc.maps) {
      map.markers = map.markers.filter((marker) => entries.has(marker.entryRef));
    }

    await this.attachImages(loaded, options);

    if (!options.images) {
      for (const map of doc.maps) {
        for (const marker of map.markers) {
          marker.imagePosition = null;
        }
      }
    }

    await this.attachNotes(worldId, doc, options);

    doc.exportedAt = new Date().toISOString();
    doc.exportedBy = username;
    
    /**
    const output = JSON.stringify(doc);

    if (output.length > MAX_EXPORT_LENGTH) {
      throw new BadRequestException('This export is too large. Turn off images or select less');
    }

    return {content: output, name: doc.world.name};
    **/

    return {content: JSON.stringify(doc), name: doc.world.name};
  }
}
