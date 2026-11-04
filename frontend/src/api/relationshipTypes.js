import { apiFetch } from './client';

export function listRelationshipTypesRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/relationship-types`);
}

export function createRelationshipTypeRequest(worldId, data) {
  return apiFetch(`/worlds/${worldId}/relationship-types`, {method: 'POST', body: JSON.stringify(data)});
}

export function updateRelationshipTypeRequest(worldId, typeId, data) {
  return apiFetch(`/worlds/${worldId}/relationship-types/${typeId}`, {method: 'PATCH', body: JSON.stringify(data)});
}

export function deleteRelationshipTypeRequest(worldId, typeId, confirmName) {
  return apiFetch(`/worlds/${worldId}/relationship-types/${typeId}`, {method: 'DELETE', body: JSON.stringify({confirmName})});
}
