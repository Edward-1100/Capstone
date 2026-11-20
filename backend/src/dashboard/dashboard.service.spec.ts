import { DashboardService } from './dashboard.service';

function createService() {
  const db = {query: jest.fn()} as any;
  const relationships = {findInvalid: jest.fn().mockResolvedValue([])} as any;

  const storage = {getUrl: jest.fn().mockImplementation((key: string) => Promise.resolve(`https://files/${key}`))} as any;

  return {service: new DashboardService(db, relationships, storage), db, relationships, storage};
}

describe('DashboardService', () => {
  describe('get', () => {
    it('returns entry counts by type, with entries that have no type last', async () => {
      const {service, db} = createService();

      db.query.mockImplementation((text: string) => {
        if (text.includes('GROUP BY')) {
          return Promise.resolve({rows: [{typeId: 't1', name: 'Characters', count: 2}, {typeId: null, name: null, count: 1}]});
        }

        return Promise.resolve({rows: []});
      });

      const result = await service.get('w1', 'viewer');

      expect(result.entriesByType).toEqual([{typeId: 't1', name: 'Characters', count: 2}, {typeId: null, name: null, count: 1}]);
      expect(result.untyped).toEqual([]);
      expect(result.recentlyCreated).toEqual([]);
    });
  });

  describe('get widgets', () => {
    function world(settings: any, announcement = '') {
      const {service, db} = createService();

      db.query.mockImplementation((text: string) => {
        if (text.includes('FROM worlds WHERE id')) {
          return Promise.resolve({rows: [{announcement, settings}]});
        }

        if (text.includes('FROM featured_entries')) {
          return Promise.resolve({rows: [{id: 'i1', kind: 'entry', layout: 'image', message: 'Start here', entryId: 'e1', relationshipId: null, fieldIds: [], addedAt: '2026-11-01', addedBy: 'Sam'}]});
        }

        if (text.includes('FROM pinned_entries')) {
          return Promise.resolve({rows: [{id: 'i2', kind: 'entry', layout: 'text', message: '', entryId: 'e2', relationshipId: null, fieldIds: [], noteId: null, addedAt: '2026-11-02', addedBy: 'Sam'}]});
        }

        if (text.includes('e.id = ANY')) {
          return Promise.resolve({rows: [{id: 'e1', name: 'Aria', fields: {}, typeName: null, excerpt: 'A hero', imageKey: 'k1'}, {id: 'e2', name: 'Bren', fields: {}, typeName: null, excerpt: '', imageKey: null}]});
        }

        if (text.includes('count(*)::int AS count FROM suggestions')) {
          return Promise.resolve({rows: [{count: 3}]});
        }

        return Promise.resolve({rows: []});
      });

      return service;
    }

    it('shows signed out people only what a viewer may see', async () => {
      const result = await world({}, 'Welcome').get('w1', null);

      expect(result.show).toMatchObject({announcement: true, featured: true, pinned: false, attention: false, suggest: true, review: false});
      expect(result.featured).toHaveLength(1);
      expect(result.featured[0]).toMatchObject({id: 'i1', kind: 'entry', message: 'Start here', entryId: 'e1', imageUrl: 'https://files/k1', excerpt: 'A hero'});
      expect(result.featured[0]).not.toHaveProperty('imageKey');
      expect(result.pinned).toEqual([]);
      expect(result.announcement).toBe('Welcome');
      expect(result.openSuggestions).toBe(0);
    });

    it('shows editors the pinned list, attention list and suggestion count', async () => {
      const result = await world({}).get('w1', 'editor');

      expect(result.show).toMatchObject({pinned: true, attention: true, review: true});
      expect(result.pinned).toHaveLength(1);
      expect(result.pinned[0].imageUrl).toBeNull();
      expect(result.pinned[0]).toMatchObject({layout: 'text', noteId: null, noteBody: null});
      expect(result.openSuggestions).toBe(3);
    });

    it('builds relationship and details items and skips ones whose entries are gone', async () => {
      const {service, db} = createService();

      db.query.mockImplementation((text: string) => {
        if (text.includes('FROM worlds WHERE id')) {
          return Promise.resolve({rows: [{announcement: '', settings: {}}]});
        }

        if (text.includes('FROM featured_entries')) {
          return Promise.resolve({rows: [
            {id: 'i1', kind: 'relationship', layout: 'image', message: 'They broke up', entryId: null, relationshipId: 'r1', fieldIds: []},
            {id: 'i2', kind: 'details', layout: 'image', message: '', entryId: 'e1', relationshipId: null, fieldIds: ['f1', 'f2']},
            {id: 'i3', kind: 'entry', layout: 'image', message: '', entryId: 'gone', relationshipId: null, fieldIds: []},
            {id: 'i4', kind: 'relationship', layout: 'image', message: '', entryId: null, relationshipId: 'r2', fieldIds: []},
          ]});
        }

        if (text.includes('FROM relationships r')) {
          return Promise.resolve({rows: [{id: 'r1', typeName: 'Ally of', fromId: 'e1', toId: 'e2'}, {id: 'r2', typeName: 'Ally of', fromId: 'e1', toId: 'gone'}]});
        }

        if (text.includes('e.id = ANY')) {
          return Promise.resolve({rows: [{id: 'e1', name: 'Aria', fields: {f1: 'Sailor', f2: 'Long story'}, typeName: 'Characters', excerpt: '', imageKey: 'k1'}, {id: 'e2', name: 'Bren', fields: {}, typeName: null, excerpt: '', imageKey: null}]});
        }

        if (text.includes('FROM type_fields')) {
          return Promise.resolve({rows: [{id: 'f2', name: 'History', fieldType: 'long_text', config: {}}, {id: 'f1', name: 'Job', fieldType: 'text', config: {}}]});
        }

        return Promise.resolve({rows: []});
      });

      const result = await service.get('w1', 'viewer');

      expect(result.featured).toHaveLength(2);
      expect(result.featured[0].relationship).toMatchObject({typeName: 'Ally of', from: {name: 'Aria', imageUrl: 'https://files/k1'}, to: {name: 'Bren', imageUrl: null}});
      expect(result.featured[0].message).toBe('They broke up');
      expect(result.featured[1].details.map((detail: any) => [detail.name, detail.value])).toEqual([['Job', 'Sailor'], ['History', 'Long story']]);
    });

    it('hides an announcement that is empty or switched off', async () => {
      expect((await world({}, '').get('w1', 'owner')).show.announcement).toBe(false);
      expect((await world({announcement: {shown: false}}, 'Hi').get('w1', 'owner')).announcement).toBe('');
    });

    it('leaves out data for widgets the owner restricted', async () => {
      const result = await world({featured: {visibleTo: 'owner'}, activity: {visibleTo: 'owner'}, suggestions: {see: 'owner'}}).get('w1', 'editor');

      expect(result.show).toMatchObject({featured: false, activity: false, review: false});
      expect(result.featured).toEqual([]);
      expect(result.recentlyCreated).toEqual([]);
    });
  });

  describe('stats', () => {
    it('returns the world totals', async () => {
      const {service, db} = createService();
      const row = {entries: 4, relationships: 2, tags: 1, entryTypes: 5, relationshipTypes: 5, maps: 3, maxMaps: 6, members: 2};

      const last = {action: 'updated', name: 'Aria', at: '2026-11-10T10:00:00Z', by: 'Sam', entryId: 'e1'};

      db.query.mockResolvedValueOnce({rows: [row]}).mockResolvedValueOnce({rows: [last]});

      expect(await service.stats('w1')).toEqual(Object.assign({}, row, {lastActivity: last}));
      expect(db.query.mock.calls[0][1]).toEqual(['w1']);
    });

    it('returns no last activity for a world without any', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{entries: 0}]}).mockResolvedValueOnce({rows: []});

      expect((await service.stats('w1')).lastActivity).toBeNull();
    });
  });
});
