import { parseDocument } from './transfer.format';

function parse(content: any) {
  return parseDocument(Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)));
}

function message(content: any) {
  try {
    parse(content);
  } catch (err: any) {
    return err.message;
  }

  return '';
}

const base = {format: 'worldbuilder-export', version: 1, world: {name: 'W'}};

describe('parseDocument', () => {
  it('accepts a minimal file and fills defaults', () => {
    const doc = parse(base);

    expect(doc.world).toEqual({name: 'W', description: '', thumbnail: null});
    expect(doc.entries).toEqual([]);
    expect(doc.maps).toEqual([]);
  });

  it('uses a default world name', () => {
    expect(parse({format: 'worldbuilder-export', version: 1}).world.name).toBe('Imported world');
  });

  it('rejects files that are not exports', () => {
    expect(message('nope')).toBe('Import file is not valid: the file is not JSON');
    expect(message([])).toBe('Import file is not valid: The file must be an object');
    expect(message({format: 'x', version: 1})).toBe('Import file is not valid: this is not a Worldbuilder export');
    expect(message(Object.assign({}, base, {version: 2}))).toBe('Import file is not valid: version 2 is not supported');
  });

  it('rejects broken items', () => {
    expect(message(Object.assign({}, base, {entries: [{ref: 'a'}]}))).toBe('Import file is not valid: An entry name is missing');
    expect(message(Object.assign({}, base, {entries: [{ref: 'a', name: '   '}]}))).toBe('Import file is not valid: An entry name can not be blank');
    expect(message(Object.assign({}, base, {entries: [{ref: 'a', name: 'A'}, {ref: 'a', name: 'B'}]}))).toBe('Import file is not valid: Entries has a repeated id');
    expect(message(Object.assign({}, base, {entries: 'x'}))).toBe('Import file is not valid: Entries must be a list');
    expect(message(Object.assign({}, base, {entryTypes: [{ref: 't', name: 'T', fields: [{ref: 'f', name: 'F', fieldType: 'weird'}]}]}))).toBe('Import file is not valid: A field of T has an unknown type');
    expect(message(Object.assign({}, base, {entries: [{ref: 'a', name: 'A', images: [{position: 0}, {position: 0}]}]}))).toBe('Import file is not valid: A has two images in the same place');
    expect(message(Object.assign({}, base, {maps: [{ref: 'm', name: 'M', markers: [{entryRef: 'a', x: 2, y: 0}]}]}))).toBe('Import file is not valid: A pin of M is outside the map');
    expect(message(Object.assign({}, base, {entryTypes: [{ref: 't', name: 'x'.repeat(51)}]}))).toBe('Import file is not valid: An entry type name can only be up to 50 characters');
  });

  it('cleans marker styling and tag colors', () => {
    const doc = parse(Object.assign({}, base, {
      tags: [{ref: 't', name: 'T', color: 'red'}, {ref: 'u', name: 'U', color: '#AABBCC'}],
      maps: [{ref: 'm', name: 'M', markers: [{entryRef: 'a', x: 0.5, y: 0.5, color: 'blue', imageScale: 9, imageX: -3}]}],
    }));

    expect(doc.tags.map((tag) => tag.color)).toEqual([null, '#aabbcc']);
    expect(doc.maps[0].markers[0]).toMatchObject({color: '#d93025', innerColor: '#ffffff', imageScale: 4, imageX: -1});
  });

  it('keeps field conditions and drops values it cannot use', () => {
    const doc = parse(Object.assign({}, base, {
      tags: [{ref: 't', name: 'T', conditions: [
        {kind: 'detail', typeRef: 'x', fieldRef: 'f', op: 'any', value: ['Mage', 'Rogue']},
        {kind: 'detail', typeRef: 'x', fieldRef: 'f', op: 'gte', value: 4},
        {kind: 'detail', typeRef: 'x', fieldRef: 'f', op: 'is', value: {bad: true}},
      ]}],
    }));

    expect(doc.tags[0].conditions.map((item) => [item.fieldRef, item.op, item.value])).toEqual([['f', 'any', ['Mage', 'Rogue']], ['f', 'gte', 4], ['f', 'is', null]]);
  });

  it('keeps comment details and drops bad dates', () => {
    const doc = parse(Object.assign({}, base, {entries: [{ref: 'a', name: 'A', comments: [{author: 'Sam', body: 'Hi', createdAt: 'later'}, {body: 'Yo', createdAt: '2026-01-02T03:04:05Z'}]}]}));

    expect(doc.entries[0].comments).toEqual([{author: 'Sam', body: 'Hi', createdAt: null}, {author: 'Unknown', body: 'Yo', createdAt: '2026-01-02T03:04:05.000Z'}]);
  });

  it('reads timeline dates and the timelineable flag', () => {
    const doc = parse(Object.assign({}, base, {entryTypes: [{ref: 't', name: 'Events', timelineable: true}], entries: [{ref: 'a', name: 'A', timeline: {startYear: 10, startMonth: 2, endYear: 12, color: '#AABBCC'}}, {ref: 'b', name: 'B'}]}));

    expect(doc.entryTypes[0].timelineable).toBe(true);
    expect(doc.entries[0].timeline).toEqual({startYear: 10, startMonth: 2, startDay: null, startHour: null, startMinute: null, endYear: 12, endMonth: null, endDay: null, endHour: null, endMinute: null, color: '#aabbcc'});
    expect(doc.entries[1].timeline).toBeNull();
  });

  it('rejects bad timeline dates', () => {
    expect(message(Object.assign({}, base, {entries: [{ref: 'a', name: 'A', timeline: {startYear: 5, startDay: 3}}]}))).toContain('A timeline');
  });
});
