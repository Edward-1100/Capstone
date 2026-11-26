export const COMPARABLE = ['number', 'scale', 'boolean', 'choice', 'multi_choice'];

export const OPS = {
  number: [['eq', 'is'], ['gte', 'is at least'], ['lte', 'is at most'], ['between', 'is between']],
  scale: [['eq', 'is'], ['gte', 'is at least'], ['lte', 'is at most'], ['between', 'is between']],
  boolean: [['is', 'is']],
  choice: [['any', 'is any of']],
  multi_choice: [['any', 'includes any of'], ['all', 'includes all of']],
};

export function fieldList(entryTypes) {
  const list = [];

  for (const type of entryTypes) {
    for (const field of type.fields || []) {
      if (COMPARABLE.includes(field.fieldType)) {
        list.push(Object.assign({}, field, {typeName: type.name, typeId: type.id}));
      }
    }
  }

  return list;
}

function nameOf(list, id, fallback) {
  const found = list.find((item) => item.id === id);

  return found ? found.name : fallback;
}

function valueText(item, field) {
  const options = (field.config && field.config.options) || [];

  if (item.op === 'any' || item.op === 'all') {
    return item.value.map((id) => (options.find((option) => option.id === id) || {label: '?'}).label).join(item.op === 'all' ? ' + ' : ' / ');
  }

  if (item.op === 'between') {
    return `${item.value[0]}-${item.value[1]}`;
  }

  if (item.op === 'is') {
    const on = item.value === true || item.value[0] === 'true' || item.value[0] === true;

    return on ? ((field.config && field.config.trueLabel) || 'true') : ((field.config && field.config.falseLabel) || 'false');
  }

  const single = Array.isArray(item.value) ? item.value[0] : item.value;

  return `${item.op === 'gte' ? '>=' : (item.op === 'lte' ? '<=' : '')}${single}`;
}

export function conditionBadge(item, entryTypes, relationshipTypes, entries) {
  let text;

  if (item.kind === 'type') {
    text = nameOf(entryTypes, item.entryTypeId, 'deleted type');
  } else if (item.kind === 'inside') {
    text = `inside ${nameOf(entries, item.insideEntryId, 'deleted entry')}`;
  } else if (item.kind === 'relationship') {
    const relation = nameOf(relationshipTypes, item.relationshipTypeId, 'deleted type');
    const other = item.otherAny ? 'any' : nameOf(entries, item.otherEntryId, 'deleted entry');

    if (item.side === 'to') {
      text = `${other}->${relation}`;
    } else if (item.side === 'from') {
      text = `${relation}->${other}`;
    } else {
      text = `${relation}<->${other}`;
    }
  } else {
    const field = fieldList(entryTypes).find((entry) => entry.id === item.fieldId);

    text = field ? `${field.name}:${valueText(item, field)}` : 'deleted field';
  }

  return item.exclude ? `not ${text}` : text;
}

export function ruleBadges(rule, entryTypes, relationshipTypes, entries) {
  if (!rule || rule.conditions.length === 0) {
    return [];
  }

  return rule.conditions.map((item) => conditionBadge(item, entryTypes, relationshipTypes, entries));
}
