import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EntriesService } from './entries.service';

const ENTRY_ID = '11111111-1111-4111-8111-111111111111';
const TYPE_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_TYPE_ID = '33333333-3333-4333-8333-333333333333';
const PARENT_ID = '44444444-4444-4444-8444-444444444444';

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;
  const storage = {upload: jest.fn(), remove: jest.fn(), getUrl: jest.fn()} as any;
  const nesting = {
    lockWorld: jest.fn().mockResolvedValue(undefined),
    assertParent: jest.fn().mockResolvedValue(undefined),
    brokenLinks: jest.fn().mockResolvedValue([]),
    unlinkOrThrow: jest.fn().mockResolvedValue(0),
    promoteChildren: jest.fn().mockResolvedValue(undefined),
    parentOptions: jest.fn().mockResolvedValue([{id: PARENT_ID, name: 'Realm'}]),
  } as any;
  const service = new EntriesService(db, storage, nesting);

  jest.spyOn(service, 'findOne').mockResolvedValue({id: ENTRY_ID} as any);

  return {service, db, client, nesting};
}

function currentEntry(overrides: Record<string, any> = {}) {
  return {rows: [Object.assign({name: 'Aria', type_id: TYPE_ID, parent_id: null, fields: {}, version: 1}, overrides)]};
}

describe('EntriesService nesting', () => {
  describe('create', () => {
    it('checks the parent before saving and stores it', async () => {
      const {service, client, nesting} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{id: ENTRY_ID}]})
        .mockResolvedValueOnce({rows: []});

      await service.create('w1', 'u1', {name: ' Keep ', typeId: TYPE_ID, parentId: PARENT_ID});

      expect(nesting.assertParent).toHaveBeenCalledWith(client, 'w1', null, TYPE_ID, PARENT_ID);
      expect(client.query.mock.calls[2][1][6]).toBe(PARENT_ID);
    });

    it('does not check anything when there is no parent', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [{id: ENTRY_ID}]}).mockResolvedValueOnce({rows: []});

      await service.create('w1', 'u1', {name: 'Keep', typeId: TYPE_ID});

      expect(nesting.assertParent).not.toHaveBeenCalled();
      expect(client.query.mock.calls[2][1][6]).toBeNull();
    });

    it('does not save when the parent is not allowed', async () => {
      const {service, client, nesting} = createService();

      nesting.assertParent.mockRejectedValue(new BadRequestException('Cities can not be nested inside Rooms'));
      client.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: []});

      await expect(service.create('w1', 'u1', {name: 'Keep', typeId: TYPE_ID, parentId: PARENT_ID})).rejects.toThrow('Cities can not be nested inside Rooms');
      expect(client.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('checks a new parent with the current type of the entry', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce(currentEntry()).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, parentId: PARENT_ID});

      expect(nesting.assertParent).toHaveBeenCalledWith(client, 'w1', ENTRY_ID, TYPE_ID, PARENT_ID);
      expect(client.query.mock.calls[1][1][8]).toBe(true);
      expect(client.query.mock.calls[1][1][9]).toBe(PARENT_ID);
    });

    it('checks a new parent with the new type when both change', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce(currentEntry()).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, typeId: OTHER_TYPE_ID, parentId: PARENT_ID});

      expect(nesting.assertParent).toHaveBeenCalledWith(client, 'w1', ENTRY_ID, OTHER_TYPE_ID, PARENT_ID);
    });

    it('removes the parent without checking anything', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce(currentEntry({parent_id: PARENT_ID})).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, parentId: null});

      expect(nesting.assertParent).not.toHaveBeenCalled();
      expect(client.query.mock.calls[1][1][8]).toBe(true);
      expect(client.query.mock.calls[1][1][9]).toBeNull();
    });

    it('does not check a parent that did not change', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce(currentEntry({parent_id: PARENT_ID})).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, parentId: PARENT_ID});

      expect(nesting.assertParent).not.toHaveBeenCalled();
    });

    it('leaves the parent alone when it is not part of the change', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce(currentEntry({parent_id: PARENT_ID})).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, description: 'New'});

      expect(client.query.mock.calls[1][1][8]).toBe(false);
    });

    it('does not save when the parent is not allowed', async () => {
      const {service, client, nesting} = createService();

      nesting.assertParent.mockRejectedValue(new BadRequestException('That entry is nested inside this one, so it can not be its parent'));
      client.query.mockResolvedValueOnce(currentEntry());

      await expect(service.update('w1', ENTRY_ID, 'u1', {version: 1, parentId: PARENT_ID})).rejects.toThrow('nested inside this one');
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('checks for broken links when the type changes', async () => {
      const {service, client, nesting} = createService();
      const links = [{entryId: ENTRY_ID}];

      nesting.brokenLinks.mockResolvedValue(links);
      client.query.mockResolvedValueOnce(currentEntry()).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, typeId: OTHER_TYPE_ID});

      expect(nesting.brokenLinks).toHaveBeenCalledWith(client, 'w1', [ENTRY_ID]);
      expect(nesting.unlinkOrThrow).toHaveBeenCalledWith(client, 'w1', links, false, ENTRY_ID);
    });

    it('clears the links when the type change is confirmed', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce(currentEntry()).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, typeId: OTHER_TYPE_ID, confirmUnlink: true});

      expect(nesting.unlinkOrThrow).toHaveBeenCalledWith(client, 'w1', [], true, ENTRY_ID);
    });

    it('asks for confirmation when the type change would break links', async () => {
      const {service, client, nesting} = createService();

      nesting.unlinkOrThrow.mockRejectedValue(new ConflictException('This change would remove 1 nesting link'));
      client.query.mockResolvedValueOnce(currentEntry()).mockResolvedValueOnce({rows: [{name: 'Aria'}]});

      await expect(service.update('w1', ENTRY_ID, 'u1', {version: 1, typeId: OTHER_TYPE_ID})).rejects.toThrow(ConflictException);
    });

    it('does not look for broken links when the type stays the same', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce(currentEntry()).mockResolvedValueOnce({rows: [{name: 'Aria'}]}).mockResolvedValueOnce({rows: []});

      await service.update('w1', ENTRY_ID, 'u1', {version: 1, typeId: TYPE_ID});

      expect(nesting.brokenLinks).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('moves the children up to the parent of the deleted entry', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'Realm', parentId: PARENT_ID}]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', ENTRY_ID, 'u1')).toEqual({deleted: true});
      expect(nesting.lockWorld).toHaveBeenCalledWith(client, 'w1');
      expect(nesting.promoteChildren).toHaveBeenCalledWith(client, 'w1', ENTRY_ID, PARENT_ID);
    });

    it('frees the children of a top level entry', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce({rows: [{name: 'World', parentId: null}]}).mockResolvedValueOnce({rows: []});

      await service.remove('w1', ENTRY_ID, 'u1');

      expect(nesting.promoteChildren).toHaveBeenCalledWith(client, 'w1', ENTRY_ID, null);
    });

    it('returns not found without moving anything', async () => {
      const {service, client, nesting} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', ENTRY_ID, 'u1')).rejects.toThrow(new NotFoundException('Entry not found'));
      expect(nesting.promoteChildren).not.toHaveBeenCalled();
    });
  });

  describe('parentOptions', () => {
    it('lists the allowed parents for a type', async () => {
      const {service, db, nesting} = createService();

      expect(await service.parentOptions('w1', TYPE_ID, ENTRY_ID)).toEqual([{id: PARENT_ID, name: 'Realm'}]);
      expect(nesting.parentOptions).toHaveBeenCalledWith(db, 'w1', TYPE_ID, ENTRY_ID);
    });

    it('works for a new entry', async () => {
      const {service, db, nesting} = createService();

      await service.parentOptions('w1', TYPE_ID);

      expect(nesting.parentOptions).toHaveBeenCalledWith(db, 'w1', TYPE_ID, undefined);
    });

    it('requires a valid type id', async () => {
      const {service} = createService();

      await expect(service.parentOptions('w1', undefined)).rejects.toThrow(new BadRequestException('typeId must be a valid id'));
      await expect(service.parentOptions('w1', 'nope')).rejects.toThrow(new BadRequestException('typeId must be a valid id'));
    });

    it('requires a valid entry id when one is given', async () => {
      const {service} = createService();

      await expect(service.parentOptions('w1', TYPE_ID, 'nope')).rejects.toThrow(new BadRequestException('entryId must be a valid id'));
    });
  });
});
