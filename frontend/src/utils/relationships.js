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
