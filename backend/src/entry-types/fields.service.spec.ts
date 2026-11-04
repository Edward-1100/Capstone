import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FieldsService } from './fields.service';

const CHOICE_CONFIG = {options: [{id: 'a', label: 'Red'}, {id: 'b', label: 'Blue'}]};

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;

  return {service: new FieldsService(db), client};
}

function duplicateError() {
  return Object.assign(new Error('duplicate'), {code: '23505'});
}

describe('FieldsService', () => {
  describe('create', () => {
    it('rejects a type that already has 33 fields', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: [{count: 33, last: 32}]});

      await expect(service.create('w1', 't1', {name: 'Extra', fieldType: 'text'})).rejects.toThrow('A type can have up to 33 fields');
      expect(client.query).toHaveBeenCalledTimes(2);
    });

    it('allows the 33rd field and puts it last', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: [{count: 32, last: 31}]})
        .mockResolvedValueOnce({rows: [{id: 'f33'}]})
        .mockResolvedValueOnce({rows: [{id: 'f33', name: 'Extra'}]});

      const created = await service.create('w1', 't1', {name: ' Extra ', fieldType: 'text'});

      expect(created).toEqual({id: 'f33', name: 'Extra'});
      expect(client.query.mock.calls[2][1]).toEqual(['t1', 'Extra', 'text', false, 32, '{}']);
    });

    it('returns not found when the type is not in this world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.create('w1', 't1', {name: 'Extra', fieldType: 'text'})).rejects.toThrow(NotFoundException);
    });

    it('returns a conflict for a name that is already used', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: [{count: 1, last: 0}]})
        .mockRejectedValueOnce(duplicateError());

      await expect(service.create('w1', 't1', {name: 'Extra', fieldType: 'text'})).rejects.toThrow('A field with that name already exists');
    });

    it('rejects a bad config before saving anything', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 't1'}]})
        .mockResolvedValueOnce({rows: [{count: 0, last: -1}]});

      await expect(service.create('w1', 't1', {name: 'Rank', fieldType: 'scale', config: {min: 5, max: 1}})).rejects.toThrow(BadRequestException);
      expect(client.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('returns not found for a field that is not on this type', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', 't1', 'f1', {name: 'New'})).rejects.toThrow(NotFoundException);
    });

    it('asks for confirmation before removing an option that entries use', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'choice', config: CHOICE_CONFIG}]})
        .mockResolvedValueOnce({rows: [{id: 'e1', fields: {f1: 'b'}}, {id: 'e2', fields: {f1: 'a'}}]});

      await expect(service.update('w1', 't1', 'f1', {config: {options: [{id: 'a', label: 'Red'}]}})).rejects.toThrow(ConflictException);
      expect(client.query).toHaveBeenCalledTimes(2);
    });

    it('reports how many entries would lose their value', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'choice', config: CHOICE_CONFIG}]})
        .mockResolvedValueOnce({rows: [{id: 'e1', fields: {f1: 'b'}}, {id: 'e2', fields: {f1: 'a'}}]});

      try {
        await service.update('w1', 't1', 'f1', {config: {options: [{id: 'a', label: 'Red'}]}});
      } catch (err: any) {
        expect(err.getResponse()).toEqual({message: '1 entries use options you removed', affectedEntries: 1});
      }
    });

    it('clears the removed option and bumps the version when confirmed', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'choice', config: CHOICE_CONFIG}]})
        .mockResolvedValueOnce({rows: [{id: 'e1', fields: {f1: 'b', other: 'x'}}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 'f1'}]});

      await service.update('w1', 't1', 'f1', {config: {options: [{id: 'a', label: 'Red'}]}, confirmClear: true});

      const clearCall = client.query.mock.calls[2];

      expect(clearCall[0]).toContain('version = version + 1');
      expect(clearCall[1]).toEqual(['e1', JSON.stringify({other: 'x'})]);
    });

    it('only removes the dropped option from a multiple choice value', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'multi_choice', config: CHOICE_CONFIG}]})
        .mockResolvedValueOnce({rows: [{id: 'e1', fields: {f1: ['a', 'b']}}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 'f1'}]});

      await service.update('w1', 't1', 'f1', {config: {options: [{id: 'a', label: 'Red'}]}, confirmClear: true});

      expect(client.query.mock.calls[2][1]).toEqual(['e1', JSON.stringify({f1: ['a']})]);
    });

    it('does not touch entries when an option is only renamed', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'choice', config: CHOICE_CONFIG}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 'f1'}]});

      await service.update('w1', 't1', 'f1', {config: {options: [{id: 'a', label: 'Crimson'}, {id: 'b', label: 'Blue'}]}});

      expect(client.query).toHaveBeenCalledTimes(3);
      expect(client.query.mock.calls[1][0]).toContain('UPDATE type_fields');
    });

    it('does not touch entries when options are only added', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'choice', config: CHOICE_CONFIG}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 'f1'}]});

      await service.update('w1', 't1', 'f1', {config: {options: [{id: 'a', label: 'Red'}, {id: 'b', label: 'Blue'}, {label: 'Green'}]}});

      expect(client.query).toHaveBeenCalledTimes(3);
    });

    it('does not let the field type change', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{id: 'f1', fieldType: 'text', config: {}}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: 'f1'}]});

      await service.update('w1', 't1', 'f1', {name: 'Renamed', fieldType: 'number'} as any);

      expect(client.query.mock.calls[1][1]).toEqual(['f1', 'Renamed', null, '{}']);
    });
  });

  describe('remove', () => {
    it('rejects a wrong confirmation name without deleting', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Rank'}]});

      await expect(service.remove('w1', 't1', 'f1', {confirmName: 'rank'})).rejects.toThrow('Confirmation does not match field name');
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('deletes the field and clears its values from entries', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{name: 'Rank'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [], rowCount: 3});

      expect(await service.remove('w1', 't1', 'f1', {confirmName: 'Rank'})).toEqual({deleted: true, affectedEntries: 3});
      expect(client.query.mock.calls[2][0]).toContain('version = version + 1');
    });

    it('returns not found for a missing field', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 't1', 'f1', {confirmName: 'Rank'})).rejects.toThrow(NotFoundException);
    });
  });
});
