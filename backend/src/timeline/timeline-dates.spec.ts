import { TimelineDates, daysInMonth, datesProblem, endPosition, isLeapYear, normalizeDates, positionMinutes, startPosition } from './timeline-dates';

function dates(overrides: Record<string, any> = {}) {
  return normalizeDates(Object.assign({startYear: 100}, overrides));
}

describe('timeline dates', () => {
  describe('calendar', () => {
    it('knows the leap years including century and negative years', () => {
      expect([2024, 2000, 0, -4, -400, 4].map(isLeapYear)).toEqual([true, true, true, true, true, true]);
      expect([1900, 2023, -100, 1, -1].map(isLeapYear)).toEqual([false, false, false, false, false]);
    });

    it('knows how many days each month has', () => {
      expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => daysInMonth(2023, month))).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
      expect(daysInMonth(2024, 2)).toBe(29);
    });

    it('counts minutes from 1970 the same way as real dates', () => {
      expect(positionMinutes(1970, 1, 1, 0, 0)).toBe(0);
      expect(positionMinutes(1970, 1, 2, 0, 0)).toBe(1440);
      expect(positionMinutes(1969, 12, 31, 23, 59)).toBe(-1);
      expect(positionMinutes(2024, 2, 29, 13, 45)).toBe(Date.UTC(2024, 1, 29, 13, 45) / 60000);
      expect(positionMinutes(2000, 3, 1, 0, 0)).toBe(Date.UTC(2000, 2, 1) / 60000);
      expect(positionMinutes(1600, 12, 31, 23, 59)).toBe(Date.UTC(1600, 11, 31, 23, 59) / 60000);
    });

    it('keeps years in order across zero and negative years', () => {
      expect(positionMinutes(-1, 12, 31, 23, 59) + 1).toBe(positionMinutes(0, 1, 1, 0, 0));
      expect(positionMinutes(0, 1, 1, 0, 0)).toBeLessThan(positionMinutes(1, 1, 1, 0, 0));
      expect(positionMinutes(-1000000, 1, 1, 0, 0)).toBeLessThan(positionMinutes(-999999, 1, 1, 0, 0));
    });
  });

  describe('positions', () => {
    it('starts a partial date at the beginning of the period', () => {
      expect(startPosition(dates({startMonth: 3}))).toBe(positionMinutes(100, 3, 1, 0, 0));
      expect(startPosition(dates({startMonth: 3, startDay: 14, startHour: 9}))).toBe(positionMinutes(100, 3, 14, 9, 0));
    });

    it('ends a partial date at the end of the period', () => {
      expect(endPosition(dates({endYear: 100}))).toBe(positionMinutes(100, 12, 31, 23, 59));
      expect(endPosition(dates({endYear: 100, endMonth: 2}))).toBe(positionMinutes(100, 2, 28, 23, 59));
      expect(endPosition(dates({endYear: 104, endMonth: 2}))).toBe(positionMinutes(104, 2, 29, 23, 59));
      expect(endPosition(dates({endYear: 100, endMonth: 2, endDay: 5, endHour: 7}))).toBe(positionMinutes(100, 2, 5, 7, 59));
    });

    it('has no end position without an end year', () => {
      expect(endPosition(dates())).toBeNull();
    });
  });

  describe('problems', () => {
    it('accepts a year alone and a full date and time', () => {
      expect(datesProblem(dates())).toBeNull();
      expect(datesProblem(dates({startMonth: 12, startDay: 31, startHour: 23, startMinute: 59, endYear: 101, endMonth: 1, endDay: 1, endHour: 0, endMinute: 0}))).toBeNull();
    });

    it('accepts the first and last year allowed', () => {
      expect(datesProblem(dates({startYear: -1000000, endYear: 1000000}))).toBeNull();
    });

    it('accepts an end that falls in the same year, month or day as the start', () => {
      expect(datesProblem(dates({endYear: 100}))).toBeNull();
      expect(datesProblem(dates({startMonth: 3, endYear: 100, endMonth: 3}))).toBeNull();
      expect(datesProblem(dates({startMonth: 3, startDay: 4, endYear: 100, endMonth: 3, endDay: 4}))).toBeNull();
    });

    it('rejects values out of range or not whole numbers', () => {
      expect(datesProblem(dates({startYear: 1000001}))).toBe('Start year must be a whole number between -1000000 and 1000000');
      expect(datesProblem(dates({startYear: 1.5}))).toBe('Start year must be a whole number between -1000000 and 1000000');
      expect(datesProblem(dates({startYear: null}))).toBe('Start year must be a whole number between -1000000 and 1000000');
      expect(datesProblem(dates({startMonth: 13}))).toBe('Start month must be a whole number between 1 and 12');
      expect(datesProblem(dates({startMonth: 1, startDay: 32}))).toBe('Start day must be a whole number between 1 and 31');
      expect(datesProblem(dates({startMonth: 1, startDay: 1, startHour: 24}))).toBe('Start hour must be a whole number between 0 and 23');
      expect(datesProblem(dates({startMonth: 1, startDay: 1, startHour: 1, startMinute: 60}))).toBe('Start minute must be a whole number between 0 and 59');
      expect(datesProblem(dates({endYear: -1000001}))).toBe('End year must be a whole number between -1000000 and 1000000');
      expect(datesProblem(dates({endYear: 101, endMonth: 0}))).toBe('End month must be a whole number between 1 and 12');
      expect(datesProblem(dates({startMonth: 'x'}))).toBe('Start month must be a whole number between 1 and 12');
    });

    it('needs each smaller part to follow the larger one', () => {
      expect(datesProblem(dates({startDay: 3}))).toBe('Start day needs a start month');
      expect(datesProblem(dates({startMonth: 1, startHour: 3}))).toBe('Start hour needs a start day');
      expect(datesProblem(dates({startMonth: 1, startDay: 1, startMinute: 3}))).toBe('Start minute needs a start hour');
      expect(datesProblem(dates({endYear: 101, endDay: 3}))).toBe('End day needs an end month');
      expect(datesProblem(dates({endYear: 101, endMonth: 1, endHour: 3}))).toBe('End hour needs an end day');
    });

    it('rejects a day that the month does not have', () => {
      expect(datesProblem(dates({startYear: 2023, startMonth: 2, startDay: 29}))).toBe('Start day is not valid for that month');
      expect(datesProblem(dates({startYear: 2024, startMonth: 2, startDay: 29}))).toBeNull();
      expect(datesProblem(dates({startYear: 1900, startMonth: 2, startDay: 29}))).toBe('Start day is not valid for that month');
      expect(datesProblem(dates({startMonth: 4, startDay: 31}))).toBe('Start day is not valid for that month');
      expect(datesProblem(dates({endYear: 101, endMonth: 6, endDay: 31}))).toBe('End day is not valid for that month');
    });

    it('rejects end fields without an end year', () => {
      expect(datesProblem(dates({endMonth: 3}))).toBe('End year is needed when other end fields are set');
      expect(datesProblem(dates({endMinute: 3}))).toBe('End year is needed when other end fields are set');
    });

    it('rejects an end before the start', () => {
      expect(datesProblem(dates({endYear: 99}))).toBe('End can not be before start');
      expect(datesProblem(dates({startMonth: 5, endYear: 100, endMonth: 4}))).toBe('End can not be before start');
      expect(datesProblem(dates({startMonth: 5, startDay: 10, startHour: 8, startMinute: 30, endYear: 100, endMonth: 5, endDay: 10, endHour: 8, endMinute: 29}))).toBe('End can not be before start');
    });

    it('accepts an end exactly at the start', () => {
      expect(datesProblem(dates({startMonth: 5, startDay: 10, startHour: 8, startMinute: 30, endYear: 100, endMonth: 5, endDay: 10, endHour: 8, endMinute: 30}))).toBeNull();
    });

    it('uses the same shape for every field', () => {
      const value: TimelineDates = dates();

      expect(Object.keys(value)).toEqual(['startYear', 'startMonth', 'startDay', 'startHour', 'startMinute', 'endYear', 'endMonth', 'endDay', 'endHour', 'endMinute']);
    });
  });
});
