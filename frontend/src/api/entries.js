import { apiFetch } from './client';

export function listEntriesRequest(worldId, filters = {}) {
  const params = new URLSearchParams();

  if (filters.typeId) {
    params.set('typeId', filters.typeId);
  }

  if (filters.tags && filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','));
  }

  if (filters.excludeTags && filters.excludeTags.length > 0) {
    params.set('excludeTags', filters.excludeTags.join(','));
  }

  if (filters.tagMode) {
    params.set('tagMode', filters.tagMode);
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
