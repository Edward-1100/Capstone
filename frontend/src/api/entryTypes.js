import { apiFetch } from './client';

export function listEntryTypesRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/entry-types`);
}

export function createEntryTypeRequest(worldId, name) {
  return apiFetch(`/worlds/${worldId}/entry-types`, {method: 'POST', body: JSON.stringify({name})});
}

export function updateEntryTypeRequest(worldId, typeId, name) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}`, {method: 'PATCH', body: JSON.stringify({name})});
}

export function deleteEntryTypeRequest(worldId, typeId, confirmName, moveToTypeId) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}`, {method: 'DELETE', body: JSON.stringify({confirmName, moveToTypeId})});
}

export function createFieldRequest(worldId, typeId, data) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}/fields`, {method: 'POST', body: JSON.stringify(data)});
}

export function updateFieldRequest(worldId, typeId, fieldId, data) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}/fields/${fieldId}`, {method: 'PATCH', body: JSON.stringify(data)});
}

export function deleteFieldRequest(worldId, typeId, fieldId, confirmName) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}/fields/${fieldId}`, {method: 'DELETE', body: JSON.stringify({confirmName})});
}
