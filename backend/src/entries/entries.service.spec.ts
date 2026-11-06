import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EntriesService } from './entries.service';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    getUrl: jest.fn().mockResolvedValue('signed-url'),
  } as any;

  const nesting = {
    lockWorld: jest.fn().mockResolvedValue(undefined),
    assertParent: jest.fn().mockResolvedValue(undefined),
    brokenLinks: jest.fn().mockResolvedValue([]),
    unlinkOrThrow: jest.fn().mockResolvedValue(0),
    promoteChildren: jest.fn().mockResolvedValue(undefined),
    parentOptions: jest.fn().mockResolvedValue([]),
  } as any;

  return {service: new EntriesService(db, storage, nesting), db, client, storage, nesting};
}

const TAG_A = '11111111-1111-4111-8111-111111111111';
const TAG_B = '22222222-2222-4222-8222-222222222222';
const TAG_C = '33333333-3333-4333-8333-333333333333';

describe('EntriesService', () => {
  describe('list', () => {
    it('lists with no filters by default', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: [{id: 'e1', tags: []}]});

      expect(await service.list('w1')).toEqual([{id: 'e1', tags: []}]);
      expect(db.query.mock.calls[0][1]).toEqual(['w1', '', [], false, [], false, [], [], 'all', [], [], [], [], [], [], [], []]);
    });

    it('passes every filter to the query', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: []});

      await service.list('w1', {q: '  keep ', types: TAG_C, excludeTypes: TAG_A, tags: `${TAG_A},${TAG_B}`, excludeTags: TAG_C, tagMode: 'any', inside: TAG_B, excludeInside: TAG_C, relations: `${TAG_A}:to:${TAG_B}`, excludeRelations: `${TAG_B}:from:${TAG_C},${TAG_A}:to:${TAG_C}`});

      expect(db.query.mock.calls[0][1]).toEqual(['w1', 'keep', [TAG_C], false, [TAG_A], false, [TAG_A, TAG_B], [TAG_C], 'any', [TAG_B], [TAG_C], [TAG_A], ['to'], [TAG_B], [TAG_B, TAG_A], ['from', 'to'], [TAG_C, TAG_C]]);
    });

    it('lets the none type through as its own flag', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: []});

      await service.list('w1', {types: `none,${TAG_A}`, excludeTypes: 'none'});

      expect(db.query.mock.calls[0][1].slice(2, 6)).toEqual([[TAG_A], true, [], true]);
    });

    it('ignores blanks and repeats in a tag list', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: []});

      await service.list('w1', {tags: ` ${TAG_A},,${TAG_A} `});

      expect(db.query.mock.calls[0][1][6]).toEqual([TAG_A]);
    });

    it('accepts a tag list sent as a repeated parameter', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: []});

      await service.list('w1', {tags: [TAG_A, TAG_B]});

      expect(db.query.mock.calls[0][1][6]).toEqual([TAG_A, TAG_B]);
    });

    it('rejects a type filter that is not an id or none', async () => {
      const {service, db} = createService();

      await expect(service.list('w1', {types: 'nope'})).rejects.toThrow('types must be valid ids or none');
      await expect(service.list('w1', {excludeTypes: 'nope'})).rejects.toThrow('excludeTypes must be valid ids or none');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('rejects ids that are not valid', async () => {
      const {service, db} = createService();

      await expect(service.list('w1', {tags: `${TAG_A},nope`})).rejects.toThrow('tags must be valid ids');
      await expect(service.list('w1', {excludeTags: 'nope'})).rejects.toThrow('excludeTags must be valid ids');
      await expect(service.list('w1', {inside: 'nope'})).rejects.toThrow('inside must be valid ids');
      await expect(service.list('w1', {excludeInside: 'nope'})).rejects.toThrow('excludeInside must be valid ids');
      await expect(service.list('w1', {relations: 'nope'})).rejects.toThrow('relations must look like typeId:from or to:entryId');
      await expect(service.list('w1', {excludeRelations: `${TAG_A}:up:${TAG_B}`})).rejects.toThrow('excludeRelations must look like typeId:from or to:entryId');
      expect(db.query).not.toHaveBeenCalled();
    });

    it('rejects too many tags', async () => {
      const {service} = createService();
      const many = Array.from({length: 51}, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`).join(',');

      await expect(service.list('w1', {tags: many})).rejects.toThrow('tags can only have up to 50 tags');
    });

    it('rejects a match mode other than all or any', async () => {
      const {service} = createService();

      await expect(service.list('w1', {tagMode: 'some'})).rejects.toThrow('tagMode must be all or any');
    });

    it('rejects a search that is too long or not text', async () => {
      const {service} = createService();

      await expect(service.list('w1', {q: 'a'.repeat(101)})).rejects.toThrow('q can only be up to 100 characters');
      await expect(service.list('w1', {q: ['a'] as any})).rejects.toThrow('q must be text');
    });
  });

  describe('update', () => {
    it('returns a conflict when the version is stale', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Old', type_id: null, fields: {}, version: 2}]});

      await expect(service.update('w1', 'e1', 'u1', {version: 1, name: 'New'})).rejects.toThrow(ConflictException);
    });

    it('returns a conflict when someone saves between the read and the write', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Old', type_id: null, fields: {}, version: 1}]})
        .mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', 'e1', 'u1', {version: 1, name: 'New'})).rejects.toThrow(ConflictException);
    });

    it('returns not found when the entry does not exist', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', 'e1', 'u1', {version: 1, name: 'New'})).rejects.toThrow(NotFoundException);
    });

    it('saves and logs the change when the version matches', async () => {
      const {service, db, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Old', type_id: null, fields: {}, version: 1}]})
        .mockResolvedValueOnce({rows: [{name: 'New'}]})
        .mockResolvedValueOnce({rows: []});
      db.query.mockResolvedValueOnce({rows: [{id: 'e1', name: 'New', version: 2}]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: []});

      const result = await service.update('w1', 'e1', 'u1', {version: 1, name: 'New'});

      expect(result.name).toBe('New');
      expect(client.query.mock.calls[2][1]).toEqual(['w1', 'e1', 'updated', 'New', 'u1']);
    });

    it('updates links to the entry in other descriptions when it is renamed', async () => {
      const {service, db, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Old (Keep)', type_id: null, fields: {}, version: 1}]})
        .mockResolvedValueOnce({rows: [{name: 'New \\ Keep'}]})
        .mockResolvedValue({rows: []});
      db.query.mockResolvedValue({rows: [{id: 'e1', name: 'New', version: 2}]});

      await service.update('w1', 'e1', 'u1', {version: 1, name: 'New \\ Keep'});

      const sync = client.query.mock.calls[3];

      expect(sync[0]).toContain('regexp_replace');
      expect(sync[1]).toEqual(['w1', '\\[\\[Old \\(Keep\\)\\]\\]', '[[New \\\\ Keep]]', 'e1', 'Old (Keep)']);
    });

    it('leaves other descriptions alone when the name is unchanged', async () => {
      const {service, db, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Same', type_id: null, fields: {}, version: 1}]})
        .mockResolvedValueOnce({rows: [{name: 'Same'}]})
        .mockResolvedValue({rows: []});
      db.query.mockResolvedValue({rows: [{id: 'e1', name: 'Same', version: 2}]});

      await service.update('w1', 'e1', 'u1', {version: 1, description: 'About'});

      expect(client.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('remove', () => {
    it('soft deletes the entry and logs it', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'e1', 'u1')).toEqual({deleted: true});
      expect(client.query.mock.calls[0][0]).toContain('deleted_at = now()');
      expect(client.query.mock.calls[0][0]).not.toContain('DELETE FROM');
      expect(client.query.mock.calls[1][1]).toEqual(['w1', 'e1', 'deleted', 'Aria', 'u1']);
    });

    it('returns not found for an entry that is already deleted', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 'e1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addImage', () => {
    it('rejects a file that is not an image before touching the database', async () => {
      const {service, db} = createService();
      const file = {buffer: Buffer.from('not an image')} as any;

      await expect(service.addImage('w1', 'e1', 'u1', file)).rejects.toThrow(BadRequestException);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('rejects a sixth image without uploading', async () => {
      const {service, client, storage} = createService();
      const positions = [0, 1, 2, 3, 4].map((position) => ({position}));

      client.query.mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria'}]}).mockResolvedValueOnce({rows: positions});

      await expect(service.addImage('w1', 'e1', 'u1', {buffer: PNG_BYTES} as any)).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('uses the lowest free position', async () => {
      const {service, db, client, storage} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria'}]})
        .mockResolvedValueOnce({rows: [{position: 0}, {position: 2}]})
        .mockResolvedValue({rows: []});
      db.query.mockResolvedValueOnce({rows: [{id: 'e1'}]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: []});

      await service.addImage('w1', 'e1', 'u1', {buffer: PNG_BYTES} as any);

      const insert = client.query.mock.calls.find((call) => call[0].includes('INSERT INTO entry_images'));

      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(insert![1][2]).toBe(1);
    });

    it('removes the uploaded file if saving fails', async () => {
      const {service, client, storage} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria'}]})
        .mockResolvedValueOnce({rows: []})
        .mockRejectedValueOnce(new Error('insert failed'));

      await expect(service.addImage('w1', 'e1', 'u1', {buffer: PNG_BYTES} as any)).rejects.toThrow('insert failed');
      expect(storage.remove).toHaveBeenCalledTimes(1);
    });
  });
});
