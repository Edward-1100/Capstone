import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EntryTypesService } from './entry-types.service';

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;
  const nesting = {
    lockWorld: jest.fn().mockResolvedValue(undefined),
    brokenLinks: jest.fn().mockResolvedValue([]),
    unlinkOrThrow: jest.fn().mockResolvedValue(0),
  } as any;

  return {service: new EntryTypesService(db, nesting), db, client, nesting};
}

function duplicateError() {
  return Object.assign(new Error('duplicate'), {code: '23505'});
}

describe('EntryTypesService', () => {
  describe('list', () => {
    it('adds the fields and allowed parents to each type', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 't1', name: 'Locations'}, {id: 't2', name: 'Characters'}]})
        .mockResolvedValueOnce({rows: [{id: 'f1', typeId: 't2', name: 'Age'}]})
        .mockResolvedValueOnce({rows: [{typeId: 't1', parentTypeId: 't1'}]});

      expect(await service.list('w1')).toEqual([
        {id: 't1', name: 'Locations', fields: [], parentTypeIds: ['t1']},
        {id: 't2', name: 'Characters', fields: [{id: 'f1', typeId: 't2', name: 'Age'}], parentTypeIds: []},
      ]);
      expect(db.query.mock.calls[0][0]).toContain('t.mappable');
      expect(db.query.mock.calls[0][0]).toContain('t.nest_mode');
    });
  });

  describe('create', () => {
    it('trims the name and returns an empty type', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 't1', name: 'Places'}]});

      expect(await service.create('w1', {name: ' Places '})).toEqual({id: 't1', name: 'Places', entryCount: 0, fields: [], parentTypeIds: []});
      expect(db.query.mock.calls[0][1]).toEqual(['w1', 'Places']);
    });

    it('reports a duplicate name', async () => {
      const {service, db} = createService();

      db.query.mockRejectedValueOnce(duplicateError());

      await expect(service.create('w1', {name: 'Places'})).rejects.toThrow(new ConflictException('A type with that name already exists'));
    });

    it('passes other errors on', async () => {
      const {service, db} = createService();

      db.query.mockRejectedValueOnce(new Error('boom'));

      await expect(service.create('w1', {name: 'Places'})).rejects.toThrow('boom');
    });
  });

  describe('update', () => {
    it('renames the type', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 't1', name: 'Places'}]});

      expect(await service.update('w1', 't1', {name: ' Places '})).toEqual({id: 't1', name: 'Places'});
      expect(db.query.mock.calls[0][1]).toEqual(['t1', 'w1', 'Places']);
    });

    it('returns not found for a type in another world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', 't1', {name: 'Places'})).rejects.toThrow(new NotFoundException('Entry type not found'));
    });

    it('reports a duplicate name', async () => {
      const {service, db} = createService();

      db.query.mockRejectedValueOnce(duplicateError());

      await expect(service.update('w1', 't1', {name: 'Places'})).rejects.toThrow(ConflictException);
    });
  });

  describe('setNesting', () => {
    it('locks the world and returns not found for a missing type', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.setNesting('w1', 't1', {mode: 'all'})).rejects.toThrow(new NotFoundException('Entry type not found'));
      expect(nesting.lockWorld).toHaveBeenCalledWith(client, 'w1');
    });

    it('requires at least one type when types are chosen', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValue({rows: [{id: 't1'}]});

      await expect(service.setNesting('w1', 't1', {mode: 'chosen', parentTypeIds: []})).rejects.toThrow(new BadRequestException('Choose at least one type'));
      await expect(service.setNesting('w1', 't1', {mode: 'chosen'})).rejects.toThrow(BadRequestException);
    });

    it('rejects chosen types that are not in this world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: 't1'}]}).mockResolvedValueOnce({rows: [{id: 't2'}]});

      await expect(service.setNesting('w1', 't1', {mode: 'chosen', parentTypeIds: ['t2', 't3']})).rejects.toThrow(new BadRequestException('Choose types from this world'));
      expect(client.query.mock.calls[1][1]).toEqual(['w1', ['t2', 't3']]);
    });

    it('replaces the chosen types and allows the type itself and non-nestable types', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: [{id: 't1'}, {id: 't2'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 't1', nestMode: 'chosen'}]})
        .mockResolvedValueOnce({rows: [{parentTypeId: 't1'}, {parentTypeId: 't2'}]});

      const result = await service.setNesting('w1', 't1', {mode: 'chosen', parentTypeIds: ['t1', 't2']});

      expect(client.query.mock.calls[2][1]).toEqual(['t1', 'w1', 'chosen']);
      expect(client.query.mock.calls[3][0]).toContain('DELETE FROM type_parent_rules');
      expect(client.query.mock.calls[4][1]).toEqual(['w1', 't1', ['t1', 't2']]);
      expect(result).toEqual({id: 't1', nestMode: 'chosen', parentTypeIds: ['t1', 't2'], clearedLinks: 0});
    });

    it.each(['none', 'all', 'own'])('sets %s, clears the chosen types, and ignores any that were sent', async (mode) => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 't1', nestMode: mode}]})
        .mockResolvedValueOnce({rows: []});

      const result = await service.setNesting('w1', 't1', {mode, parentTypeIds: ['t2']});

      expect(client.query.mock.calls[1][1]).toEqual(['t1', 'w1', mode]);
      expect(client.query.mock.calls[2][0]).toContain('DELETE FROM type_parent_rules');
      expect(client.query.mock.calls.some((call) => String(call[0]).includes('INSERT INTO type_parent_rules'))).toBe(false);
      expect(result).toEqual({id: 't1', nestMode: mode, parentTypeIds: [], clearedLinks: 0});
    });

    it('asks for confirmation when links would break and passes the confirmation on', async () => {
      const {service, client, nesting} = createService();
      const links = [{entryId: 'e1'}];

      nesting.brokenLinks.mockResolvedValue(links);
      nesting.unlinkOrThrow.mockResolvedValue(1);
      client.query
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: []});

      const result = await service.setNesting('w1', 't1', {mode: 'none', confirmUnlink: true});

      expect(nesting.brokenLinks).toHaveBeenCalledWith(client, 'w1');
      expect(nesting.unlinkOrThrow).toHaveBeenCalledWith(client, 'w1', links, true);
      expect(result.clearedLinks).toBe(1);
    });

    it('passes the conflict on when the links are not confirmed', async () => {
      const {service, client, nesting} = createService();

      nesting.unlinkOrThrow.mockRejectedValue(new ConflictException('This change would remove 1 nesting link'));
      client.query.mockResolvedValueOnce({rows: [{id: 't1'}]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: []});

      await expect(service.setNesting('w1', 't1', {mode: 'none'})).rejects.toThrow(ConflictException);
      expect(nesting.unlinkOrThrow).toHaveBeenCalledWith(client, 'w1', [], false);
    });
  });

  describe('setMappable', () => {
    it('turns the map setting on', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 't1', mappable: true}]});

      expect(await service.setMappable('w1', 't1', {mappable: true})).toEqual({id: 't1', mappable: true});
      expect(db.query.mock.calls[0][1]).toEqual(['t1', 'w1', true]);
    });

    it('turns the map setting off without touching any entries', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 't1', mappable: false}]});

      await service.setMappable('w1', 't1', {mappable: false});

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toContain('UPDATE entry_types');
    });

    it('returns not found for a type in another world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.setMappable('w1', 't1', {mappable: true})).rejects.toThrow(new NotFoundException('Entry type not found'));
    });
  });

  describe('remove', () => {
    it('returns not found for a missing type', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 't1', {confirmName: 'Places'})).rejects.toThrow(new NotFoundException('Entry type not found'));
    });

    it('requires the type name to be typed', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Places'}]});

      await expect(service.remove('w1', 't1', {confirmName: 'places'})).rejects.toThrow(new BadRequestException('Confirmation does not match type name'));
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('rejects moving entries to the same type or a type from another world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Places'}]}).mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 't1', {confirmName: 'Places', moveToTypeId: 't9'})).rejects.toThrow(new BadRequestException('Choose another type to move entries to'));

      client.query.mockResolvedValueOnce({rows: [{name: 'Places'}]}).mockResolvedValueOnce({rows: [{id: 't1'}]});

      await expect(service.remove('w1', 't1', {confirmName: 'Places', moveToTypeId: 't1'})).rejects.toThrow(BadRequestException);
    });

    it('moves the entries to another type before deleting', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Places'}]})
        .mockResolvedValueOnce({rows: [{id: 't2'}]})
        .mockResolvedValueOnce({rowCount: 4, rows: []})
        .mockResolvedValueOnce({rows: []});

      const result = await service.remove('w1', 't1', {confirmName: 'Places', moveToTypeId: 't2'});

      expect(client.query.mock.calls[2][1]).toEqual(['t1', 'w1', 't2']);
      expect(client.query.mock.calls[3][0]).toContain('DELETE FROM entry_types');
      expect(result).toEqual({deleted: true, affectedEntries: 4, clearedLinks: 0});
    });

    it('leaves the entries without a type when no target is given', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Places'}]})
        .mockResolvedValueOnce({rowCount: 2, rows: []})
        .mockResolvedValueOnce({rows: []});

      await service.remove('w1', 't1', {confirmName: 'Places'});

      expect(client.query.mock.calls[1][1]).toEqual(['t1', 'w1', null]);
    });

    it('asks for confirmation when deleting the type would break nesting', async () => {
      const {service, client, nesting} = createService();

      nesting.unlinkOrThrow.mockRejectedValue(new ConflictException('This change would remove 1 nesting link'));
      client.query
        .mockResolvedValueOnce({rows: [{name: 'Places'}]})
        .mockResolvedValueOnce({rowCount: 0, rows: []})
        .mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 't1', {confirmName: 'Places'})).rejects.toThrow(ConflictException);
      expect(nesting.unlinkOrThrow).toHaveBeenCalledWith(client, 'w1', [], false);
    });

    it('passes the confirmation on and reports the cleared links', async () => {
      const {service, client, nesting} = createService();

      nesting.unlinkOrThrow.mockResolvedValue(3);
      client.query
        .mockResolvedValueOnce({rows: [{name: 'Places'}]})
        .mockResolvedValueOnce({rowCount: 0, rows: []})
        .mockResolvedValueOnce({rows: []});

      const result = await service.remove('w1', 't1', {confirmName: 'Places', confirmUnlink: true});

      expect(nesting.unlinkOrThrow).toHaveBeenCalledWith(client, 'w1', [], true);
      expect(result.clearedLinks).toBe(3);
    });
  });
});
