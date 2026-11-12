import { BadRequestException, ConflictException } from '@nestjs/common';
import { NestingService } from './nesting.service';

function createService() {
  const client = {query: jest.fn()};

  return {service: new NestingService(), client};
}

function typeRow(overrides: Record<string, any> = {}) {
  return {rows: [Object.assign({name: 'Locations', nestMode: 'all'}, overrides)]};
}

function parentRow(overrides: Record<string, any> = {}) {
  return {rows: [Object.assign({typeId: 't1', typeName: 'Locations'}, overrides)]};
}

function link(id: string) {
  return {entryId: id, name: `Place ${id}`, parentId: 'p1', parentName: 'Realm'};
}

describe('NestingService', () => {
  describe('assertParent', () => {
    it('locks the world before anything else', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce(typeRow()).mockResolvedValueOnce(parentRow());

      await service.assertParent(client, 'w1', null, 't1', 'p1');

      expect(client.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
      expect(client.query.mock.calls[0][1]).toEqual(['nesting:w1']);
    });

    it('rejects an entry as its own parent', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValue({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'e1')).rejects.toThrow(new BadRequestException('An entry can not be its own parent'));
      expect(client.query).toHaveBeenCalledTimes(1);
    });

    it('rejects an entry without a type', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValue({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', null, 'p1')).rejects.toThrow(new BadRequestException('Entries without a type can not be nested'));
    });

    it('rejects a type that is not in the world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).rejects.toThrow(new BadRequestException('Type not found in this world'));
    });

    it('rejects a child type that can not be nested', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce(typeRow({nestMode: 'none'}));

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).rejects.toThrow(new BadRequestException('Entries of this type can not be nested'));
    });

    it('rejects a parent that does not exist or is deleted', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce(typeRow()).mockResolvedValueOnce({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).rejects.toThrow(new BadRequestException('Parent not found in this world'));
    });

    it('rejects a parent of another type when only its own type is allowed', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce(typeRow({nestMode: 'own'}))
        .mockResolvedValueOnce(parentRow({typeId: 't2', typeName: 'Rooms'}));

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).rejects.toThrow(new BadRequestException('Locations can only be nested inside other Locations'));
    });

    it('accepts a parent of the same type when only its own type is allowed', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce(typeRow({nestMode: 'own'}))
        .mockResolvedValueOnce(parentRow())
        .mockResolvedValueOnce({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).resolves.toBeUndefined();
      expect(client.query.mock.calls.some((call) => String(call[0]).includes('type_parent_rules'))).toBe(false);
    });

    it('rejects a parent type that is not on the chosen list and names both types', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce(typeRow({name: 'Cities', nestMode: 'chosen'}))
        .mockResolvedValueOnce(parentRow({typeName: 'Rooms'}))
        .mockResolvedValueOnce({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).rejects.toThrow(new BadRequestException('Cities can not be nested inside Rooms'));
      expect(client.query.mock.calls[3][1]).toEqual(['t1', 't1']);
    });

    it('rejects a parent without a type when types are chosen', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce(typeRow({name: 'Cities', nestMode: 'chosen'}))
        .mockResolvedValueOnce(parentRow({typeId: null, typeName: null}))
        .mockResolvedValueOnce({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).rejects.toThrow(new BadRequestException('Cities can not be nested inside entries without a type'));
    });

    it('accepts a parent type on the chosen list', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce(typeRow({nestMode: 'chosen'}))
        .mockResolvedValueOnce(parentRow())
        .mockResolvedValueOnce({rows: [{'?column?': 1}]})
        .mockResolvedValueOnce({rows: []});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).resolves.toBeUndefined();
    });

    it('accepts any parent, even one without a type, when all types are allowed', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce(typeRow())
        .mockResolvedValueOnce(parentRow({typeId: null, typeName: null}))
        .mockResolvedValueOnce({rows: []});

      await service.assertParent(client, 'w1', 'e1', 't1', 'p1');

      expect(client.query).toHaveBeenCalledTimes(4);
      expect(client.query.mock.calls.some((call) => String(call[0]).includes('type_parent_rules'))).toBe(false);
    });

    it('rejects a parent that is nested inside the entry', async () => {
      const {service, client} = createService();

      client.query
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce(typeRow())
        .mockResolvedValueOnce(parentRow())
        .mockResolvedValueOnce({rows: [{'?column?': 1}]});

      await expect(service.assertParent(client, 'w1', 'e1', 't1', 'p1')).rejects.toThrow(new BadRequestException('That entry is nested inside this one, so it can not be its parent'));
      expect(client.query.mock.calls[3][1]).toEqual(['p1', 'w1', 'e1']);
    });

    it('does not check for cycles when the entry is new', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce(typeRow()).mockResolvedValueOnce(parentRow());

      await service.assertParent(client, 'w1', null, 't1', 'p1');

      expect(client.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('brokenLinks', () => {
    it('checks the whole world when no entries are given', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [link('e1')]});

      expect(await service.brokenLinks(client, 'w1')).toEqual([link('e1')]);
      expect(client.query.mock.calls[0][1]).toEqual(['w1', null]);
    });

    it('judges links by the nesting mode of the child type', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await service.brokenLinks(client, 'w1');

      const sql = String(client.query.mock.calls[0][0]);

      expect(sql).toContain("ct.nest_mode = 'all'");
      expect(sql).toContain("ct.nest_mode = 'own' AND ct.id = p.type_id");
      expect(sql).toContain("ct.nest_mode = 'chosen'");
      expect(sql).not.toContain('nestable');
    });

    it('limits the check to the given entries and their children', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await service.brokenLinks(client, 'w1', ['e1', 'e2']);

      expect(client.query.mock.calls[0][1]).toEqual(['w1', ['e1', 'e2']]);
    });
  });

  describe('unlinkOrThrow', () => {
    it('does nothing when there are no links', async () => {
      const {service, client} = createService();

      expect(await service.unlinkOrThrow(client, 'w1', [], false)).toBe(0);
      expect(client.query).not.toHaveBeenCalled();
    });

    it('throws a conflict with the list when not confirmed', async () => {
      const {service, client} = createService();

      const error: any = await service.unlinkOrThrow(client, 'w1', [link('e1')], false).catch((err) => err);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({message: 'This change would remove 1 nesting link', count: 1, links: [link('e1')]});
      expect(client.query).not.toHaveBeenCalled();
    });

    it('uses the plural for several links', async () => {
      const {service, client} = createService();

      const error: any = await service.unlinkOrThrow(client, 'w1', [link('e1'), link('e2')], false).catch((err) => err);

      expect(error.getResponse().message).toBe('This change would remove 2 nesting links');
    });

    it('lists at most 100 links but reports the full count', async () => {
      const {service, client} = createService();
      const links = Array.from({length: 150}, (_, index) => link(`e${index}`));

      const error: any = await service.unlinkOrThrow(client, 'w1', links, false).catch((err) => err);

      expect(error.getResponse().count).toBe(150);
      expect(error.getResponse().links).toHaveLength(100);
    });

    it('clears the links when confirmed and returns how many', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      expect(await service.unlinkOrThrow(client, 'w1', [link('e1'), link('e2')], true)).toBe(2);
      expect(client.query.mock.calls[0][1]).toEqual(['w1', ['e1', 'e2'], null]);
    });

    it('does not bump the version of the entry being saved', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await service.unlinkOrThrow(client, 'w1', [link('e1')], true, 'e1');

      expect(client.query.mock.calls[0][1]).toEqual(['w1', ['e1'], 'e1']);
    });
  });

  describe('promoteChildren', () => {
    it('moves children up when they are allowed there and frees the rest', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValue({rows: []});

      await service.promoteChildren(client, 'w1', 'e1', 'p1');

      expect(client.query).toHaveBeenCalledTimes(2);
      expect(client.query.mock.calls[0][1]).toEqual(['e1', 'w1', 'p1']);
      expect(client.query.mock.calls[1][1]).toEqual(['e1', 'w1']);
    });

    it('only frees the children when there is no grandparent', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValue({rows: []});

      await service.promoteChildren(client, 'w1', 'e1', null);

      expect(client.query).toHaveBeenCalledTimes(1);
      expect(client.query.mock.calls[0][1]).toEqual(['e1', 'w1']);
    });
  });

  describe('parentOptions', () => {
    it('lists options for a new entry without excluding anything', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: 'p1', name: 'Realm'}]});

      expect(await service.parentOptions(client, 'w1', 't1')).toEqual([{id: 'p1', name: 'Realm'}]);
      expect(client.query.mock.calls[0][1]).toEqual(['w1', 't1', null]);
    });

    it('excludes the entry and everything inside it', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await service.parentOptions(client, 'w1', 't1', 'e1');

      expect(client.query.mock.calls[0][1]).toEqual(['w1', 't1', 'e1']);
      expect(client.query.mock.calls[0][0]).toContain('descendants');
    });
  });

  describe('ancestors', () => {
    it('returns the chain of parents with the top one first', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: 'a', name: 'World'}, {id: 'b', name: 'Realm'}]});

      expect(await service.ancestors(client, 'w1', 'e1')).toEqual([{id: 'a', name: 'World'}, {id: 'b', name: 'Realm'}]);
      expect(client.query.mock.calls[0][1]).toEqual(['w1', 'e1']);
      expect(client.query.mock.calls[0][0]).toContain('ORDER BY depth DESC');
    });
  });
});
