import { BadRequestException } from '@nestjs/common';
import { datesProblem, normalizeDates, TimelineDates } from '../timeline/timeline-dates';

export const FORMAT_NAME = 'worldbuilder-export';
export const FORMAT_VERSION = 1;

export const LIMITS = {
  //entryTypes: 200,
  fields: 33,
  //relationshipTypes: 500,
  //tags: 2000,
  //entries: 20000,
  //relationships: 100000,
  //maps: 50,
  //markers: 5000,
  conditions: 20,
  //comments: 500,
  images: 5,
};

export const MAX_ENTRY_IMAGE = 5 * 1024 * 1024;
export const MAX_MAP_IMAGE = 100 * 1024 * 1024;
export const MAX_THUMBNAIL = 2 * 1024 * 1024;

export interface ImageData {
  data: string | null;
}

export interface TransferField {
  ref: string;
  name: string;
  fieldType: string;
  required: boolean;
  position: number;
  config: any;
}

export interface TransferType {
  ref: string;
  name: string;
  nestMode: string;
  mappable: boolean;
  timelineable: boolean;
  fields: TransferField[];
  parents: string[];
}

export interface TransferRelationshipType {
  ref: string;
  name: string;
  description: string;
  fromAny: boolean;
  toAny: boolean;
  from: string[];
  to: string[];
}

export interface TransferCondition {
  exclude: boolean;
  kind: string;
  typeRef: string | null;
  relationshipTypeRef: string | null;
  side: string | null;
  otherAny: boolean;
  otherEntryRef: string | null;
  insideEntryRef: string | null;
  fieldRef: string | null;
  op: string | null;
  value: any;
}

export interface TransferTag {
  ref: string;
  name: string;
  color: string | null;
  ruleMatch: string;
  conditions: TransferCondition[];
  ruleEntries: {entryRef: string; exclude: boolean}[];
}

export interface TransferNote {
  author: string;
  body: string;
  createdAt: string | null;
}

export interface TransferEntry {
  ref: string;
  name: string;
  typeRef: string | null;
  description: string;
  parentRef: string | null;
  fields: Record<string, any>;
  tags: string[];
  images: {position: number; data: string | null}[];
  comments: TransferNote[];
  notes: TransferNote[];
  timeline: (TimelineDates & {color: string | null}) | null;
}

export interface TransferRelationship {
  ref: string;
  typeRef: string;
  fromRef: string;
  toRef: string;
}

export interface TransferMarker {
  entryRef: string;
  imagePosition: number | null;
  color: string;
  innerColor: string;
  imageScale: number;
  imageX: number;
  imageY: number;
  x: number;
  y: number;
}

export interface TransferMap {
  ref: string;
  name: string;
  image: ImageData | null;
  markers: TransferMarker[];
}

export interface TransferDocument {
  format: string;
  version: number;
  exportedAt: string | null;
  exportedBy: string | null;
  world: {name: string; description: string; thumbnail: ImageData | null};
  entryTypes: TransferType[];
  relationshipTypes: TransferRelationshipType[];
  tags: TransferTag[];
  entries: TransferEntry[];
  relationships: TransferRelationship[];
  maps: TransferMap[];
}

const FIELD_TYPES = ['text', 'long_text', 'number', 'boolean', 'scale', 'choice', 'multi_choice'];
const NEST_MODES = ['none', 'chosen', 'all', 'own'];
const COLOR = /^#[0-9a-fA-F]{6}$/;

function fail(message: string): never {
  throw new BadRequestException(`Import file is not valid: ${message}`);
}

function object(value: any, what: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${what} must be an object`);
  }

  return value;
}

//function array(value: any, what: string, max: number) {
function array(value: any, what: string, max = Infinity) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${what} must be a list`);
  }

  if (value.length > max) {
    fail(`${what} can only have up to ${max} items`);
  }

  return value;
}

function text(value: any, what: string, max: number, required = true) {
  if (value === undefined || value === null) {
    if (required) {
      fail(`${what} is missing`);
    }

    return '';
  }

  if (typeof value !== 'string') {
    fail(`${what} must be text`);
  }

  const trimmed = required ? value.trim() : value;

  if (required && !trimmed) {
    fail(`${what} can not be blank`);
  }

  if (trimmed.length > max) {
    fail(`${what} can only be up to ${max} characters`);
  }

  return trimmed;
}

function ref(value: any, what: string) {
  return text(value, what, 100);
}

function optionalRef(value: any, what: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return ref(value, what);
}

function flag(value: any, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function number(value: any, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function image(value: any, what: string): ImageData | null {
  if (value === undefined || value === null) {
    return null;
  }

  const input = object(value, what);

  if (input.data !== undefined && input.data !== null && typeof input.data !== 'string') {
    fail(`${what} data must be text`);
  }

  return {data: input.data ?? null};
}

function uniqueRefs(items: {ref: string}[], what: string) {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.ref)) {
      fail(`${what} has a repeated id`);
    }

    seen.add(item.ref);
  }
}

//function refList(value: any, what: string, max: number) {
function refList(value: any, what: string, max = Infinity) {
  return array(value, what, max).map((item: any) => ref(item, what));
}

function parseNotes(value: any, what: string): TransferNote[] {
  //return array(value, what, LIMITS.comments).map((item: any) => {
  return array(value, what).map((item: any) => {
    const input = object(item, what);
    const created = typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt)) ? new Date(input.createdAt).toISOString() : null;

    return {author: text(input.author, `${what} author`, 100, false) || 'Unknown', body: text(input.body, `${what} text`, 5000), createdAt: created};
  });
}

function parseType(value: any): TransferType {
  const input = object(value, 'An entry type');
  const name = text(input.name, 'An entry type name', 50);
  const nestMode = NEST_MODES.includes(input.nestMode) ? input.nestMode : 'none';
  const fields = array(input.fields, `${name} fields`, LIMITS.fields).map((item: any, index: number) => {
    const field = object(item, `A field of ${name}`);
    const fieldType = FIELD_TYPES.includes(field.fieldType) ? field.fieldType : fail(`A field of ${name} has an unknown type`);

    return {
      ref: ref(field.ref, 'A field id'),
      name: text(field.name, `A field name of ${name}`, 50),
      fieldType,
      required: flag(field.required, false),
      position: Number.isInteger(field.position) ? field.position : index,
      config: field.config && typeof field.config === 'object' && !Array.isArray(field.config) ? field.config : {},
    };
  });

  uniqueRefs(fields, `${name} fields`);

  //return {ref: ref(input.ref, 'An entry type id'), name, nestMode, mappable: flag(input.mappable, false), fields, parents: refList(input.parents, `${name} parents`, LIMITS.entryTypes)};
  return {ref: ref(input.ref, 'An entry type id'), name, nestMode, mappable: flag(input.mappable, false), timelineable: flag(input.timelineable, false), fields, parents: refList(input.parents, `${name} parents`)};
}

function parseRelationshipType(value: any): TransferRelationshipType {
  const input = object(value, 'A relationship type');

  return {
    ref: ref(input.ref, 'A relationship type id'),
    name: text(input.name, 'A relationship type name', 50),
    description: text(input.description, 'A relationship type description', 500, false),
    fromAny: flag(input.fromAny, true),
    toAny: flag(input.toAny, true),
    //from: refList(input.from, 'A relationship type start', LIMITS.entryTypes),
    //to: refList(input.to, 'A relationship type end', LIMITS.entryTypes),
    from: refList(input.from, 'A relationship type start'),
    to: refList(input.to, 'A relationship type end'),
  };
}

function conditionValue(value: any) {
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
    return value;
  }

  if (Array.isArray(value) && value.length <= 100 && value.every((item) => (typeof item === 'string' && item.length <= 200) || (typeof item === 'number' && Number.isFinite(item)))) {
    return value;
  }

  return null;
}

function parseTag(value: any): TransferTag {
  const input = object(value, 'A tag');
  const name = text(input.name, 'A tag name', 50);
  const conditions = array(input.conditions, `${name} conditions`, LIMITS.conditions).map((item: any) => {
    const condition = object(item, `A condition of ${name}`);
    const kind = ['type', 'relationship', 'inside', 'detail'].includes(condition.kind) ? condition.kind : fail(`A condition of ${name} has an unknown kind`);
    const side = ['from', 'to', 'either'].includes(condition.side) ? condition.side : null;

    return {
      exclude: flag(condition.exclude, false),
      kind,
      typeRef: optionalRef(condition.typeRef, 'A condition type'),
      relationshipTypeRef: optionalRef(condition.relationshipTypeRef, 'A condition relationship type'),
      side,
      otherAny: flag(condition.otherAny, true),
      otherEntryRef: optionalRef(condition.otherEntryRef, 'A condition entry'),
      insideEntryRef: optionalRef(condition.insideEntryRef, 'A condition entry'),
      fieldRef: optionalRef(condition.fieldRef, 'A condition field'),
      op: typeof condition.op === 'string' ? condition.op.slice(0, 20) : null,
      value: conditionValue(condition.value),
    };
  });

  //const ruleEntries = array(input.ruleEntries, `${name} rule entries`, LIMITS.entries).map((item: any) => {
  const ruleEntries = array(input.ruleEntries, `${name} rule entries`).map((item: any) => {
    const entry = object(item, `A rule entry of ${name}`);

    return {entryRef: ref(entry.entryRef, 'A rule entry id'), exclude: flag(entry.exclude, false)};
  });

  return {
    ref: ref(input.ref, 'A tag id'),
    name,
    color: typeof input.color === 'string' && COLOR.test(input.color) ? input.color.toLowerCase() : null,
    ruleMatch: input.ruleMatch === 'any' ? 'any' : 'all',
    conditions,
    ruleEntries,
  };
}

function parseTimeline(value: any, name: string) {
  if (value === undefined || value === null) {
    return null;
  }

  const input = object(value, `${name} timeline`);
  const dates = normalizeDates(input);
  const problem = datesProblem(dates);

  if (problem) {
    fail(`${name} timeline: ${problem}`);
  }

  return Object.assign({}, dates, {color: typeof input.color === 'string' && COLOR.test(input.color) ? input.color.toLowerCase() : null});
}

function parseEntry(value: any): TransferEntry {
  const input = object(value, 'An entry');
  const name = text(input.name, 'An entry name', 100);
  const fields = input.fields === undefined || input.fields === null ? {} : object(input.fields, `${name} fields`);
  const images = array(input.images, `${name} images`, LIMITS.images).map((item: any, index: number) => {
    const entry = object(item, `An image of ${name}`);
    const position = Number.isInteger(entry.position) && entry.position >= 0 && entry.position < LIMITS.images ? entry.position : index;
    const data = image(entry, `An image of ${name}`);

    return {position, data: data ? data.data : null};
  });

  if (new Set(images.map((item: any) => item.position)).size !== images.length) {
    fail(`${name} has two images in the same place`);
  }

  return {
    ref: ref(input.ref, 'An entry id'),
    name,
    typeRef: optionalRef(input.typeRef, 'An entry type'),
    description: text(input.description, `${name} description`, 20000, false),
    parentRef: optionalRef(input.parentRef, 'An entry parent'),
    fields,
    //tags: refList(input.tags, `${name} tags`, LIMITS.tags),
    tags: refList(input.tags, `${name} tags`),
    images,
    comments: parseNotes(input.comments, `${name} comments`),
    notes: parseNotes(input.notes, `${name} notes`),
    timeline: parseTimeline(input.timeline, name),
  };
}

function parseRelationship(value: any): TransferRelationship {
  const input = object(value, 'A relationship');

  return {ref: ref(input.ref, 'A relationship id'), typeRef: ref(input.typeRef, 'A relationship type'), fromRef: ref(input.fromRef, 'A relationship start'), toRef: ref(input.toRef, 'A relationship end')};
}

function parseMap(value: any): TransferMap {
  const input = object(value, 'A map');
  const name = text(input.name, 'A map name', 100);
  //const markers = array(input.markers, `${name} pins`, LIMITS.markers).map((item: any) => {
  const markers = array(input.markers, `${name} pins`).map((item: any) => {
    const marker = object(item, `A pin of ${name}`);
    const x = number(marker.x, -1);
    const y = number(marker.y, -1);

    if (x < 0 || x > 1 || y < 0 || y > 1) {
      fail(`A pin of ${name} is outside the map`);
    }

    return {
      entryRef: ref(marker.entryRef, 'A pin entry'),
      imagePosition: Number.isInteger(marker.imagePosition) ? marker.imagePosition : null,
      color: typeof marker.color === 'string' && COLOR.test(marker.color) ? marker.color : '#d93025',
      innerColor: typeof marker.innerColor === 'string' && COLOR.test(marker.innerColor) ? marker.innerColor : '#ffffff',
      imageScale: Math.min(4, Math.max(1, number(marker.imageScale, 1))),
      imageX: Math.min(1, Math.max(-1, number(marker.imageX, 0))),
      imageY: Math.min(1, Math.max(-1, number(marker.imageY, 0))),
      x,
      y,
    };
  });

  return {ref: ref(input.ref, 'A map id'), name, image: image(input.image, `${name} image`), markers};
}

export function parseDocument(buffer: Buffer): TransferDocument {
  let raw: any;

  try {
    raw = JSON.parse(buffer.toString('utf8'));
  } catch {
    fail('the file is not JSON');
  }

  const input = object(raw, 'The file');

  if (input.format !== FORMAT_NAME) {
    fail('this is not a Worldbuilder export');
  }

  if (input.version !== FORMAT_VERSION) {
    fail(`version ${String(input.version)} is not supported`);
  }

  const world = object(input.world ?? {}, 'The world');
  const entryTypes = array(input.entryTypes, 'Entry types').map(parseType);
  const relationshipTypes = array(input.relationshipTypes, 'Relationship types').map(parseRelationshipType);
  const tags = array(input.tags, 'Tags').map(parseTag);
  const entries = array(input.entries, 'Entries').map(parseEntry);
  const relationships = array(input.relationships, 'Relationships').map(parseRelationship);
  const maps = array(input.maps, 'Maps').map(parseMap);
  /**const entryTypes = array(input.entryTypes, 'Entry types', LIMITS.entryTypes).map(parseType);
  const relationshipTypes = array(input.relationshipTypes, 'Relationship types', LIMITS.relationshipTypes).map(parseRelationshipType);
  const tags = array(input.tags, 'Tags', LIMITS.tags).map(parseTag);
  const entries = array(input.entries, 'Entries', LIMITS.entries).map(parseEntry);
  const relationships = array(input.relationships, 'Relationships', LIMITS.relationships).map(parseRelationship);
  const maps = array(input.maps, 'Maps', LIMITS.maps).map(parseMap);**/

  uniqueRefs(entryTypes, 'Entry types');
  uniqueRefs(relationshipTypes, 'Relationship types');
  uniqueRefs(tags, 'Tags');
  uniqueRefs(entries, 'Entries');
  uniqueRefs(relationships, 'Relationships');
  uniqueRefs(maps, 'Maps');

  return {
    format: FORMAT_NAME,
    version: FORMAT_VERSION,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : null,
    exportedBy: typeof input.exportedBy === 'string' ? input.exportedBy : null,
    world: {name: text(world.name, 'The world name', 100, false) || 'Imported world', description: text(world.description, 'The world description', 5000, false), thumbnail: image(world.thumbnail, 'The world image')},
    entryTypes,
    relationshipTypes,
    tags,
    entries,
    relationships,
    maps,
  };
}

export function decodeImage(data: string | null, max: number) {
  if (!data) {
    return null;
  }

  const buffer = Buffer.from(data, 'base64');

  if (buffer.length === 0 || buffer.length > max) {
    return null;
  }

  return buffer;
}
