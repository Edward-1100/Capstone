import { BadRequestException } from '@nestjs/common';
import { TransferImportService, rewriteLinks } from './transfer.import';
import { parseDocument } from './transfer.format';
import { readPlan } from './transfer.plan';

function document() {
  return parseDocument(Buffer.from(JSON.stringify({
    format: 'worldbuilder-export',
    version: 1,
    world: {name: 'Realm'},
    entryTypes: [{ref: 'tc', name: 'Characters'}],
    entries: [{ref: 'e1', name: 'Aldric', typeRef: 'tc', comments: [{author: 'A', body: 'x'}], images: [{position: 0, data: null}]}],
    maps: [{ref: 'm1', name: 'World', markers: []}],
  })));
}

function createService(rows: Record<string, any[]> = {}) {
  const client = {
    query: jest.fn(async (text: string) => {
      for (const key of Object.keys(rows)) {
        if (text.includes(key)) {
          return {rows: rows[key]};
        }
      }

      return {rows: []};
    }),
  };

  const db = {query: client.query, transaction: jest.fn(async (fn: any) => fn(client))};
  const storage = {upload: jest.fn(), remove: jest.fn().mockResolvedValue(undefined)};
  const nesting = {assertParent: jest.fn()};

  return {service: new TransferImportService(db as any, storage as any, nesting as any), client, db, storage};
}

describe('rewriteLinks', () => {
  it('renames only the links in the map', () => {
    const renamed = new Map([['aldermoor', 'Aldermoor II']]);

    expect(rewriteLinks('See [[Aldermoor]] and [[ aldermoor ]] but not [[Port Vale]]', renamed)).toBe('See [[Aldermoor II]] and [[Aldermoor II]] but not [[Port Vale]]');
    expect(rewriteLinks('Plain text', renamed)).toBe('Plain text');
    expect(rewriteLinks('[[Aldermoor]]', new Map())).toBe('[[Aldermoor]]');
  });
});

describe('TransferImportService', () => {
  describe('preview', () => {
    it('flags names that already exist in the target world', async () => {
      const {service} = createService({
        'FROM entry_types': [{id: 't1', name: 'characters'}],
        'FROM active_entries': [{id: 'e9', name: 'ALDRIC'}],
        'SELECT (SELECT count': [{used: 5, maxMaps: 6}],
      });

      const result: any = await service.preview(document(), 'w1');

      expect(result.clashes.entryTypes).toEqual({tc: 'characters'});
      expect(result.clashes.entries).toEqual({e1: 'ALDRIC'});
      expect(result.clashes.maps).toEqual({});
      expect(result.mapCapacity).toEqual({used: 5, max: 6});
      expect(result.totals).toEqual({comments: 1, notes: 0, images: 1, thumbnail: false});
    });

    it('has no clashes for a new world and uses the default map limit', async () => {
      const {service, client} = createService();
      const result: any = await service.preview(document(), null);

      expect(client.query).not.toHaveBeenCalled();
      expect(result.mapCapacity).toEqual({used: 0, max: 6});
      expect(result.clashes.entries).toEqual({});
    });
  });

  describe('run', () => {
    const everything = {entryTypes: ['tc'], entries: ['e1'], maps: ['m1']};

    it('needs something selected', async () => {
      const {service, db} = createService();

      await expect(service.run('u1', 'Sam', document(), readPlan('{}'), 'w1')).rejects.toThrow('Select something to import');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('asks for a choice when a name already exists', async () => {
      const {service, storage} = createService({'FOR UPDATE': [{id: 'w1'}], 'FROM entry_types': [{id: 't1', name: 'Characters'}]});
      const plan = readPlan(JSON.stringify({select: everything}));

      await expect(service.run('u1', 'Sam', document(), plan, 'w1')).rejects.toThrow('Choose what to do with: Characters');
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('rejects a new name that is blank, too long or taken', async () => {
      const rows = {'FOR UPDATE': [{id: 'w1'}], 'FROM entry_types': [{id: 't1', name: 'Characters'}, {id: 't2', name: 'Places'}]};
      const attempt = (name: string) => {
        const {service} = createService(rows);
        const plan = readPlan(JSON.stringify({select: {entryTypes: ['tc']}, resolutions: {entryTypes: {tc: {action: 'rename', name}}}}));

        return service.run('u1', 'Sam', document(), plan, 'w1');
      };

      await expect(attempt('')).rejects.toThrow('An entry type name must be 1 to 50 characters');
      await expect(attempt('x'.repeat(51))).rejects.toThrow('An entry type name must be 1 to 50 characters');
      await expect(attempt('places')).rejects.toThrow('An entry type named places already exists');
      await expect(attempt('places')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fails when the target world does not exist', async () => {
      const {service} = createService();

      await expect(service.run('u1', 'Sam', document(), readPlan(JSON.stringify({select: everything})), 'w1')).rejects.toThrow('World not found');
    });

    it('turns a repeated name in the file into a bad request and removes uploads', async () => {
      const {service, client, storage} = createService();
      const failure: any = new Error('duplicate');

      failure.code = '23505';
      client.query.mockImplementation(async (text: string) => {
        if (text.includes('INSERT INTO worlds')) {
          return {rows: [{id: 'w2'}]};
        }

        if (text.includes('INSERT INTO entry_types')) {
          throw failure;
        }

        return {rows: []};
      });

      await expect(service.run('u1', 'Sam', document(), readPlan(JSON.stringify({select: {entryTypes: ['tc']}})), null)).rejects.toThrow('A name in the file is used more than once');
      expect(storage.remove).not.toHaveBeenCalled();
    });
  });
});
