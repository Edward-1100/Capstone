import { apiFetch } from './client';

export function parentOptionsRequest(worldId, typeId, entryId) {
  const params = new URLSearchParams({typeId});

  if (entryId) {
    params.set('entryId', entryId);
  }

  return apiFetch(`/worlds/${worldId}/entries/parent-options?${params.toString()}`);
}

export function ancestorsRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/ancestors`);
}

export function setEntryTypeNestingRequest(worldId, typeId, data) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}/nesting`, {method: 'PUT', body: JSON.stringify(data)});
}
