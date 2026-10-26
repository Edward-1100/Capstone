import { apiFetch } from './client';

export function listEntryTypesRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/entry-types`);
}

export function createEntryTypeRequest(worldId, name, kind) {
  return apiFetch(`/worlds/${worldId}/entry-types`, {method: 'POST', body: JSON.stringify({name, kind: kind || null})});
}

export function updateEntryTypeRequest(worldId, typeId, name, kind) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}`, {method: 'PATCH', body: JSON.stringify({name, kind: kind || null})});
}

export function deleteEntryTypeRequest(worldId, typeId, confirmName, moveToTypeId) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}`, {method: 'DELETE', body: JSON.stringify({confirmName, moveToTypeId})});
}
