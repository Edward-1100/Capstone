export const CATEGORIES = [
  {key: 'entryTypes', label: 'Entry types'},
  {key: 'relationshipTypes', label: 'Relationship types'},
  {key: 'tags', label: 'Tags'},
  {key: 'entries', label: 'Entries'},
  {key: 'relationships', label: 'Relationships'},
  {key: 'maps', label: 'Maps'},
];

const NEED_KEYS = ['entryTypes', 'relationshipTypes', 'entries', 'tags'];

export function emptySelection() {
  return {entryTypes: [], relationshipTypes: [], tags: [], entries: [], relationships: [], maps: []};
}

export function selectAll(manifest) {
  const selection = emptySelection();

  for (const category of CATEGORIES) {
    selection[category.key] = manifest[category.key].map((item) => item.ref);
  }

  return selection;
}

export function countSelected(selection) {
  return CATEGORIES.reduce((total, category) => total + selection[category.key].length, 0);
}

function toSets(selection) {
  const sets = {};

  for (const category of CATEGORIES) {
    sets[category.key] = new Set(selection[category.key]);
  }

  return sets;
}

function fromSets(sets) {
  const selection = emptySelection();

  for (const category of CATEGORIES) {
    selection[category.key] = Array.from(sets[category.key]);
  }

  return selection;
}

export function addItems(manifest, selection, categoryKey, refs) {
  const chosen = toSets(selection);
  const known = {};

  for (const category of CATEGORIES) {
    known[category.key] = new Set(manifest[category.key].map((item) => item.ref));
  }

  for (const ref of refs) {
    chosen[categoryKey].add(ref);
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const category of CATEGORIES) {
      for (const item of manifest[category.key]) {
        if (!chosen[category.key].has(item.ref)) {
          continue;
        }

        for (const key of NEED_KEYS) {
          for (const ref of item.needs[key]) {
            if (known[key].has(ref) && !chosen[key].has(ref)) {
              chosen[key].add(ref);
              changed = true;
            }
          }
        }
      }
    }
  }

  return fromSets(chosen);
}

export function removeItems(manifest, selection, categoryKey, refs) {
  const chosen = toSets(selection);

  for (const ref of refs) {
    chosen[categoryKey].delete(ref);
  }

  let changed = true;

  while (changed) {
    changed = false;

    for (const category of CATEGORIES) {
      for (const item of manifest[category.key]) {
        if (!chosen[category.key].has(item.ref)) {
          continue;
        }

        const missing = NEED_KEYS.some((key) => item.needs[key].some((ref) => manifest[key].some((other) => other.ref === ref) && !chosen[key].has(ref)));

        if (missing) {
          chosen[category.key].delete(item.ref);
          changed = true;
        }
      }
    }
  }

  return fromSets(chosen);
}

export function stripImages(copy) {
  for (const entry of copy.entries || []) {
    for (const image of entry.images || []) {
      image.data = null;
    }
  }

  for (const map of copy.maps || []) {
    if (map.image) {
      map.image.data = null;
    }
  }

  if (copy.world && copy.world.thumbnail) {
    copy.world.thumbnail.data = null;
  }

  return copy;
}

export function summarize(counts) {
  const labels = {entryTypes: 'entry types', relationshipTypes: 'relationship types', tags: 'tags', entries: 'entries', relationships: 'relationships', maps: 'maps', comments: 'comments', notes: 'notes'};

  return Object.keys(labels).filter((key) => counts[key] > 0).map((key) => `${counts[key]} ${labels[key]}`).join(', ');
}
