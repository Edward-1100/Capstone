const SCALAR_KEYS = ['name', 'description', 'typeId', 'parentId'];

const LABELS = {name: 'Name', description: 'Description', typeId: 'Type', parentId: 'Inside'};

function normalize(value) {
  if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return null;
  }

  return value;
}

function same(first, second) {
  return JSON.stringify(normalize(first)) === JSON.stringify(normalize(second));
}

function findDefinition(current, fieldId) {
  return current.typeFields.find((definition) => definition.id === fieldId) || null;
}

export function findConflicts(base, current, changes) {
  const merged = Object.assign({}, changes);
  const conflicts = [];

  for (const key of SCALAR_KEYS) {
    if (!(key in changes)) {
      continue;
    }

    if (same(changes[key], current[key]) || same(changes[key], base[key])) {
      delete merged[key];
    } else if (!same(current[key], base[key])) {
      conflicts.push({id: key, key, fieldId: null, label: LABELS[key], theirs: current[key], mine: changes[key]});
    }
  }

  if (changes.fields) {
    const fields = {};

    for (const fieldId of Object.keys(changes.fields)) {
      const mine = changes.fields[fieldId];
      const definition = findDefinition(current, fieldId);

      if (!definition || same(mine, current.fields[fieldId]) || same(mine, base.fields[fieldId])) {
        continue;
      }

      fields[fieldId] = mine;

      if (!same(current.fields[fieldId], base.fields[fieldId])) {
        conflicts.push({id: `fields:${fieldId}`, key: 'fields', fieldId, label: definition.name, theirs: current.fields[fieldId], mine});
      }
    }

    if (Object.keys(fields).length > 0) {
      merged.fields = fields;
    } else {
      delete merged.fields;
    }
  }

  return {merged, conflicts};
}

export function hasChanges(changes) {
  return SCALAR_KEYS.some((key) => key in changes) || Boolean(changes.fields);
}

export function applyChoices(current, merged, conflicts, choices) {
  const result = Object.assign({}, merged);

  if (result.fields) {
    result.fields = Object.assign({}, result.fields);
  }

  for (const conflict of conflicts) {
    if (choices[conflict.id] !== 'mine') {
      if (conflict.fieldId) {
        delete result.fields[conflict.fieldId];
      } else {
        delete result[conflict.key];
      }
    }
  }

  if (result.fields && Object.keys(result.fields).length === 0) {
    delete result.fields;
  }

  return result;
}
