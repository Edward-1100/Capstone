const MODE_LABELS = {
  none: 'Not nested',
  chosen: 'Inside specific types',
  all: 'Inside any type',
  own: 'Inside its own type',
};

export function nestSummary(type, types) {
  if (type.nestMode === 'chosen') {
    const names = types.filter((other) => type.parentTypeIds.includes(other.id)).map((other) => other.name);

    if (names.length === 0) {
      return 'Inside no type';
    }

    return `Inside ${names.join(', ')}`;
  }

  return MODE_LABELS[type.nestMode];
}
