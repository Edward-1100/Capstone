import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TagRulesService } from './tag-rules.service';

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;

  return {service: new TagRulesService(db), db, client};
}

const TAG = '11111111-1111-4111-8111-111111111111';
const TYPE = '22222222-2222-4222-8222-222222222222';
const ENTRY = '33333333-3333-4333-8333-333333333333';
const REL = '44444444-4444-4444-8444-444444444444';

function sqlOf(client: any) {
  return client.query.mock.calls.map((call: any) => call[0]);
}

describe('TagRulesService', () => {
  describe('get', () => {
    it('returns not found for a missing tag', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.get('w1', TAG)).rejects.toThrow(NotFoundException);
    });

    it('reports the rule as paused when a condition is broken', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{match: 'all'}]}).mockResolvedValueOnce({rows: [{id: 'c1', broken: false}, {id: 'c2', broken: true}]});

      const rule = await service.get('w1', TAG);

      expect(rule.paused).toBe(true);
      expect(rule.match).toBe('all');
    });

    it('reports the rule as not paused when every condition works', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{match: 'any'}]}).mockResolvedValueOnce({rows: []});

      expect((await service.get('w1', TAG)).paused).toBe(false);
    });
  });

  describe('save', () => {
    it('rejects too many conditions', async () => {
      const {service, db} = createService();
      const many = Array.from({length: 21}, () => ({kind: 'type', entryTypeId: TYPE}));

      await expect(service.save('w1', TAG, {conditions: many})).rejects.toThrow('A rule can have up to 20 conditions');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('rejects a condition with an unknown kind', async () => {
      const {service} = createService();

      await expect(service.save('w1', TAG, {conditions: [{kind: 'colour'}]})).rejects.toThrow('kind must be type, relationship or inside');
      await expect(service.save('w1', TAG, {conditions: [null]})).rejects.toThrow(BadRequestException);
    });

    it('rejects conditions with missing choices', async () => {
      const {service} = createService();

      await expect(service.save('w1', TAG, {conditions: [{kind: 'type'}]})).rejects.toThrow('Choose an entry type');
      await expect(service.save('w1', TAG, {conditions: [{kind: 'relationship'}]})).rejects.toThrow('Choose a relationship type');
      await expect(service.save('w1', TAG, {conditions: [{kind: 'inside'}]})).rejects.toThrow('Choose an entry');
      await expect(service.save('w1', TAG, {conditions: [{kind: 'relationship', relationshipTypeId: REL, otherAny: false}]})).rejects.toThrow('Choose an entry');
      await expect(service.save('w1', TAG, {conditions: [{kind: 'relationship', relationshipTypeId: REL, side: 'up'}]})).rejects.toThrow('side must be from, to or either');
    });

    it('returns not found for a missing tag', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: []});

      await expect(service.save('w1', TAG, {match: 'any'})).rejects.toThrow(NotFoundException);
    });

    it('rejects references from another world', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TAG}]}).mockResolvedValueOnce({rows: []});

      await expect(service.save('w1', TAG, {conditions: [{kind: 'type', entryTypeId: TYPE}]})).rejects.toThrow('Choose entry types from this world');
    });

    it('replaces the conditions in order and saves the match mode', async () => {
      const {service, client, db} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TAG}]}).mockResolvedValueOnce({rows: [{id: TYPE}]}).mockResolvedValue({rows: []});
      db.query.mockResolvedValueOnce({rows: [{match: 'any'}]}).mockResolvedValueOnce({rows: []});

      await service.save('w1', TAG, {match: 'any', conditions: [{kind: 'type', entryTypeId: TYPE}, {kind: 'type', entryTypeId: TYPE, exclude: true}]});

      const inserts = client.query.mock.calls.filter((call: any) => call[0].includes('INSERT INTO tag_rule_conditions'));

      expect(sqlOf(client).some((text: string) => text.includes('DELETE FROM tag_rule_conditions'))).toBe(true);
      expect(inserts).toHaveLength(2);
      expect(inserts[0][1].slice(0, 5)).toEqual(['w1', TAG, 0, false, 'type']);
      expect(inserts[1][1].slice(0, 5)).toEqual(['w1', TAG, 1, true, 'type']);
      expect(client.query.mock.calls.find((call: any) => call[0].includes('SET rule_match'))[1]).toEqual([TAG, 'any']);
    });

    it('leaves the conditions alone when only the match mode is sent', async () => {
      const {service, client, db} = createService();

      client.query.mockResolvedValueOnce({rows: [{id: TAG}]}).mockResolvedValue({rows: []});
      db.query.mockResolvedValueOnce({rows: [{match: 'all'}]}).mockResolvedValueOnce({rows: []});

      await service.save('w1', TAG, {match: 'all'});

      expect(sqlOf(client).some((text: string) => text.includes('DELETE FROM tag_rule_conditions'))).toBe(false);
    });
  });

  describe('preview', () => {
    it('returns the applied entries, the total and the excluded entries', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{match: 'all'}]})
        .mockResolvedValueOnce({rows: [{id: 'e1', name: 'Aria', added: false}]})
        .mockResolvedValueOnce({rows: [{count: 3}]})
        .mockResolvedValueOnce({rows: [{id: 'e2', name: 'Bo'}]});

      expect(await service.preview('w1', TAG)).toEqual({entries: [{id: 'e1', name: 'Aria', added: false}], total: 3, excluded: [{id: 'e2', name: 'Bo'}]});
    });
  });

  describe('setEntry', () => {
    it('saves a forced add or exclude for an active entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{match: 'all'}]}).mockResolvedValueOnce({rows: [{id: ENTRY}]}).mockResolvedValueOnce({rows: []});

      expect(await service.setEntry('w1', TAG, ENTRY, true)).toEqual({entryId: ENTRY, exclude: true});
      expect(db.query.mock.calls[2][1]).toEqual(['w1', TAG, ENTRY, true]);
    });

    it('returns not found for a missing entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{match: 'all'}]}).mockResolvedValueOnce({rows: []});

      await expect(service.setEntry('w1', TAG, ENTRY, false)).rejects.toThrow('Entry not found');
    });
  });

  describe('clearEntry', () => {
    it('removes the override', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{match: 'all'}]}).mockResolvedValueOnce({rows: []});

      expect(await service.clearEntry('w1', TAG, ENTRY)).toEqual({deleted: true});
      expect(db.query.mock.calls[1][1]).toEqual([TAG, ENTRY, 'w1']);
    });
  });
});
