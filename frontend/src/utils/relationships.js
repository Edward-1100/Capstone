export function allows(any, ids, typeId) {
  return any || (Boolean(typeId) && ids.includes(typeId));
}

export function describeSide(any, ids, entryTypes) {
  if (any) {
    return 'any entry type';
  }

  const names = entryTypes.filter((type) => ids.includes(type.id)).map((type) => type.name);

  return names.length === 0 ? 'no entry types' : names.join(', ');
}

export function summarizeSide(any, ids, entryTypes) {
  if (any) {
    return 'Any type';
  }

  const names = entryTypes.filter((type) => ids.includes(type.id)).map((type) => type.name);

  if (names.length === 0) {
    return 'No types';
  }

  return names.length <= 2 ? names.join(', ') : `${names.length} types`;
}

export function sideText(any, ids, entryTypes, full = false) {
  if (any) {
    return 'Any type';
  }

  const names = entryTypes.filter((type) => ids.includes(type.id)).map((type) => type.name);

  if (names.length === 0) {
    return 'No types';
  }

  if (full) {
    return names.join(', ');
  }

  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}
