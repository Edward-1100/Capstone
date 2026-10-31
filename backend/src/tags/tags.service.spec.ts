import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';

const TAG_ID = '11111111-1111-4111-8111-111111111111';

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;

  return {service: new TagsService(db), db, client};
}

function duplicateError() {
  return Object.assign(new Error('duplicate'), {code: '23505'});
}

describe('TagsService', () => {
  describe('create', () => {
    it('saves the name trimmed and the color in lowercase', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 't1'}]}).mockResolvedValueOnce({rows: [{id: 't1', name: 'Hero'}]});

      expect(await service.create('w1', {name: ' Hero ', color: '#FF0000'})).toEqual({id: 't1', name: 'Hero'});
      expect(db.query.mock.calls[0][1]).toEqual(['w1', 'Hero', '#ff0000']);
    });

    it('saves no color when none is sent', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: [{id: 't1'}]});

      await service.create('w1', {name: 'Hero'});

      expect(db.query.mock.calls[0][1]).toEqual(['w1', 'Hero', null]);
    });

    it('returns a conflict for a name that is already used', async () => {
      const {service, db} = createService();

      db.query.mockRejectedValueOnce(duplicateError());

      await expect(service.create('w1', {name: 'Hero'})).rejects.toThrow('A tag with that name already exists');
    });
  });

  describe('update', () => {
    it('returns not found for a missing tag', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', TAG_ID, {name: 'New'})).rejects.toThrow(NotFoundException);
    });

    it('keeps the color when it is not sent', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: [{id: TAG_ID}]});

      await service.update('w1', TAG_ID, {name: 'New'});

      expect(db.query.mock.calls[0][1]).toEqual([TAG_ID, 'w1', 'New', false, null]);
    });

    it('clears the color when null is sent', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValue({rows: [{id: TAG_ID}]});

      await service.update('w1', TAG_ID, {color: null});

      expect(db.query.mock.calls[0][1]).toEqual([TAG_ID, 'w1', null, true, null]);
    });

    it('returns a conflict when the new name is already used', async () => {
      const {service, db} = createService();

      db.query.mockRejectedValueOnce(duplicateError());

      await expect(service.update('w1', TAG_ID, {name: 'Hero'})).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('rejects a wrong confirmation name without deleting', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Hero'}]});

      await expect(service.remove('w1', TAG_ID, {confirmName: 'hero'})).rejects.toThrow(BadRequestException);
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('deletes the tag and reports how many entries had it', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Hero'}]})
        .mockResolvedValueOnce({rows: [{count: 3}]})
        .mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', TAG_ID, {confirmName: 'Hero'})).toEqual({deleted: true, removedFrom: 3});
    });

    it('returns not found for a missing tag', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', TAG_ID, {confirmName: 'Hero'})).rejects.toThrow(NotFoundException);
    });
  });

  describe('addToEntry', () => {
    it('returns not found when the entry is missing or deleted', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.addToEntry('w1', 'e1', TAG_ID, 'u1')).rejects.toThrow('Entry not found');
    });

    it('returns not found for a tag from another world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await expect(service.addToEntry('w1', 'e1', TAG_ID, 'u1')).rejects.toThrow('Tag not found');
    });

    it('logs the change when the tag is new on the entry', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Aria'}]})
        .mockResolvedValueOnce({rows: [{id: TAG_ID}]})
        .mockResolvedValueOnce({rowCount: 1})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: TAG_ID, name: 'Hero'}]});

      expect(await service.addToEntry('w1', 'e1', TAG_ID, 'u1')).toEqual([{id: TAG_ID, name: 'Hero'}]);
      expect(client.query.mock.calls[4][0]).toContain('INSERT INTO activity_log');
      expect(client.query.mock.calls[4][1]).toEqual(['w1', 'e1', 'updated', 'Aria', 'u1']);
    });

    it('does not log anything when the entry already has the tag', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Aria'}]})
        .mockResolvedValueOnce({rows: [{id: TAG_ID}]})
        .mockResolvedValueOnce({rowCount: 0})
        .mockResolvedValueOnce({rows: []});

      await service.addToEntry('w1', 'e1', TAG_ID, 'u1');

      expect(client.query).toHaveBeenCalledTimes(4);
    });
  });

  describe('removeFromEntry', () => {
    it('logs the change when a tag was removed', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Aria'}]})
        .mockResolvedValueOnce({rowCount: 1})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []});

      await service.removeFromEntry('w1', 'e1', TAG_ID, 'u1');

      expect(client.query.mock.calls[3][0]).toContain('INSERT INTO activity_log');
    });

    it('does not log anything when the entry did not have the tag', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Aria'}]})
        .mockResolvedValueOnce({rowCount: 0})
        .mockResolvedValueOnce({rows: []});

      await service.removeFromEntry('w1', 'e1', TAG_ID, 'u1');

      expect(client.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('listForEntry', () => {
    it('returns not found when the entry is missing', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.listForEntry('w1', 'e1')).rejects.toThrow(NotFoundException);
    });
  });
});
