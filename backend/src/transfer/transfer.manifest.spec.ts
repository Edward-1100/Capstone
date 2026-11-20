import { TransferDocument, parseDocument } from './transfer.format';
import { buildManifest, closeSelection, emptySelection, readSelection } from './transfer.manifest';

function document(): TransferDocument {
  return parseDocument(Buffer.from(JSON.stringify({
    format: 'worldbuilder-export',
    version: 1,
    world: {name: 'Realm'},
    entryTypes: [
      {ref: 'tc', name: 'Characters', fields: [{ref: 'f1', name: 'Age', fieldType: 'number'}]},
      {ref: 'tl', name: 'Locations', nestMode: 'chosen', parents: ['tr']},
      {ref: 'tr', name: 'Regions'},
    ],
    relationshipTypes: [{ref: 'rf', name: 'Friend', from: ['tc'], to: ['tc'], fromAny: false, toAny: false}],
    tags: [{ref: 'tg', name: 'Places', conditions: [{kind: 'type', typeRef: 'tl'}, {kind: 'inside', insideEntryRef: 'e3'}]}],
    entries: [
      {ref: 'e1', name: 'Aldric', typeRef: 'tc'},
      {ref: 'e2', name: 'Bren', typeRef: 'tc'},
      {ref: 'e3', name: 'Aldermoor', typeRef: 'tl'},
      {ref: 'e4', name: 'Port Vale', typeRef: 'tl', parentRef: 'e3'},
    ],
    relationships: [{ref: 'r1', typeRef: 'rf', fromRef: 'e1', toRef: 'e2'}],
    maps: [{ref: 'm1', name: 'World', markers: [{entryRef: 'e1', x: 0.5, y: 0.5}]}],
  })));
}

describe('buildManifest', () => {
  it('lists every item with a name and detail', () => {
    const manifest = buildManifest(document());

    expect(manifest.entryTypes.map((item) => [item.name, item.detail])).toEqual([['Characters', '1 field'], ['Locations', '0 fields'], ['Regions', '0 fields']]);
    expect(manifest.entries.find((item) => item.ref === 'e1')!.detail).toBe('Characters');
    expect(manifest.relationships[0]).toMatchObject({name: 'Aldric → Bren', detail: 'Friend'});
    expect(manifest.maps[0]).toMatchObject({name: 'World', detail: '1 pin'});
  });

  it('records what each item needs', () => {
    const manifest = buildManifest(document());

    expect(manifest.entries.find((item) => item.ref === 'e4')!.needs).toMatchObject({entryTypes: ['tl'], entries: ['e3']});
    expect(manifest.relationships[0].needs).toMatchObject({relationshipTypes: ['rf'], entries: ['e1', 'e2']});
    expect(manifest.relationshipTypes[0].needs.entryTypes).toEqual(['tc', 'tc']);
    expect(manifest.tags[0].needs).toMatchObject({entryTypes: ['tl'], entries: ['e3']});
    expect(manifest.entryTypes.find((item) => item.ref === 'tl')!.needs.entryTypes).toEqual(['tr']);
  });
});

describe('closeSelection', () => {
  it('adds the type and parent of a chosen entry', () => {
    const manifest = buildManifest(document());
    const selection = Object.assign(emptySelection(), {entries: ['e4']});
    const result = closeSelection(manifest, selection);

    expect(result.entries.sort()).toEqual(['e3', 'e4']);
    expect(result.entryTypes.sort()).toEqual(['tl', 'tr']);
  });

  it('adds the type and both entries of a chosen relationship', () => {
    const result = closeSelection(buildManifest(document()), Object.assign(emptySelection(), {relationships: ['r1']}));

    expect(result.relationshipTypes).toEqual(['rf']);
    expect(result.entries.sort()).toEqual(['e1', 'e2']);
    expect(result.entryTypes).toEqual(['tc']);
  });

  it('adds what a tag rule refers to', () => {
    const result = closeSelection(buildManifest(document()), Object.assign(emptySelection(), {tags: ['tg']}));

    expect(result.entries.sort()).toEqual(['e3']);
    expect(result.entryTypes.sort()).toEqual(['tl', 'tr']);
  });

  it('does not add anything for a map and ignores unknown ids', () => {
    const result = closeSelection(buildManifest(document()), Object.assign(emptySelection(), {maps: ['m1', 'nope'], entries: ['missing']}));

    expect(result.maps).toEqual(['m1']);
    expect(result.entries).toEqual([]);
  });
});

describe('readSelection', () => {
  it('keeps only text ids and fills missing categories', () => {
    expect(readSelection({entries: ['a', 3, null], tags: 'x'})).toEqual({entryTypes: [], relationshipTypes: [], tags: [], entries: ['a'], relationships: [], maps: []});
    expect(readSelection(null)).toEqual(emptySelection());
  });
});
