export const MIN_YEAR = -1000000;
export const MAX_YEAR = 1000000;
export const AXIS_HEIGHT = 28;
export const ROW_HEIGHT = 44;
export const PADDING = 40;
export const MAX_PIXELS_PER_MINUTE = 400;

const LABEL_MAX = 220;
const TICK_GAP = 90;
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_MONTH = 43830;
const MINUTES_PER_YEAR = 525949;
const FIXED_STEPS = [1, 5, 15, 30, 60, 180, 360, 720, 1440];
const MONTH_STEPS = [1, 3, 6];

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const DATE_PARTS = [
  {name: 'Year', min: MIN_YEAR, max: MAX_YEAR},
  {name: 'Month', min: 1, max: 12},
  {name: 'Day', min: 1, max: 31},
  {name: 'Hour', min: 0, max: 23},
  {name: 'Minute', min: 0, max: 59},
];

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function daysFromCivil(year, month, day) {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month > 2 ? month - 3 : month + 9) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;

  return era * 146097 + dayOfEra - 719468;
}

function civilFromDays(days) {
  const shifted = days + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPart = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPart + 2) / 5) + 1;
  const month = monthPart < 10 ? monthPart + 3 : monthPart - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);

  return {year, month, day};
}

export function positionMinutes(year, month, day, hour, minute) {
  return (daysFromCivil(year, month, day) * 24 + hour) * 60 + minute;
}

export function startPosition(item) {
  return positionMinutes(item.startYear, item.startMonth === null ? 1 : item.startMonth, item.startDay === null ? 1 : item.startDay, item.startHour === null ? 0 : item.startHour, item.startMinute === null ? 0 : item.startMinute);
}

export function endPosition(item) {
  if (item.endYear === null) {
    return startPosition(item);
  }

  const month = item.endMonth === null ? 12 : item.endMonth;
  const day = item.endDay === null ? daysInMonth(item.endYear, month) : item.endDay;

  return positionMinutes(item.endYear, month, day, item.endHour === null ? 23 : item.endHour, item.endMinute === null ? 59 : item.endMinute);
}

export function formatDate(year, month, day, hour, minute) {
  let text = String(year);

  if (month !== null) {
    text = `${text}/${pad(month)}`;
  }

  if (day !== null) {
    text = `${text}/${pad(day)}`;
  }

  if (hour !== null) {
    text = `${text} ${pad(hour)}:${minute === null ? '00' : pad(minute)}`;
  }

  return text;
}

export function formatStart(item) {
  return formatDate(item.startYear, item.startMonth, item.startDay, item.startHour, item.startMinute);
}

export function formatEnd(item) {
  if (item.endYear === null) {
    return null;
  }

  return formatDate(item.endYear, item.endMonth, item.endDay, item.endHour, item.endMinute);
}

export function formatSpan(item) {
  const start = formatStart(item);
  const end = formatEnd(item);

  if (end === null || end === start) {
    return start;
  }

  return `${start} to ${end}`;
}

export function emptyDateValues() {
  const values = {};

  for (const prefix of ['start', 'end']) {
    for (const part of DATE_PARTS) {
      values[prefix + part.name] = '';
    }
  }

  return values;
}

export function dateValuesOf(item) {
  const values = {};

  for (const prefix of ['start', 'end']) {
    for (const part of DATE_PARTS) {
      const value = item[prefix + part.name];

      values[prefix + part.name] = value === null || value === undefined ? '' : String(value);
    }
  }

  return values;
}

export function datePayload(values) {
  const payload = {};

  for (const prefix of ['start', 'end']) {
    let open = true;

    for (const part of DATE_PARTS) {
      const text = values[prefix + part.name].trim();

      open = open && text !== '';
      payload[prefix + part.name] = open ? Number(text) : null;
    }
  }

  return payload;
}

export function fitView(items, width) {
  if (items.length === 0) {
    return {start: 0, ppm: 1, min: 0, max: 0};
  }

  let min = startPosition(items[0]);
  let max = endPosition(items[0]);

  for (const item of items) {
    min = Math.min(min, startPosition(item));
    max = Math.max(max, endPosition(item));
  }

  const span = Math.max(max - min, 1);
  const ppm = Math.min(Math.max((width - PADDING * 2 - LABEL_MAX) / span, 0.00000000001), MAX_PIXELS_PER_MINUTE);

  return {start: min - PADDING / ppm, ppm, min, max};
}

export function clampStart(start, ppm, fit, width) {
  const lowest = fit.min - (width - PADDING) / ppm;
  const highest = fit.max - PADDING / ppm;

  return Math.min(Math.max(start, lowest), highest);
}

function tickLabel(at, step) {
  const days = Math.floor(at / MINUTES_PER_DAY);
  const rest = at - days * MINUTES_PER_DAY;
  const date = civilFromDays(days);

  if (step >= MINUTES_PER_DAY || rest === 0) {
    return `${date.year}/${pad(date.month)}/${pad(date.day)}`;
  }

  return `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}`;
}

export function tickMarks(from, to, pixelsPerMinute) {
  const marks = [];
  const fixed = FIXED_STEPS.find((step) => step * pixelsPerMinute >= TICK_GAP);

  if (fixed !== undefined) {
    for (let at = Math.ceil(from / fixed) * fixed; at <= to; at += fixed) {
      marks.push({at, label: tickLabel(at, fixed)});
    }

    return marks;
  }

  const monthStep = MONTH_STEPS.find((step) => step * MINUTES_PER_MONTH * pixelsPerMinute >= TICK_GAP);

  if (monthStep !== undefined) {
    const first = civilFromDays(Math.floor(from / MINUTES_PER_DAY));

    for (let index = Math.floor((first.year * 12 + first.month - 1) / monthStep) * monthStep; ; index += monthStep) {
      const year = Math.floor(index / 12);
      const month = index - year * 12 + 1;
      const at = positionMinutes(year, month, 1, 0, 0);

      if (at > to) {
        break;
      }

      if (at >= from) {
        marks.push({at, label: month === 1 ? String(year) : `${year}/${pad(month)}`});
      }
    }

    return marks;
  }

  const raw = TICK_GAP / (pixelsPerMinute * MINUTES_PER_YEAR);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const multiple = [1, 2, 5, 10].find((value) => value * power >= raw);
  const step = Math.max(1, multiple * power);
  const firstYear = civilFromDays(Math.floor(from / MINUTES_PER_DAY)).year;

  for (let year = Math.floor(firstYear / step) * step; ; year += step) {
    const at = positionMinutes(year, 1, 1, 0, 0);

    if (at > to) {
      break;
    }

    if (at >= from) {
      marks.push({at, label: String(year)});
    }
  }

  return marks;
}

export function layoutItems(items, view) {
  const laneEnds = [];
  const placed = [];

  for (const item of items) {
    const startAt = startPosition(item);
    const left = (startAt - view.start) * view.ppm;
    const barWidth = (endPosition(item) - startAt) * view.ppm;
    const labelWidth = Math.min(item.entryName.length * 8 + 16, LABEL_MAX);
    const width = Math.max(barWidth, labelWidth);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= left);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }

    laneEnds[lane] = left + width + 8;
    placed.push({item, left, barWidth, labelWidth, lane});
  }

  return {placed, lanes: laneEnds.length};
}

export function clipPlace(place, viewWidth) {
  const reach = Math.max(place.barWidth, place.labelWidth);

  if (place.left > viewWidth || place.left + reach < 0) {
    return null;
  }

  const left = Math.max(place.left, 0);
  const barWidth = Math.max(Math.min(place.left + place.barWidth, viewWidth) - left, 0);

  return {left, barWidth, width: Math.max(barWidth, place.labelWidth)};
}
