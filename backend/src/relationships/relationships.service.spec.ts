import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RelationshipsService } from './relationships.service';

const DTO = {typeId: 'rt1', fromEntryId: 'e1', toEntryId: 'e2'};

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;

  return {service: new RelationshipsService(db), db, client};
}

function setup(client: any, options: any) {
  const type = Object.assign({name: 'Member of', symmetric: false, fromAny: false, toAny: false}, options.type);

  client.query
    .mockResolvedValueOnce({rows: []})
    .mockResolvedValueOnce({rows: [type]})
    .mockResolvedValueOnce({rows: options.entries})
    .mockResolvedValueOnce({rows: options.ends ?? []})
    .mockResolvedValueOnce({rows: options.existing ?? []})
    .mockResolvedValueOnce({rows: [{id: 'r1'}]});
}

const CHARACTER = {id: 'e1', typeId: 'tc', typeName: 'Characters'};
const FACTION = {id: 'e2', typeId: 'tf', typeName: 'Factions'};
const ENDS = [{side: 'from', entryTypeId: 'tc'}, {side: 'to', entryTypeId: 'tf'}];

describe('RelationshipsService', () => {
  describe('create', () => {
    it('rejects an entry related to itself before looking anything up', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.create('w1', 'u1', {typeId: 'rt1', fromEntryId: 'e1', toEntryId: 'e1'})).rejects.toThrow('An entry can not have a relationship with itself');
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('returns not found for a type that is not in this world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: []});

      await expect(service.create('w1', 'u1', DTO)).rejects.toThrow(NotFoundException);
    });

    it('rejects an entry that is missing or deleted', async () => {
      const {service, client} = createService();

      setup(client, {entries: [CHARACTER]});

      await expect(service.create('w1', 'u1', DTO)).rejects.toThrow('Entry not found in this world');
    });

    it('creates a relationship when the entry types match', async () => {
      const {service, client} = createService();

      setup(client, {entries: [CHARACTER, FACTION], ends: ENDS});

      expect(await service.create('w1', 'u1', DTO)).toEqual({id: 'r1', typeId: 'rt1', fromEntryId: 'e1', toEntryId: 'e2'});
      expect(client.query.mock.calls[5][1]).toEqual(['w1', 'rt1', 'e1', 'e2', 'u1']);
    });

    it('rejects the wrong direction and names both types', async () => {
      const {service, client} = createService();

      setup(client, {entries: [CHARACTER, FACTION], ends: ENDS});

      await expect(service.create('w1', 'u1', {typeId: 'rt1', fromEntryId: 'e2', toEntryId: 'e1'})).rejects.toThrow('Member of can not connect Factions to Characters');
    });

    it('names entries without a type', async () => {
      const {service, client} = createService();

      setup(client, {entries: [CHARACTER, {id: 'e2', typeId: null, typeName: null}], ends: ENDS});

      await expect(service.create('w1', 'u1', DTO)).rejects.toThrow('Member of can not connect Characters to entries without a type');
    });

    it('allows any entry on a side that accepts any type, including entries without a type', async () => {
      const {service, client} = createService();

      setup(client, {type: {fromAny: true, toAny: true}, entries: [CHARACTER, {id: 'e2', typeId: null, typeName: null}]});

      await service.create('w1', 'u1', DTO);

      expect(client.query).toHaveBeenCalledTimes(6);
    });

    it('allows a symmetric type in either direction', async () => {
      const {service, client} = createService();

      setup(client, {type: {name: 'Friend', symmetric: true}, entries: [CHARACTER, FACTION], ends: ENDS});

      await service.create('w1', 'u1', {typeId: 'rt1', fromEntryId: 'e2', toEntryId: 'e1'});

      expect(client.query).toHaveBeenCalledTimes(6);
    });

    it('rejects a pair that matches neither direction for a symmetric type', async () => {
      const {service, client} = createService();

      setup(client, {type: {name: 'Friend', symmetric: true}, entries: [FACTION, {id: 'e1', typeId: 'tf', typeName: 'Factions'}], ends: ENDS});

      await expect(service.create('w1', 'u1', DTO)).rejects.toThrow(BadRequestException);
    });

    it('returns a conflict when the relationship already exists', async () => {
      const {service, client} = createService();

      setup(client, {entries: [CHARACTER, FACTION], ends: ENDS, existing: [{'?column?': 1}]});

      await expect(service.create('w1', 'u1', DTO)).rejects.toThrow(ConflictException);
      expect(client.query).toHaveBeenCalledTimes(5);
    });

    it('also checks the reverse pair for a symmetric type', async () => {
      const {service, client} = createService();

      setup(client, {type: {name: 'Friend', symmetric: true, fromAny: true, toAny: true}, entries: [CHARACTER, FACTION]});

      await service.create('w1', 'u1', DTO);

      expect(client.query.mock.calls[4][1]).toEqual(['rt1', 'e1', 'e2', true]);
    });
  });

  describe('listForEntry', () => {
    it('returns not found when the entry is missing or deleted', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.listForEntry('w1', 'e1')).rejects.toThrow(NotFoundException);
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('returns the relationships in both directions', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'e1'}]}).mockResolvedValueOnce({rows: [{id: 'r1'}]});

      expect(await service.listForEntry('w1', 'e1')).toEqual([{id: 'r1'}]);
      expect(db.query.mock.calls[1][1]).toEqual(['e1', 'w1']);
    });
  });

  describe('remove', () => {
    it('returns not found when nothing was deleted', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rowCount: 0});

      await expect(service.remove('w1', 'r1')).rejects.toThrow(NotFoundException);
    });

    it('deletes within the world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rowCount: 1});

      expect(await service.remove('w1', 'r1')).toEqual({deleted: true});
      expect(db.query.mock.calls[0][1]).toEqual(['r1', 'w1']);
    });
  });

  describe('findInvalid', () => {
    it('checks every type and caps the list by default', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: 'r1'}]});

      expect(await service.findInvalid(client, 'w1')).toEqual([{id: 'r1'}]);
      expect(client.query.mock.calls[0][1]).toEqual(['w1', null, 1000]);
    });

    it('can check one type with a smaller cap', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await service.findInvalid(client, 'w1', 'rt1', 50);

      expect(client.query.mock.calls[0][1]).toEqual(['w1', 'rt1', 50]);
    });
  });
});
