import { apiFetch } from './client';

export function listEntriesRequest(worldId, typeId) {
  const query = typeId ? `?typeId=${encodeURIComponent(typeId)}` : '';

  return apiFetch(`/worlds/${worldId}/entries${query}`);
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
