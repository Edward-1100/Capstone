import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RelationshipTypesService } from './relationship-types.service';

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;
  const relationships = {lock: jest.fn().mockResolvedValue(undefined), findInvalid: jest.fn().mockResolvedValue([])} as any;

  return {service: new RelationshipTypesService(db, relationships), db, client, relationships};
}

const TYPE_ID = '11111111-1111-4111-8111-111111111111';
const ENTRY_TYPE_ID = '22222222-2222-4222-8222-222222222222';

function sqlOf(client: any) {
  return client.query.mock.calls.map((call: any) => call[0]);
}

describe('RelationshipTypesService', () => {
  describe('list', () => {
    it('gives each type its allowed entry types for both sides', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'rt1', name: 'Member of'}, {id: 'rt2', name: 'Friend'}]})
        .mockResolvedValueOnce({rows: [{typeId: 'rt1', side: 'from', entryTypeId: 'tc'}, {typeId: 'rt1', side: 'to', entryTypeId: 'tf'}]});

      const types = await service.list('w1');

      expect(types[0].fromTypeIds).toEqual(['tc']);
      expect(types[0].toTypeIds).toEqual(['tf']);
      expect(types[1].fromTypeIds).toEqual([]);
    });
  });

  describe('create', () => {
    it('rejects entry types that are not in this world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.create('w1', {name: 'Mentor of', fromAny: false, fromTypeIds: [ENTRY_TYPE_ID]})).rejects.toThrow('Choose entry types from this world');
    });

    it('does not save the allowed types for a side that accepts any type', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValue({rows: [{id: 'rt1'}]});

      await service.create('w1', {name: 'Knows', symmetric: true});

      expect(sqlOf(client).some((text: string) => text.includes('INSERT INTO relationship_type_ends'))).toBe(false);
      expect(client.query.mock.calls[0][1]).toEqual(['w1', 'Knows', '', true, true, true]);
    });

    it('saves the allowed types for a restricted side', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: ENTRY_TYPE_ID}]}).mockResolvedValue({rows: [{id: 'rt1'}]});

      await service.create('w1', {name: 'Mentor of', fromAny: false, fromTypeIds: [ENTRY_TYPE_ID]});

      const insert = client.query.mock.calls.find((call: any) => call[0].includes('INSERT INTO relationship_type_ends'));

      expect(insert[1]).toEqual(['w1', 'rt1', 'from', [ENTRY_TYPE_ID]]);
    });

    it('returns a conflict for a name that is already used', async () => {
      const {service, client} = createService();

      client.query.mockRejectedValueOnce(Object.assign(new Error('duplicate'), {code: '23505'}));

      await expect(service.create('w1', {name: 'Friend'})).rejects.toThrow('A relationship type with that name already exists');
    });
  });

  describe('update', () => {
    it('returns not found for a missing type', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', TYPE_ID, {name: 'New'})).rejects.toThrow(NotFoundException);
    });

    it('asks for confirmation and lists the relationships that would be removed', async () => {
      const {service, client, relationships} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TYPE_ID}]}).mockResolvedValue({rows: []});
      relationships.findInvalid.mockResolvedValueOnce([{id: 'r1', fromName: 'Aria', toName: 'Keep'}]);

      try {
        await service.update('w1', TYPE_ID, {toAny: false, toTypeIds: []});
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse()).toEqual({message: 'This change would remove 1 relationship', count: 1, relationships: [{id: 'r1', fromName: 'Aria', toName: 'Keep'}]});
      }

      expect(sqlOf(client).some((text: string) => text.includes('DELETE FROM relationships'))).toBe(false);
    });

    it('removes the relationships when confirmed', async () => {
      const {service, client, relationships} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TYPE_ID}]}).mockResolvedValue({rows: []});
      relationships.findInvalid.mockResolvedValueOnce([{id: 'r1'}, {id: 'r2'}]);

      const result = await service.update('w1', TYPE_ID, {toAny: false, toTypeIds: [], confirmRemove: true});

      const removal = client.query.mock.calls.find((call: any) => call[0].includes('DELETE FROM relationships'));

      expect(removal[1]).toEqual([['r1', 'r2']]);
      expect(result.removedRelationships).toBe(2);
    });

    it('only checks the relationships of the type being changed', async () => {
      const {service, client, relationships} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TYPE_ID}]}).mockResolvedValue({rows: []});

      await service.update('w1', TYPE_ID, {name: 'New'});

      expect(relationships.findInvalid).toHaveBeenCalledWith(client, 'w1', TYPE_ID);
    });

    it('clears the allowed types when a side is set back to any', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TYPE_ID}]}).mockResolvedValue({rows: []});

      await service.update('w1', TYPE_ID, {fromAny: true});

      const sql = sqlOf(client);

      expect(sql.some((text: string) => text.includes('DELETE FROM relationship_type_ends'))).toBe(true);
      expect(sql.some((text: string) => text.includes('INSERT INTO relationship_type_ends'))).toBe(false);
    });

    it('leaves the allowed types alone when they are not sent', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TYPE_ID}]}).mockResolvedValue({rows: []});

      await service.update('w1', TYPE_ID, {name: 'New'});

      expect(sqlOf(client).some((text: string) => text.includes('DELETE FROM relationship_type_ends'))).toBe(false);
    });

    it('returns a conflict when the new name is already used', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TYPE_ID}]}).mockRejectedValueOnce(Object.assign(new Error('duplicate'), {code: '23505'}));

      await expect(service.update('w1', TYPE_ID, {name: 'Friend'})).rejects.toThrow('A relationship type with that name already exists');
    });
  });

  describe('remove', () => {
    it('rejects a wrong confirmation name without deleting', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Friend'}]});

      await expect(service.remove('w1', TYPE_ID, {confirmName: 'friend'})).rejects.toThrow(BadRequestException);
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('deletes the type and reports how many relationships it had', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Friend'}]})
        .mockResolvedValueOnce({rows: [{count: 4}]})
        .mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', TYPE_ID, {confirmName: 'Friend'})).toEqual({deleted: true, removedRelationships: 4});
    });

    it('returns not found for a missing type', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', TYPE_ID, {confirmName: 'Friend'})).rejects.toThrow(NotFoundException);
    });
  });
});
