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

describe('EntriesService', () => {
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
