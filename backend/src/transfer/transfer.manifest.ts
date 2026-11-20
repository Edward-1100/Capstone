import { TransferDocument } from './transfer.format';

export const CATEGORIES = ['entryTypes', 'relationshipTypes', 'tags', 'entries', 'relationships', 'maps'] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Needs {
  entryTypes: string[];
  relationshipTypes: string[];
  entries: string[];
  tags: string[];
}

export interface ManifestItem {
  ref: string;
  name: string;
  detail: string;
  needs: Needs;
}

export type Manifest = Record<Category, ManifestItem[]>;

export type Selection = Record<Category, string[]>;

const NEED_KEYS = ['entryTypes', 'relationshipTypes', 'entries', 'tags'] as const;

export function emptySelection(): Selection {
  return {entryTypes: [], relationshipTypes: [], tags: [], entries: [], relationships: [], maps: []};
}

function needs(values: Partial<Needs>): Needs {
  return {entryTypes: values.entryTypes ?? [], relationshipTypes: values.relationshipTypes ?? [], entries: values.entries ?? [], tags: values.tags ?? []};
}

function present(values: (string | null)[]) {
  return values.filter((value): value is string => typeof value === 'string');
}

export function buildManifest(doc: TransferDocument): Manifest {
  const typeNames = new Map(doc.entryTypes.map((type) => [type.ref, type.name]));
  const relationshipNames = new Map(doc.relationshipTypes.map((type) => [type.ref, type.name]));
  const entryNames = new Map(doc.entries.map((entry) => [entry.ref, entry.name]));

  return {
    entryTypes: doc.entryTypes.map((type) => ({
      ref: type.ref,
      name: type.name,
      detail: `${type.fields.length} ${type.fields.length === 1 ? 'field' : 'fields'}`,
      needs: needs({entryTypes: type.parents}),
    })),
    relationshipTypes: doc.relationshipTypes.map((type) => ({
      ref: type.ref,
      name: type.name,
      detail: type.description,
      needs: needs({entryTypes: type.from.concat(type.to)}),
    })),
    tags: doc.tags.map((tag) => ({
      ref: tag.ref,
      name: tag.name,
      detail: tag.conditions.length > 0 ? 'rule' : '',
      needs: needs({
        entryTypes: present(tag.conditions.map((condition) => condition.typeRef)),
        relationshipTypes: present(tag.conditions.map((condition) => condition.relationshipTypeRef)),
        entries: present(tag.conditions.map((condition) => condition.otherEntryRef).concat(tag.conditions.map((condition) => condition.insideEntryRef), tag.ruleEntries.map((item) => item.entryRef))),
      }),
    })),
    entries: doc.entries.map((entry) => ({
      ref: entry.ref,
      name: entry.name,
      detail: entry.typeRef ? (typeNames.get(entry.typeRef) ?? '') : '',
      needs: needs({entryTypes: present([entry.typeRef]), entries: present([entry.parentRef])}),
    })),
    relationships: doc.relationships.map((relationship) => ({
      ref: relationship.ref,
      name: `${entryNames.get(relationship.fromRef) ?? '?'} → ${entryNames.get(relationship.toRef) ?? '?'}`,
      detail: relationshipNames.get(relationship.typeRef) ?? '',
      needs: needs({relationshipTypes: [relationship.typeRef], entries: [relationship.fromRef, relationship.toRef]}),
    })),
    maps: doc.maps.map((map) => ({
      ref: map.ref,
      name: map.name,
      detail: `${map.markers.length} ${map.markers.length === 1 ? 'pin' : 'pins'}`,
      needs: needs({}),
    })),
  };
}

export function closeSelection(manifest: Manifest, selection: Selection): Selection {
  const known: Record<string, Set<string>> = {};
  const chosen: Record<string, Set<string>> = {};

  for (const category of CATEGORIES) {
    known[category] = new Set(manifest[category].map((item) => item.ref));
    chosen[category] = new Set(selection[category].filter((ref) => known[category].has(ref)));
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const category of CATEGORIES) {
      for (const item of manifest[category]) {
        if (!chosen[category].has(item.ref)) {
          continue;
        }

        for (const key of NEED_KEYS) {
          for (const ref of item.needs[key]) {
            if (known[key].has(ref) && !chosen[key].has(ref)) {
              chosen[key].add(ref);
              changed = true;
            }
          }
        }
      }
    }
  }

  return {
    entryTypes: Array.from(chosen.entryTypes),
    relationshipTypes: Array.from(chosen.relationshipTypes),
    tags: Array.from(chosen.tags),
    entries: Array.from(chosen.entries),
    relationships: Array.from(chosen.relationships),
    maps: Array.from(chosen.maps),
  };
}

export function readSelection(value: any): Selection {
  const result = emptySelection();

  if (!value || typeof value !== 'object') {
    return result;
  }

  for (const category of CATEGORIES) {
    const list = value[category];

    if (Array.isArray(list)) {
      result[category] = list.filter((item: any) => typeof item === 'string');
    }
  }

  return result;
}
