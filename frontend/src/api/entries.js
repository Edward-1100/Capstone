import { apiFetch } from './client';

const LIST_KEYS = [['q', 'q'], ['types', 'types'], ['excludeTypes', 'excludeTypes'], ['tags', 'tags'], ['excludeTags', 'excludeTags'], ['tagMode', 'tagMode'], ['inside', 'inside'], ['excludeInside', 'excludeInside'], ['relations', 'relations'], ['excludeRelations', 'excludeRelations']];

export function listEntriesRequest(worldId, filters = {}) {
  const params = new URLSearchParams();

  for (const [key, name] of LIST_KEYS) {
    const value = filters[key];

    if (Array.isArray(value) ? value.length > 0 : Boolean(value)) {
      params.set(name, Array.isArray(value) ? value.join(',') : value);
    }
  }

  const query = params.toString();

  return apiFetch(`/worlds/${worldId}/entries${query ? `?${query}` : ''}`);
}

export function getEntryRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}`);
}

export function createEntryRequest(worldId, data) {
  return apiFetch(`/worlds/${worldId}/entries`, {method: 'POST', body: JSON.stringify(data)});
}

export function updateEntryRequest(worldId, entryId, data) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}`, {method: 'PATCH', body: JSON.stringify(data)});
}

export function deleteEntryRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}`, {method: 'DELETE'});
}

export function addEntryImageRequest(worldId, entryId, file) {
  const form = new FormData();

  form.append('file', file);

  return apiFetch(`/worlds/${worldId}/entries/${entryId}/images`, {method: 'POST', body: form});
}

export function replaceEntryImageRequest(worldId, entryId, imageId, file) {
  const form = new FormData();

  form.append('file', file);

  return apiFetch(`/worlds/${worldId}/entries/${entryId}/images/${imageId}`, {method: 'PUT', body: form});
}

export function deleteEntryImageRequest(worldId, entryId, imageId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/images/${imageId}`, {method: 'DELETE'});
}

export function getEntryEditorsRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/editing`);
}

export function startEntryEditingRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/editing`, {method: 'PUT'});
}

export function stopEntryEditingRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/editing`, {method: 'DELETE'});
}
