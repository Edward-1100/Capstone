import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { detectImageType } from '../common/utils/image-type';
import { DatabaseService } from '../database/database.service';
import { applyFieldValues } from '../entry-types/field-values';
import { NestingService } from '../nesting/nesting.service';
import { StorageService } from '../storage/storage.service';
import { MAX_ENTRY_IMAGE, MAX_MAP_IMAGE, MAX_THUMBNAIL, TransferDocument, decodeImage } from './transfer.format';
import { Manifest, buildManifest, closeSelection } from './transfer.manifest';
import { ImportPlan, Resolution } from './transfer.plan';

const NEW_WORLD_MAX_MAPS = 6;
const MAX_FIELDS = 33;
const MAX_WARNINGS = 40;

const NAME_LIMITS: Record<string, number> = {entryTypes: 50, relationshipTypes: 50, tags: 50, entries: 100, maps: 100};
const NAME_LABELS: Record<string, string> = {entryTypes: 'An entry type', relationshipTypes: 'A relationship type', tags: 'A tag', entries: 'An entry', maps: 'A map'};

interface Decision {
  action: 'create' | 'keep' | 'replace';
  name: string;
  existingId: string | null;
  original: string;
}

interface FieldDefinition {
  id: string;
  name: string;
  fieldType: string;
  config: any;
}

interface Run {
  client: PoolClient;
  worldId: string;
  userId: string;
  username: string;
  doc: TransferDocument;
  plan: ImportPlan;
  chosen: Record<string, Set<string>>;
  warnings: string[];
  uploaded: string[];
  removeAfter: string[];
  decisions: Record<string, Map<string, Decision>>;
  typeMap: Map<string, string>;
  relationshipTypeMap: Map<string, string>;
  tagMap: Map<string, string>;
  entryMap: Map<string, string>;
  fieldDefs: Map<string, Map<string, FieldDefinition>>;
  entryTypeIds: Map<string, string | null>;
  changedEntries: Set<string>;
  imageIds: Map<string, string>;
  created: Record<string, number>;
  replaced: Record<string, number>;
  kept: Record<string, number>;
  skipped: Record<string, number>;
}

function addTo(counter: Record<string, number>, key: string, amount = 1) {
  counter[key] = (counter[key] ?? 0) + amount;
}

export function rewriteLinks(description: string, renamed: Map<string, string>) {
  if (renamed.size === 0) {
    return description;
  }

  return description.replace(/\[\[([^\]]+)\]\]/g, (whole, inner) => {
    const target = renamed.get(String(inner).trim().toLowerCase());

    return target ? `[[${target}]]` : whole;
  });
}

@Injectable()
export class TransferImportService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService, private readonly nesting: NestingService) {}

  private async existingNames(client: {query: (text: string, params?: any[]) => Promise<any>}, worldId: string | null) {
    const result: Record<string, Map<string, {id: string; name: string}>> = {entryTypes: new Map(), relationshipTypes: new Map(), tags: new Map(), entries: new Map(), maps: new Map()};

    if (!worldId) {
      return result;
    }

    const tables: [string, string, string][] = [
      ['entryTypes', 'entry_types', 'created_at'],
      ['relationshipTypes', 'relationship_types', 'created_at'],
      ['tags', 'tags', 'created_at'],
      ['entries', 'active_entries', 'created_at'],
      ['maps', 'maps', 'created_at'],
    ];

    for (const [category, table, order] of tables) {
      const rows = await client.query(`SELECT id, name FROM ${table} WHERE world_id = $1 ORDER BY ${order}, id`, [worldId]);

      for (const row of rows.rows) {
        const key = String(row.name).toLowerCase();

        if (!result[category].has(key)) {
          result[category].set(key, {id: row.id, name: row.name});
        }
      }
    }

    return result;
  }

  async preview(doc: TransferDocument, worldId: string | null) {
    const manifest = buildManifest(doc);
    const existing = await this.existingNames(this.db, worldId);
    const clashes: Record<string, Record<string, string>> = {};

    for (const category of Object.keys(existing)) {
      clashes[category] = {};

      for (const item of manifest[category as keyof Manifest]) {
        const match = existing[category].get(item.name.toLowerCase());

        if (match) {
          clashes[category][item.ref] = match.name;
        }
      }
    }

    let used = 0;
    let max = NEW_WORLD_MAX_MAPS;

    if (worldId) {
      const maps = await this.db.query('SELECT (SELECT count(*)::int FROM maps WHERE world_id = $1) AS used, max_maps AS "maxMaps" FROM worlds WHERE id = $1', [worldId]);

      if (!maps.rows[0]) {
        throw new NotFoundException('World not found');
      }

      used = maps.rows[0].used;
      max = maps.rows[0].maxMaps;
    }

    const count = (kind: 'comments' | 'notes') => doc.entries.reduce((total, entry) => total + entry[kind].length, 0);

    return {
      world: {name: doc.world.name, description: doc.world.description},
      exportedBy: doc.exportedBy,
      exportedAt: doc.exportedAt,
      manifest,
      clashes,
      mapCapacity: {used, max},
      totals: {comments: count('comments'), notes: count('notes'), images: doc.entries.reduce((total, entry) => total + entry.images.length, 0), thumbnail: doc.world.thumbnail !== null},
    };
  }

  private warn(run: Run, message: string) {
    if (run.warnings.length < MAX_WARNINGS) {
      run.warnings.push(message);
    } else if (run.warnings.length === MAX_WARNINGS) {
      run.warnings.push('More problems were found and are not listed');
    }
  }

  private decide(run: Run, category: string, items: {ref: string; name: string}[], existing: Map<string, {id: string; name: string}>) {
    const decisions = new Map<string, Decision>();
    const taken = new Set(existing.keys());
    const unresolved: string[] = [];
    const renames: {ref: string; name: string; item: {ref: string; name: string}}[] = [];

    for (const item of items) {
      const match = existing.get(item.name.toLowerCase());

      if (!match) {
        decisions.set(item.ref, {action: 'create', name: item.name, existingId: null, original: item.name});
        taken.add(item.name.toLowerCase());

        continue;
      }

      const choice: Resolution | undefined = run.plan.resolutions[category as keyof ImportPlan['resolutions']][item.ref];

      if (!choice) {
        unresolved.push(item.name);
      } else if (choice.action === 'keep') {
        decisions.set(item.ref, {action: 'keep', name: match.name, existingId: match.id, original: item.name});
      } else if (choice.action === 'replace') {
        decisions.set(item.ref, {action: 'replace', name: match.name, existingId: match.id, original: item.name});
      } else {
        renames.push({ref: item.ref, name: choice.name, item});
      }
    }

    if (unresolved.length > 0) {
      throw new BadRequestException(`Choose what to do with: ${unresolved.slice(0, 5).join(', ')}${unresolved.length > 5 ? ' and more' : ''}`);
    }

    for (const rename of renames) {
      const label = NAME_LABELS[category];
      const limit = NAME_LIMITS[category];

      if (!rename.name || rename.name.length > limit) {
        throw new BadRequestException(`${label} name must be 1 to ${limit} characters`);
      }

      if (taken.has(rename.name.toLowerCase())) {
        throw new BadRequestException(`${label} named ${rename.name} already exists`);
      }

      taken.add(rename.name.toLowerCase());
      decisions.set(rename.ref, {action: 'create', name: rename.name, existingId: null, original: rename.item.name});
    }

    run.decisions[category] = decisions;
  }

  private async upload(run: Run, key: string, buffer: Buffer, mime: string) {
    await this.storage.upload(key, buffer, mime);
    run.uploaded.push(key);
  }

  private async importTypes(run: Run) {
    const types = run.doc.entryTypes.filter((type) => run.chosen.entryTypes.has(type.ref));

    for (const type of types) {
      const decision = run.decisions.entryTypes.get(type.ref)!;
      const defs = new Map<string, FieldDefinition>();

      if (decision.action === 'create') {
        const created = await run.client.query('INSERT INTO entry_types (world_id, name, nest_mode, mappable) VALUES ($1, $2, $3, $4) RETURNING id', [run.worldId, decision.name, type.nestMode, type.mappable]);
        const id = created.rows[0].id;

        run.typeMap.set(type.ref, id);
        addTo(run.created, 'entryTypes');

        for (const field of type.fields) {
          const row = await run.client.query(
            'INSERT INTO type_fields (type_id, name, field_type, required, position, config) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id',
            [id, field.name, field.fieldType, field.required, field.position, JSON.stringify(field.config)],
          );

          defs.set(field.ref, {id: row.rows[0].id, name: field.name, fieldType: field.fieldType, config: field.config});
        }
      } else {
        const id = decision.existingId!;

        run.typeMap.set(type.ref, id);
        addTo(decision.action === 'keep' ? run.kept : run.replaced, 'entryTypes');

        const existing = await run.client.query('SELECT id, name, field_type AS "fieldType", config, position FROM type_fields WHERE type_id = $1 ORDER BY position', [id]);
        let position = existing.rows.reduce((top: number, row: any) => Math.max(top, row.position + 1), 0);
        let count = existing.rows.length;

        if (decision.action === 'replace') {
          await run.client.query('UPDATE entry_types SET mappable = $2, updated_at = now() WHERE id = $1', [id, type.mappable]);
        }

        for (const field of type.fields) {
          const match = existing.rows.find((row: any) => row.name.toLowerCase() === field.name.toLowerCase() && row.fieldType === field.fieldType);

          if (match) {
            defs.set(field.ref, {id: match.id, name: match.name, fieldType: match.fieldType, config: match.config});
          } else if (decision.action === 'replace' && count < MAX_FIELDS && !existing.rows.some((row: any) => row.name.toLowerCase() === field.name.toLowerCase())) {
            const row = await run.client.query(
              'INSERT INTO type_fields (type_id, name, field_type, required, position, config) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id',
              [id, field.name, field.fieldType, false, position, JSON.stringify(field.config)],
            );

            position += 1;
            count += 1;
            defs.set(field.ref, {id: row.rows[0].id, name: field.name, fieldType: field.fieldType, config: field.config});
          } else {
            this.warn(run, `${type.name}: the field ${field.name} was not added`);
          }
        }
      }

      run.fieldDefs.set(type.ref, defs);
    }

    for (const type of types) {
      const decision = run.decisions.entryTypes.get(type.ref)!;

      if (decision.action !== 'create' || type.nestMode !== 'chosen') {
        continue;
      }

      for (const parent of type.parents) {
        const parentId = run.typeMap.get(parent);

        if (parentId) {
          await run.client.query('INSERT INTO type_parent_rules (world_id, type_id, parent_type_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [run.worldId, run.typeMap.get(type.ref), parentId]);
        }
      }
    }
  }

  private async importRelationshipTypes(run: Run) {
    for (const type of run.doc.relationshipTypes.filter((item) => run.chosen.relationshipTypes.has(item.ref))) {
      const decision = run.decisions.relationshipTypes.get(type.ref)!;
      let id: string;

      if (decision.action === 'create') {
        const created = await run.client.query(
          'INSERT INTO relationship_types (world_id, name, description, from_any, to_any) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [run.worldId, decision.name, type.description, type.fromAny, type.toAny],
        );

        id = created.rows[0].id;
        addTo(run.created, 'relationshipTypes');
      } else {
        id = decision.existingId!;
        addTo(decision.action === 'keep' ? run.kept : run.replaced, 'relationshipTypes');

        if (decision.action === 'replace') {
          await run.client.query('UPDATE relationship_types SET description = $2, from_any = from_any OR $3, to_any = to_any OR $4, updated_at = now() WHERE id = $1', [id, type.description, type.fromAny, type.toAny]);
        }
      }

      run.relationshipTypeMap.set(type.ref, id);

      if (decision.action === 'keep') {
        continue;
      }

      for (const [side, refs] of [['from', type.from], ['to', type.to]] as [string, string[]][]) {
        for (const ref of refs) {
          const typeId = run.typeMap.get(ref);

          if (typeId) {
            await run.client.query('INSERT INTO relationship_type_ends (world_id, relationship_type_id, side, entry_type_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [run.worldId, id, side, typeId]);
          }
        }
      }
    }
  }

  private async importTags(run: Run) {
    for (const tag of run.doc.tags.filter((item) => run.chosen.tags.has(item.ref))) {
      const decision = run.decisions.tags.get(tag.ref)!;

      if (decision.action === 'create') {
        const created = await run.client.query('INSERT INTO tags (world_id, name, color, rule_match) VALUES ($1, $2, $3, $4) RETURNING id', [run.worldId, decision.name, tag.color, tag.ruleMatch]);

        run.tagMap.set(tag.ref, created.rows[0].id);
        addTo(run.created, 'tags');
      } else {
        run.tagMap.set(tag.ref, decision.existingId!);
        addTo(decision.action === 'keep' ? run.kept : run.replaced, 'tags');

        if (decision.action === 'replace') {
          await run.client.query('UPDATE tags SET color = $2, rule_match = $3, updated_at = now() WHERE id = $1', [decision.existingId, tag.color, tag.ruleMatch]);
        }
      }
    }
  }

  private mapFields(run: Run, entry: TransferDocument['entries'][number]) {
    const defs = entry.typeRef ? run.fieldDefs.get(entry.typeRef) : null;
    const result: Record<string, any> = {};
    let dropped = 0;

    for (const fieldRef of Object.keys(entry.fields)) {
      const def = defs ? defs.get(fieldRef) : null;

      if (!def) {
        dropped += 1;

        continue;
      }

      try {
        Object.assign(result, applyFieldValues([def], {}, {[def.id]: entry.fields[fieldRef]}));
      } catch {
        dropped += 1;
      }
    }

    if (dropped > 0) {
      this.warn(run, `${entry.name}: ${dropped} field ${dropped === 1 ? 'value was' : 'values were'} not imported`);
    }

    return result;
  }

  private async importEntries(run: Run) {
    const entries = run.doc.entries.filter((entry) => run.chosen.entries.has(entry.ref));
    const renamed = new Map<string, string>();

    for (const entry of entries) {
      const decision = run.decisions.entries.get(entry.ref)!;

      if (decision.action === 'create' && decision.name !== decision.original) {
        renamed.set(decision.original.toLowerCase(), decision.name);
      }
    }

    for (const entry of entries) {
      const decision = run.decisions.entries.get(entry.ref)!;
      const typeId = entry.typeRef ? (run.typeMap.get(entry.typeRef) ?? null) : null;
      const description = rewriteLinks(entry.description, renamed);
      const fields = this.mapFields(run, entry);

      if (decision.action === 'keep') {
        run.entryMap.set(entry.ref, decision.existingId!);
        addTo(run.kept, 'entries');

        continue;
      }

      let id: string;

      if (decision.action === 'create') {
        const created = await run.client.query(
          'INSERT INTO entries (world_id, type_id, name, description, created_by, fields) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id',
          [run.worldId, typeId, decision.name, description, run.userId, JSON.stringify(fields)],
        );

        id = created.rows[0].id;
        addTo(run.created, 'entries');
        await run.client.query('INSERT INTO activity_log (world_id, entry_id, action, entry_name, user_id) VALUES ($1, $2, $3, $4, $5)', [run.worldId, id, 'created', decision.name, run.userId]);
      } else {
        id = decision.existingId!;
        await run.client.query(
          `UPDATE entries
           SET fields = CASE WHEN type_id IS NOT DISTINCT FROM $2::uuid THEN fields || $4::jsonb ELSE $4::jsonb END,
               type_id = $2, description = $3, version = version + 1, updated_at = now()
           WHERE id = $1`,
          [id, typeId, description, JSON.stringify(fields)],
        );
        addTo(run.replaced, 'entries');
        await run.client.query('INSERT INTO activity_log (world_id, entry_id, action, entry_name, user_id) VALUES ($1, $2, $3, $4, $5)', [run.worldId, id, 'updated', decision.name, run.userId]);
      }

      run.entryMap.set(entry.ref, id);
      run.entryTypeIds.set(id, typeId);
      run.changedEntries.add(entry.ref);

      if (run.plan.options.images && entry.images.some((image) => image.data)) {
        await this.importEntryImages(run, entry, id, decision.action === 'replace');
      }

      for (const tagRef of entry.tags) {
        const tagId = run.tagMap.get(tagRef);

        if (tagId) {
          await run.client.query('INSERT INTO entry_tags (entry_id, tag_id, world_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, tagId, run.worldId]);
        }
      }
    }

    for (const entry of entries) {
      const id = run.entryMap.get(entry.ref)!;
      const parentId = entry.parentRef ? run.entryMap.get(entry.parentRef) : null;

      if (!run.changedEntries.has(entry.ref) || !parentId) {
        continue;
      }

      try {
        await this.nesting.assertParent(run.client, run.worldId, id, run.entryTypeIds.get(id) ?? null, parentId);
        await run.client.query('UPDATE entries SET parent_id = $2 WHERE id = $1', [id, parentId]);
      } catch (err) {
        if (!(err instanceof BadRequestException)) {
          throw err;
        }

        this.warn(run, `${entry.name}: the parent was not set`);
      }
    }

    const keptIds = Array.from(run.entryMap.values()).filter((id) => !run.entryTypeIds.has(id));

    if (keptIds.length > 0) {
      const found = await run.client.query('SELECT id, type_id AS "typeId" FROM active_entries WHERE id = ANY($1::uuid[])', [keptIds]);

      for (const row of found.rows) {
        run.entryTypeIds.set(row.id, row.typeId);
      }
    }
  }

  private async importEntryImages(run: Run, entry: TransferDocument['entries'][number], entryId: string, replacing: boolean) {
    if (replacing) {
      const old = await run.client.query('DELETE FROM entry_images WHERE entry_id = $1 RETURNING storage_key AS "storageKey"', [entryId]);

      for (const row of old.rows) {
        run.removeAfter.push(row.storageKey);
      }
    }

    for (const image of entry.images) {
      const buffer = decodeImage(image.data, MAX_ENTRY_IMAGE);
      const type = buffer ? detectImageType(buffer) : null;

      if (!buffer || !type) {
        this.warn(run, `${entry.name}: an image was skipped`);

        continue;
      }

      const key = `worlds/${run.worldId}/entries/${entryId}/${randomUUID()}.${type.ext}`;

      await this.upload(run, key, buffer, type.mime);

      const row = await run.client.query('INSERT INTO entry_images (entry_id, storage_key, position) VALUES ($1, $2, $3) RETURNING id', [entryId, key, image.position]);

      run.imageIds.set(`${entry.ref}:${image.position}`, row.rows[0].id);
    }
  }

  private async importTagRules(run: Run) {
    for (const tag of run.doc.tags.filter((item) => run.chosen.tags.has(item.ref))) {
      const decision = run.decisions.tags.get(tag.ref)!;

      if (decision.action === 'keep') {
        continue;
      }

      const tagId = run.tagMap.get(tag.ref)!;

      await run.client.query('DELETE FROM tag_rule_conditions WHERE tag_id = $1', [tagId]);
      await run.client.query('DELETE FROM tag_rule_entries WHERE tag_id = $1', [tagId]);

      for (const [index, condition] of tag.conditions.entries()) {
        const typeId = condition.typeRef ? (run.typeMap.get(condition.typeRef) ?? null) : null;
        const relationshipTypeId = condition.relationshipTypeRef ? (run.relationshipTypeMap.get(condition.relationshipTypeRef) ?? null) : null;
        const otherEntryId = condition.otherEntryRef ? (run.entryMap.get(condition.otherEntryRef) ?? null) : null;
        const insideEntryId = condition.insideEntryRef ? (run.entryMap.get(condition.insideEntryRef) ?? null) : null;

        await run.client.query(
          `INSERT INTO tag_rule_conditions (world_id, tag_id, position, exclude, kind, entry_type_id, relationship_type_id, side, other_any, other_entry_id, inside_entry_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [run.worldId, tagId, index, condition.exclude, condition.kind, typeId, relationshipTypeId, condition.side, condition.otherAny, otherEntryId, insideEntryId],
        );
      }

      for (const item of tag.ruleEntries) {
        const entryId = run.entryMap.get(item.entryRef);

        if (entryId) {
          await run.client.query('INSERT INTO tag_rule_entries (world_id, tag_id, entry_id, exclude) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [run.worldId, tagId, entryId, item.exclude]);
        }
      }
    }
  }

  private async importRelationships(run: Run) {
    const rules = new Map<string, {fromAny: boolean; toAny: boolean; from: Set<string>; to: Set<string>}>();

    for (const relationship of run.doc.relationships.filter((item) => run.chosen.relationships.has(item.ref))) {
      const typeId = run.relationshipTypeMap.get(relationship.typeRef);
      const fromId = run.entryMap.get(relationship.fromRef);
      const toId = run.entryMap.get(relationship.toRef);

      if (!typeId || !fromId || !toId || fromId === toId) {
        addTo(run.skipped, 'relationships');

        continue;
      }

      if (!rules.has(typeId)) {
        const type = await run.client.query('SELECT from_any AS "fromAny", to_any AS "toAny" FROM relationship_types WHERE id = $1', [typeId]);
        const ends = await run.client.query('SELECT side, entry_type_id AS "entryTypeId" FROM relationship_type_ends WHERE relationship_type_id = $1', [typeId]);

        rules.set(typeId, {
          fromAny: type.rows[0].fromAny,
          toAny: type.rows[0].toAny,
          from: new Set(ends.rows.filter((end: any) => end.side === 'from').map((end: any) => end.entryTypeId)),
          to: new Set(ends.rows.filter((end: any) => end.side === 'to').map((end: any) => end.entryTypeId)),
        });
      }

      const rule = rules.get(typeId)!;
      const fromType = run.entryTypeIds.get(fromId) ?? null;
      const toType = run.entryTypeIds.get(toId) ?? null;
      const allowed = (rule.fromAny || (fromType !== null && rule.from.has(fromType))) && (rule.toAny || (toType !== null && rule.to.has(toType)));

      if (!allowed) {
        addTo(run.skipped, 'relationships');

        continue;
      }

      const inserted = await run.client.query(
        'INSERT INTO relationships (world_id, relationship_type_id, from_entry_id, to_entry_id, created_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id',
        [run.worldId, typeId, fromId, toId, run.userId],
      );

      addTo(inserted.rows[0] ? run.created : run.kept, 'relationships');
    }

    if (run.skipped.relationships) {
      this.warn(run, `${run.skipped.relationships} ${run.skipped.relationships === 1 ? 'relationship was' : 'relationships were'} skipped because the entries or type do not allow it`);
    }
  }

  private async importMaps(run: Run) {
    const maps = run.doc.maps.filter((map) => run.chosen.maps.has(map.ref));
    const limit = await run.client.query('SELECT max_maps AS "maxMaps", (SELECT count(*)::int FROM maps WHERE world_id = $1) AS used FROM worlds WHERE id = $1', [run.worldId]);
    const adding = maps.filter((map) => run.decisions.maps.get(map.ref)!.action === 'create').length;

    if (limit.rows[0].used + adding > limit.rows[0].maxMaps) {
      const max = limit.rows[0].maxMaps;

      throw new BadRequestException(`A world can have up to ${max} ${max === 1 ? 'map' : 'maps'}`);
    }

    const mappable = new Map<string, boolean>();
    const types = await run.client.query('SELECT id, mappable FROM entry_types WHERE world_id = $1', [run.worldId]);

    for (const row of types.rows) {
      mappable.set(row.id, row.mappable);
    }

    for (const map of maps) {
      const decision = run.decisions.maps.get(map.ref)!;

      if (decision.action === 'keep') {
        addTo(run.kept, 'maps');

        continue;
      }

      const buffer = decodeImage(map.image ? map.image.data : null, MAX_MAP_IMAGE);
      const type = buffer ? detectImageType(buffer) : null;

      if (!buffer || !type) {
        throw new BadRequestException(`The image for the map ${map.name} is missing or not valid`);
      }

      const key = `worlds/${run.worldId}/maps/${randomUUID()}.${type.ext}`;
      let mapId: string;

      await this.upload(run, key, buffer, type.mime);

      if (decision.action === 'create') {
        const created = await run.client.query('INSERT INTO maps (world_id, name, storage_key, created_by) VALUES ($1, $2, $3, $4) RETURNING id', [run.worldId, decision.name, key, run.userId]);

        mapId = created.rows[0].id;
        addTo(run.created, 'maps');
      } else {
        mapId = decision.existingId!;

        const old = await run.client.query('SELECT storage_key AS "storageKey" FROM maps WHERE id = $1', [mapId]);

        run.removeAfter.push(old.rows[0].storageKey);
        await run.client.query('UPDATE maps SET storage_key = $2, updated_at = now() WHERE id = $1', [mapId, key]);
        await run.client.query('DELETE FROM map_markers WHERE map_id = $1', [mapId]);
        addTo(run.replaced, 'maps');
      }

      let skipped = 0;

      for (const marker of map.markers) {
        const entryId = run.entryMap.get(marker.entryRef);
        const typeId = entryId ? (run.entryTypeIds.get(entryId) ?? null) : null;

        if (!entryId || !typeId || !mappable.get(typeId)) {
          skipped += 1;

          continue;
        }

        const imageId = marker.imagePosition === null ? null : (run.imageIds.get(`${marker.entryRef}:${marker.imagePosition}`) ?? null);

        await run.client.query(
          `INSERT INTO map_markers (map_id, world_id, entry_id, image_id, color, inner_color, image_scale, image_x, image_y, x, y, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT DO NOTHING`,
          [mapId, run.worldId, entryId, imageId, marker.color, marker.innerColor, marker.imageScale, marker.imageX, marker.imageY, marker.x, marker.y, run.userId],
        );
      }

      if (skipped > 0) {
        this.warn(run, `${map.name}: ${skipped} ${skipped === 1 ? 'pin was' : 'pins were'} skipped because the entry is not imported or can not be pinned`);
      }
    }
  }

  private async importNotes(run: Run) {
    for (const kind of ['comments', 'notes'] as const) {
      if (!run.plan.options[kind]) {
        continue;
      }

      const table = kind === 'comments' ? 'comments' : 'notes';

      for (const entry of run.doc.entries) {
        const entryId = run.entryMap.get(entry.ref);

        if (!entryId || !run.changedEntries.has(entry.ref)) {
          continue;
        }

        for (const note of entry[kind]) {
          const created = note.createdAt ?? new Date().toISOString();

          await run.client.query(
            `INSERT INTO ${table} (world_id, entry_id, author_id, author_label, body, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [run.worldId, entryId, run.userId, `${note.author} (Imported by ${run.username})`, note.body, created],
          );
          addTo(run.created, kind);
        }
      }
    }
  }

  private async createWorld(run: Run, doc: TransferDocument) {
    const name = run.plan.world.name || doc.world.name;

    if (name.length > 100) {
      throw new BadRequestException('World name can only be up to 100 characters');
    }

    if (run.plan.world.description.length > 5000) {
      throw new BadRequestException('World description can only be up to 5000 characters');
    }

    const created = await run.client.query('INSERT INTO worlds (name, description) VALUES ($1, $2) RETURNING id', [name, run.plan.world.description || doc.world.description]);
    const id = created.rows[0].id;

    await run.client.query('INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, $3)', [id, run.userId, 'owner']);

    const buffer = run.plan.options.images && doc.world.thumbnail ? decodeImage(doc.world.thumbnail.data, MAX_THUMBNAIL) : null;
    const type = buffer ? detectImageType(buffer) : null;

    if (buffer && type) {
      const key = `worlds/${id}/thumbnail-${randomUUID()}.${type.ext}`;

      await this.upload(run, key, buffer, type.mime);
      await run.client.query('UPDATE worlds SET thumbnail_key = $2 WHERE id = $1', [id, key]);
    }

    return id as string;
  }

  async run(userId: string, username: string, doc: TransferDocument, plan: ImportPlan, targetWorldId: string | null) {
    const manifest = buildManifest(doc);
    const selected = closeSelection(manifest, plan.select);
    const total = selected.entryTypes.length + selected.relationshipTypes.length + selected.tags.length + selected.entries.length + selected.relationships.length + selected.maps.length;

    if (total === 0) {
      throw new BadRequestException('Select something to import');
    }

    const uploaded: string[] = [];
    const removeAfter: string[] = [];
    let summary: any;

    try {
      summary = await this.db.transaction(async (client) => {
        const run: Run = {
          client,
          worldId: '',
          userId,
          username,
          doc,
          plan,
          chosen: {entryTypes: new Set(selected.entryTypes), relationshipTypes: new Set(selected.relationshipTypes), tags: new Set(selected.tags), entries: new Set(selected.entries), relationships: new Set(selected.relationships), maps: new Set(selected.maps)},
          warnings: [],
          uploaded,
          removeAfter,
          decisions: {},
          typeMap: new Map(),
          relationshipTypeMap: new Map(),
          tagMap: new Map(),
          entryMap: new Map(),
          fieldDefs: new Map(),
          entryTypeIds: new Map(),
          changedEntries: new Set(),
          imageIds: new Map(),
          created: {},
          replaced: {},
          kept: {},
          skipped: {},
        };

        if (targetWorldId) {
          const locked = await client.query('SELECT id FROM worlds WHERE id = $1 FOR UPDATE', [targetWorldId]);

          if (!locked.rows[0]) {
            throw new NotFoundException('World not found');
          }

          run.worldId = targetWorldId;
        } else {
          run.worldId = await this.createWorld(run, doc);
        }

        const existing = await this.existingNames(client, targetWorldId);

        this.decide(run, 'entryTypes', doc.entryTypes.filter((item) => run.chosen.entryTypes.has(item.ref)), existing.entryTypes);
        this.decide(run, 'relationshipTypes', doc.relationshipTypes.filter((item) => run.chosen.relationshipTypes.has(item.ref)), existing.relationshipTypes);
        this.decide(run, 'tags', doc.tags.filter((item) => run.chosen.tags.has(item.ref)), existing.tags);
        this.decide(run, 'entries', doc.entries.filter((item) => run.chosen.entries.has(item.ref)), existing.entries);
        this.decide(run, 'maps', doc.maps.filter((item) => run.chosen.maps.has(item.ref)), existing.maps);

        await this.importTypes(run);
        await this.importRelationshipTypes(run);
        await this.importTags(run);
        await this.importEntries(run);
        await this.importTagRules(run);
        await this.importRelationships(run);
        await this.importMaps(run);
        await this.importNotes(run);
        await client.query('UPDATE worlds SET updated_at = now() WHERE id = $1', [run.worldId]);

        return {worldId: run.worldId, created: run.created, replaced: run.replaced, kept: run.kept, skipped: run.skipped, warnings: run.warnings};
      });
    } catch (err: any) {
      await Promise.all(uploaded.map((key) => this.storage.remove(key).catch(() => null)));

      if (err && err.code === '23505') {
        throw new BadRequestException('A name in the file is used more than once');
      }

      throw err;
    }

    await Promise.all(removeAfter.map((key) => this.storage.remove(key).catch(() => null)));

    return summary;
  }
}
