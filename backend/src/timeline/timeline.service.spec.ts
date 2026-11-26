import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TimelineService } from './timeline.service';

function createService() {
  const db = {query: jest.fn()} as any;

  return {service: new TimelineService(db), db};
}

function row(overrides: Record<string, any> = {}) {
  return Object.assign({
    id: 'k1',
    entryId: 'e1',
    entryName: 'The Founding',
    typeName: 'Events',
    startYear: 100,
    startMonth: null,
    startDay: null,
    startHour: null,
    startMinute: null,
    endYear: null,
    endMonth: null,
    endDay: null,
    endHour: null,
    endMinute: null,
    color: null,
  }, overrides);
}

function duplicateError() {
  return Object.assign(new Error('duplicate'), {code: '23505'});
}

function allowed(db: any) {
  db.query.mockResolvedValueOnce({rows: [{typeId: 't1', timelineable: true}]});
}

describe('TimelineService', () => {
  describe('list', () => {
    it('returns the placed entries of timeline types in order', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [row()]});

      expect(await service.list('w1')).toEqual([row()]);
      expect(db.query.mock.calls[0][0]).toContain('t.timelineable');
      expect(db.query.mock.calls[0][0]).toContain('active_entries');
      expect(db.query.mock.calls[0][0]).toContain('COALESCE(k.start_minute, 0)');
      expect(db.query.mock.calls[0][1]).toEqual(['w1', null]);
    });
  });

  describe('create', () => {
    it('places an entry with a start year only', async () => {
      const {service, db} = createService();

      allowed(db);
      db.query.mockResolvedValueOnce({rows: [{id: 'k1'}]}).mockResolvedValueOnce({rows: [row()]});

      expect(await service.create('w1', 'u1', {entryId: 'e1', startYear: 100})).toEqual(row());
      expect(db.query.mock.calls[1][1]).toEqual(['w1', 'e1', 100, null, null, null, null, null, null, null, null, null, 'u1']);
    });

    it('places an entry with a full start and end date and time', async () => {
      const {service, db} = createService();

      allowed(db);
      db.query.mockResolvedValueOnce({rows: [{id: 'k1'}]}).mockResolvedValueOnce({rows: [row()]});

      await service.create('w1', 'u1', {entryId: 'e1', startYear: -500, startMonth: 3, startDay: 14, startHour: 9, startMinute: 30, endYear: -400, endMonth: 12, endDay: 31, endHour: 23, endMinute: 59});

      expect(db.query.mock.calls[1][1]).toEqual(['w1', 'e1', -500, 3, 14, 9, 30, -400, 12, 31, 23, 59, 'u1']);
    });

    it('places an entry with partial dates', async () => {
      const {service, db} = createService();

      allowed(db);
      db.query.mockResolvedValueOnce({rows: [{id: 'k1'}]}).mockResolvedValueOnce({rows: [row()]});

      await service.create('w1', 'u1', {entryId: 'e1', startYear: 100, startMonth: 3, endYear: 100, endMonth: 6});

      expect(db.query.mock.calls[1][1]).toEqual(['w1', 'e1', 100, 3, null, null, null, 100, 6, null, null, null, 'u1']);
    });

    it('accepts a leap day only in a leap year', async () => {
      const {service, db} = createService();

      allowed(db);
      db.query.mockResolvedValueOnce({rows: [{id: 'k1'}]}).mockResolvedValueOnce({rows: [row()]});

      await service.create('w1', 'u1', {entryId: 'e1', startYear: 2024, startMonth: 2, startDay: 29});

      expect(db.query.mock.calls[1][1].slice(2, 5)).toEqual([2024, 2, 29]);
      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 2023, startMonth: 2, startDay: 29})).rejects.toThrow(new BadRequestException('Start day is not valid for that month'));
    });

    it('rejects invalid dates without querying', async () => {
      const {service, db} = createService();

      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 100, startDay: 4})).rejects.toThrow(new BadRequestException('Start day needs a start month'));
      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 100, endMonth: 4})).rejects.toThrow(new BadRequestException('End year is needed when other end fields are set'));
      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 100, startMonth: 5, endYear: 100, endMonth: 4})).rejects.toThrow(new BadRequestException('End can not be before start'));
      expect(db.query).not.toHaveBeenCalled();
    });

    it('returns not found for an entry in another world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 1})).rejects.toThrow(new NotFoundException('Entry not found'));
      expect(db.query.mock.calls[0][1]).toEqual(['e1', 'w1']);
    });

    it('rejects an entry without a type', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{typeId: null, timelineable: null}]});

      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 1})).rejects.toThrow(new BadRequestException('Entries without a type can not be placed on the timeline'));
    });

    it('rejects an entry of a type that is not on the timeline', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{typeId: 't1', timelineable: false}]});

      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 1})).rejects.toThrow(new BadRequestException('Entries of this type can not be placed on the timeline'));
    });

    it('rejects an entry that is already on the timeline', async () => {
      const {service, db} = createService();

      allowed(db);
      db.query.mockRejectedValueOnce(duplicateError());

      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 1})).rejects.toThrow(new ConflictException('Entry already exists on timeline'));
    });

    it('passes other database errors on', async () => {
      const {service, db} = createService();
      const failure = new Error('down');

      allowed(db);
      db.query.mockRejectedValueOnce(failure);

      await expect(service.create('w1', 'u1', {entryId: 'e1', startYear: 1})).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    it('returns not found for an entry that is not on the timeline', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', 'k1', {startYear: 5})).rejects.toThrow(new NotFoundException('Timeline entry not found'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('replaces the whole date', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [row({startYear: 100, endYear: 200})]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [row({startYear: 300, startMonth: 2, endYear: 400})]});

      await service.update('w1', 'k1', {startYear: 300, startMonth: 2, endYear: 400});

      expect(db.query.mock.calls[1][1]).toEqual(['k1', 'w1', 300, 2, null, null, null, 400, null, null, null, null]);
    });

    it('clears the end when no end is sent', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [row({startYear: 100, endYear: 200})]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [row()]});

      await service.update('w1', 'k1', {startYear: 100, endYear: null});

      expect(db.query.mock.calls[1][1]).toEqual(['k1', 'w1', 100, null, null, null, null, null, null, null, null, null]);
    });

    it('rejects invalid dates without updating', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [row()]});

      await expect(service.update('w1', 'k1', {startYear: 300, endYear: 200})).rejects.toThrow(new BadRequestException('End can not be before start'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('setColor', () => {
    it('returns not found for an entry that is not on the timeline', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.setColor('w1', 'k1', {color: '#aa0000'})).rejects.toThrow(new NotFoundException('Timeline entry not found'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('saves the color', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'k1'}]})
        .mockResolvedValueOnce({rows: [row({color: '#aa0000'})]});

      const item = await service.setColor('w1', 'k1', {color: '#aa0000'});

      expect(db.query.mock.calls[0][1]).toEqual(['k1', 'w1', '#aa0000']);
      expect(item.color).toBe('#aa0000');
    });

    it('clears the color when none is sent', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'k1'}]})
        .mockResolvedValueOnce({rows: [row()]});

      await service.setColor('w1', 'k1', {});

      expect(db.query.mock.calls[0][1]).toEqual(['k1', 'w1', null]);
    });
  });

  describe('remove', () => {
    it('removes the entry from the timeline', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'k1'}]});

      expect(await service.remove('w1', 'k1')).toEqual({deleted: true});
      expect(db.query.mock.calls[0][1]).toEqual(['k1', 'w1']);
    });

    it('returns not found for an entry that is not on the timeline', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 'k1')).rejects.toThrow(new NotFoundException('Timeline entry not found'));
    });
  });
});
