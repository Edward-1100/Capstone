export interface TimelineDates {
  startYear: number;
  startMonth: number | null;
  startDay: number | null;
  startHour: number | null;
  startMinute: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  endHour: number | null;
  endMinute: number | null;
}

const LIMITS: [keyof TimelineDates, string, number, number][] = [
  ['startYear', 'Start year', -1000000, 1000000],
  ['startMonth', 'Start month', 1, 12],
  ['startDay', 'Start day', 1, 31],
  ['startHour', 'Start hour', 0, 23],
  ['startMinute', 'Start minute', 0, 59],
  ['endYear', 'End year', -1000000, 1000000],
  ['endMonth', 'End month', 1, 12],
  ['endDay', 'End day', 1, 31],
  ['endHour', 'End hour', 0, 23],
  ['endMinute', 'End minute', 0, 59],
];

export function normalizeDates(input: any): TimelineDates {
  return {
    startYear: input.startYear,
    startMonth: input.startMonth ?? null,
    startDay: input.startDay ?? null,
    startHour: input.startHour ?? null,
    startMinute: input.startMinute ?? null,
    endYear: input.endYear ?? null,
    endMonth: input.endMonth ?? null,
    endDay: input.endDay ?? null,
    endHour: input.endHour ?? null,
    endMinute: input.endMinute ?? null,
  };
}

export function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function daysFromCivil(year: number, month: number, day: number) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;

  return era * 146097 + dayOfEra - 719468;
}

export function positionMinutes(year: number, month: number, day: number, hour: number, minute: number) {
  return (daysFromCivil(year, month, day) * 24 + hour) * 60 + minute;
}

export function startPosition(dates: TimelineDates) {
  return positionMinutes(dates.startYear, dates.startMonth ?? 1, dates.startDay ?? 1, dates.startHour ?? 0, dates.startMinute ?? 0);
}

export function endPosition(dates: TimelineDates) {
  if (dates.endYear === null) {
    return null;
  }

  const month = dates.endMonth ?? 12;
  const day = dates.endDay ?? daysInMonth(dates.endYear, month);

  return positionMinutes(dates.endYear, month, day, dates.endHour ?? 23, dates.endMinute ?? 59);
}

function sideProblem(label: string, owner: string, year: number, month: number | null, day: number | null, hour: number | null, minute: number | null) {
  if (day !== null && month === null) {
    return `${label} day needs ${owner} month`;
  }

  if (hour !== null && day === null) {
    return `${label} hour needs ${owner} day`;
  }

  if (minute !== null && hour === null) {
    return `${label} minute needs ${owner} hour`;
  }

  if (month !== null && day !== null && day > daysInMonth(year, month)) {
    return `${label} day is not valid for that month`;
  }

  return null;
}

export function datesProblem(dates: TimelineDates) {
  for (const [key, label, min, max] of LIMITS) {
    const value: any = dates[key];

    if ((value === null || value === undefined) && key === 'startYear') {
      return `${label} must be a whole number between ${min} and ${max}`;
    }

    if (value !== null && value !== undefined && (!Number.isInteger(value) || value < min || value > max)) {
      return `${label} must be a whole number between ${min} and ${max}`;
    }
  }

  const start = sideProblem('Start', 'a start', dates.startYear, dates.startMonth, dates.startDay, dates.startHour, dates.startMinute);

  if (start) {
    return start;
  }

  if (dates.endYear === null) {
    if (dates.endMonth !== null || dates.endDay !== null || dates.endHour !== null || dates.endMinute !== null) {
      return 'End year is needed when other end fields are set';
    }

    return null;
  }

  const end = sideProblem('End', 'an end', dates.endYear, dates.endMonth, dates.endDay, dates.endHour, dates.endMinute);

  if (end) {
    return end;
  }

  const endAt = endPosition(dates);

  if (endAt !== null && endAt < startPosition(dates)) {
    return 'End can not be before start';
  }

  return null;
}
