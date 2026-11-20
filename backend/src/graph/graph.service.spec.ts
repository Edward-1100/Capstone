import { GraphService, groupableValues, MAX_GRAPH_NODES } from './graph.service';

function createService(overrides: Record<string, any[]> = {}) {
  const db = {
    query: jest.fn().mockImplementation((text: string) => {
      const key = Object.keys(overrides).find((part) => text.includes(part));

      return Promise.resolve({rows: key ? overrides[key] : []});
    }),
  } as any;

  return {service: new GraphService(db), db};
}

describe('groupableValues', () => {
  it('keeps only groupable fields that have a value', () => {
    expect(groupableValues({a: 1, b: 'text', c: null, d: false}, new Set(['a', 'c', 'd']))).toEqual({a: 1, d: false});
  });

  it('handles missing fields', () => {
    expect(groupableValues(null, new Set(['a']))).toEqual({});
  });
});

describe('GraphService', () => {
  it('returns nodes with tags and groupable values, and drops edges to missing entries', async () => {
    const {service} = createService({
      'FROM active_entries': [{id: 'e1', name: 'A', typeId: 't1', fields: {f1: 3, f2: 'x'}}, {id: 'e2', name: 'B', typeId: null, fields: {}}],
      'FROM type_fields': [{id: 'f1', typeId: 't1', name: 'Level', fieldType: 'scale', config: {}}],
      'FROM effective_entry_tags': [{entryId: 'e1', tagId: 'g1'}, {entryId: 'gone', tagId: 'g1'}],
      'FROM relationships': [{id: 'r1', typeId: 'rt', from: 'e1', to: 'e2'}, {id: 'r2', typeId: 'rt', from: 'e1', to: 'gone'}],
    });

    const result = await service.get('w1');

    expect(result.truncated).toBe(false);
    expect(result.nodes[0]).toEqual({id: 'e1', name: 'A', typeId: 't1', tagIds: ['g1'], values: {f1: 3}});
    expect(result.nodes[1].tagIds).toEqual([]);
    expect(result.edges.map((edge: any) => edge.id)).toEqual(['r1']);
  });

  it('flags truncation and caps the nodes', async () => {
    const rows = Array.from({length: MAX_GRAPH_NODES + 1}, (_, index) => ({id: `e${index}`, name: 'N', typeId: null, fields: {}}));
    const {service} = createService({'FROM active_entries': rows});

    const result = await service.get('w1');

    expect(result.truncated).toBe(true);
    expect(result.nodes).toHaveLength(MAX_GRAPH_NODES);
  });
});
