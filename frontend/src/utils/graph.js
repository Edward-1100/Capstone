export const PALETTE = ['#6ea8fe', '#f5a05b', '#7fd18b', '#e57aa6', '#b69cf5', '#e9d36a', '#5fcfd1', '#e5806f', '#a3c46a', '#c59a7a'];
export const NO_VALUE_COLOR = '#8a8a8a';

export function defaultSettings() {
  return {
    groupTypes: true,
    groupTags: false,
    groupRelationships: false,
    groupFields: [],
    strength: 0.5,
    colorBy: 'type',
    hiddenTypes: [],
    hiddenRelationships: [],
    onlyTags: [],
    hideUnconnected: false,
    labels: true,
    groupLabels: true,
    panel: true,
  };
}

function ids(list) {
  return new Set((list || []).map((item) => item.id));
}

function keepKnown(value, known) {
  return Array.isArray(value) ? value.filter((item) => known.has(item)) : [];
}

export function sanitizeSettings(raw, data) {
  const base = defaultSettings();
  const input = raw && typeof raw === 'object' ? raw : {};
  const result = Object.assign({}, base);

  for (const key of ['groupTypes', 'groupTags', 'groupRelationships', 'hideUnconnected', 'labels', 'groupLabels', 'panel']) {
    if (typeof input[key] === 'boolean') {
      result[key] = input[key];
    }
  }

  if (typeof input.strength === 'number' && input.strength >= 0 && input.strength <= 1) {
    result.strength = input.strength;
  }

  result.groupFields = keepKnown(input.groupFields, ids(data.fields));
  result.hiddenTypes = keepKnown(input.hiddenTypes, ids(data.types));
  result.hiddenRelationships = keepKnown(input.hiddenRelationships, ids(data.relationshipTypes));
  result.onlyTags = keepKnown(input.onlyTags, ids(data.tags));

  const colorOk = input.colorBy === 'type' || input.colorBy === 'tag' || input.colorBy === 'none' ||
    (typeof input.colorBy === 'string' && input.colorBy.startsWith('field:') && ids(data.fields).has(input.colorBy.slice(6)));

  result.colorBy = colorOk ? input.colorBy : base.colorBy;

  return result;
}

export function visibleGraph(data, settings) {
  const hiddenTypes = new Set(settings.hiddenTypes);
  const hiddenRels = new Set(settings.hiddenRelationships);
  const onlyTags = new Set(settings.onlyTags);

  let nodes = data.nodes.filter((node) => {
    if (hiddenTypes.has(node.typeId || 'none')) {
      return false;
    }

    return onlyTags.size === 0 || node.tagIds.some((tagId) => onlyTags.has(tagId));
  });

  const present = new Set(nodes.map((node) => node.id));
  const edges = data.edges.filter((edge) => !hiddenRels.has(edge.typeId) && present.has(edge.from) && present.has(edge.to));

  if (settings.hideUnconnected) {
    const linked = new Set();

    for (const edge of edges) {
      linked.add(edge.from);
      linked.add(edge.to);
    }

    nodes = nodes.filter((node) => linked.has(node.id));
  }

  return {nodes, edges};
}

function numberBuckets(data, field) {
  const values = data.nodes.map((node) => node.values[field.id]).filter((value) => typeof value === 'number');

  if (values.length === 0) {
    return null;
  }

  const min = values.reduce((low, value) => Math.min(low, value));
  const max = values.reduce((high, value) => Math.max(high, value));

  return {min, max};
}

export function fieldValueKeys(field, value, bounds) {
  if (value === null || value === undefined) {
    return [];
  }

  const options = (field.config && field.config.options) || [];
  const label = (id) => (options.find((option) => option.id === id) || {}).label;

  if (field.fieldType === 'boolean') {
    const config = field.config || {};

    return [value ? config.trueLabel || 'Yes' : config.falseLabel || 'No'];
  }

  if (field.fieldType === 'scale') {
    const named = field.config && field.config.labels && field.config.labels[String(value)];

    return [named ? `${named} (${value})` : String(value)];
  }

  if (field.fieldType === 'choice') {
    return label(value) ? [label(value)] : [];
  }

  if (field.fieldType === 'multi_choice') {
    return (Array.isArray(value) ? value : []).map(label).filter(Boolean);
  }

  if (field.fieldType === 'number' && typeof value === 'number' && bounds) {
    if (bounds.max === bounds.min) {
      return [String(value)];
    }

    const step = (bounds.max - bounds.min) / 5;
    const index = Math.min(4, Math.floor((value - bounds.min) / step));
    const from = bounds.min + step * index;
    const to = from + step;
    const fmt = (n) => String(Math.round(n * 100) / 100);

    return [`${fmt(from)} to ${fmt(to)}`];
  }

  return [];
}

export function buildGroups(data, settings, nodes, edges) {
  const groups = new Map();
  const add = (key, label, nodeId) => {
    if (!groups.has(key)) {
      groups.set(key, {key, label, members: []});
    }

    groups.get(key).members.push(nodeId);
  };

  const typeName = new Map(data.types.map((type) => [type.id, type.name]));
  const tagName = new Map(data.tags.map((tag) => [tag.id, tag.name]));
  const relName = new Map(data.relationshipTypes.map((type) => [type.id, type.name]));
  const wantedTags = new Set(settings.onlyTags);

  if (settings.groupTypes) {
    for (const node of nodes) {
      if (node.typeId) {
        add(`type:${node.typeId}`, typeName.get(node.typeId), node.id);
      }
    }
  }

  if (settings.groupTags) {
    for (const node of nodes) {
      for (const tagId of node.tagIds) {
        if (wantedTags.size === 0 || wantedTags.has(tagId)) {
          add(`tag:${tagId}`, tagName.get(tagId), node.id);
        }
      }
    }
  }

  if (settings.groupRelationships) {
    const seen = new Set();

    for (const edge of edges) {
      for (const nodeId of [edge.from, edge.to]) {
        const mark = `${edge.typeId}:${nodeId}`;

        if (!seen.has(mark)) {
          seen.add(mark);
          add(`rel:${edge.typeId}`, relName.get(edge.typeId), nodeId);
        }
      }
    }
  }

  for (const fieldId of settings.groupFields) {
    const field = data.fields.find((item) => item.id === fieldId);

    if (!field) {
      continue;
    }

    const bounds = field.fieldType === 'number' ? numberBuckets(data, field) : null;

    for (const node of nodes) {
      for (const key of fieldValueKeys(field, node.values[fieldId], bounds)) {
        add(`field:${fieldId}:${key}`, `${field.name}: ${key}`, node.id);
      }
    }
  }

  return Array.from(groups.values()).filter((group) => group.members.length >= 2);
}

export function placeLabel(placed, x, y, width, height) {
  const left = x - width / 2;

  for (const step of [0, 1, -1, 2, -2, 3, -3]) {
    const shift = step * height * 1.2;
    const top = y + shift - height;
    const clash = placed.some((box) => left < box.left + box.width && left + width > box.left && top < box.top + box.height && top + height > box.top);

    if (!clash) {
      return {x, y: y + shift, left, top, width, height};
    }
  }

  return null;
}

export function colorMap(data, settings) {
  const mode = settings.colorBy;
  const map = {};

  if (mode === 'type') {
    data.types.forEach((type, index) => {
      map[type.id] = PALETTE[index % PALETTE.length];
    });
  }

  if (mode === 'tag') {
    data.tags.forEach((tag, index) => {
      map[tag.id] = tag.color || PALETTE[index % PALETTE.length];
    });
  }

  return map;
}

export function nodeColor(data, settings, map, node) {
  const mode = settings.colorBy;

  if (mode === 'type') {
    return map[node.typeId] || NO_VALUE_COLOR;
  }

  if (mode === 'tag') {
    const tagId = node.tagIds.find((id) => map[id]);

    return tagId ? map[tagId] : NO_VALUE_COLOR;
  }

  if (mode.startsWith('field:')) {
    const field = data.fields.find((item) => item.id === mode.slice(6));

    if (!field) {
      return NO_VALUE_COLOR;
    }

    const bounds = field.fieldType === 'number' ? numberBuckets(data, field) : null;
    const keys = fieldValueKeys(field, node.values[field.id], bounds);

    if (keys.length === 0) {
      return NO_VALUE_COLOR;
    }

    return PALETTE[hash(keys[0]) % PALETTE.length];
  }

  return PALETTE[0];
}

function hash(text) {
  let value = 0;

  for (let i = 0; i < text.length; i += 1) {
    value = (value * 31 + text.charCodeAt(i)) >>> 0;
  }

  return value;
}

export function createLayout(nodes, edges, groups, previous) {
  const index = new Map();
  const placed = nodes.map((node, i) => {
    const old = previous && previous.get(node.id);
    const angle = i * 2.399963;
    const radius = 18 * Math.sqrt(i + 1);
    const item = {
      id: node.id,
      x: old ? old.x : Math.cos(angle) * radius,
      y: old ? old.y : Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      degree: 0,
      fixed: false,
    };

    index.set(node.id, item);

    return item;
  });

  const links = [];

  for (const edge of edges) {
    const a = index.get(edge.from);
    const b = index.get(edge.to);

    if (a && b) {
      a.degree += 1;
      b.degree += 1;
      links.push({a, b, id: edge.id, typeId: edge.typeId});
    }
  }

  for (const item of placed) {
    item.r = 4 + Math.min(8, Math.sqrt(item.degree) * 1.8);
  }

  const memberships = new Map();
  const sets = groups.map((group) => {
    const members = group.members.map((id) => index.get(id)).filter(Boolean);

    for (const member of members) {
      memberships.set(member.id, (memberships.get(member.id) || 0) + 1);
    }

    return {key: group.key, label: group.label, members, cx: 0, cy: 0};
  });

  return {nodes: placed, links, groups: sets, memberships, index};
}

const CELL = 90;
const MAX_SEPARATED = 60;

export function stepLayout(layout, alpha, strength) {
  const {nodes, links, groups, memberships} = layout;
  const grid = new Map();

  for (const node of nodes) {
    const key = `${Math.floor(node.x / CELL)},${Math.floor(node.y / CELL)}`;

    if (!grid.has(key)) {
      grid.set(key, []);
    }

    grid.get(key).push(node);
  }

  for (const node of nodes) {
    const cx = Math.floor(node.x / CELL);
    const cy = Math.floor(node.y / CELL);

    for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
      for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
        for (const other of grid.get(`${gx},${gy}`) || []) {
          if (other === node) {
            continue;
          }

          let dx = node.x - other.x;
          let dy = node.y - other.y;
          let d2 = dx * dx + dy * dy;

          if (d2 === 0) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = dx * dx + dy * dy;
          }

          if (d2 < CELL * CELL) {
            const push = (260 * alpha) / d2;

            node.vx += dx * push;
            node.vy += dy * push;
          }
        }
      }
    }
  }

  for (const link of links) {
    const dx = link.b.x - link.a.x;
    const dy = link.b.y - link.a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const pull = ((d - 55) / d) * 0.06 * alpha;

    link.a.vx += dx * pull;
    link.a.vy += dy * pull;
    link.b.vx -= dx * pull;
    link.b.vy -= dy * pull;
  }

  for (const group of groups) {
    let sx = 0;
    let sy = 0;

    for (const member of group.members) {
      sx += member.x;
      sy += member.y;
    }

    group.cx = sx / group.members.length;
    group.cy = sy / group.members.length;

    for (const member of group.members) {
      const share = 1 / memberships.get(member.id);

      member.vx += (group.cx - member.x) * strength * 0.12 * share * alpha;
      member.vy += (group.cy - member.y) * strength * 0.12 * share * alpha;
    }
  }

  const big = groups.length > MAX_SEPARATED ? groups.slice().sort((a, b) => b.members.length - a.members.length).slice(0, MAX_SEPARATED) : groups;

  for (let i = 0; i < big.length; i += 1) {
    for (let j = i + 1; j < big.length; j += 1) {
      const dx = big[j].cx - big[i].cx;
      const dy = big[j].cy - big[i].cy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const push = (strength * 4 * alpha * 200) / (d + 60);

      for (const member of big[i].members) {
        member.vx -= (dx / d) * push / Math.sqrt(big[i].members.length);
        member.vy -= (dy / d) * push / Math.sqrt(big[i].members.length);
      }

      for (const member of big[j].members) {
        member.vx += (dx / d) * push / Math.sqrt(big[j].members.length);
        member.vy += (dy / d) * push / Math.sqrt(big[j].members.length);
      }
    }
  }

  const anchored = nodes.some((node) => node.fixed);
  let driftX = 0;
  let driftY = 0;

  if (!anchored && nodes.length > 0) {
    for (const node of nodes) {
      driftX += node.vx;
      driftY += node.vy;
    }

    driftX /= nodes.length;
    driftY /= nodes.length;
  }

  for (const node of nodes) {
    if (node.fixed) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx -= driftX;
    node.vy -= driftY;
    node.vx -= node.x * 0.004 * alpha;
    node.vy -= node.y * 0.004 * alpha;
    node.vx *= 0.7;
    node.vy *= 0.7;
    node.x += node.vx;
    node.y += node.vy;
  }
}

export function loadSettings(worldId, data, narrow) {
  let raw = null;

  try {
    raw = JSON.parse(localStorage.getItem(`graph:${worldId}`));
  } catch {
    raw = null;
  }

  const result = sanitizeSettings(raw, data);

  if (!raw && narrow) {
    result.panel = false;
  }

  return result;
}

export function saveSettings(worldId, settings) {
  try {
    localStorage.setItem(`graph:${worldId}`, JSON.stringify(settings));
  } catch {
    return;
  }
}
