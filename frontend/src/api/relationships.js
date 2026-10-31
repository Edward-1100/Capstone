import { apiFetch } from './client';

export function listEntryRelationshipsRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/relationships`);
}

export function createRelationshipRequest(worldId, data) {
  return apiFetch(`/worlds/${worldId}/relationships`, {method: 'POST', body: JSON.stringify(data)});
}

export function deleteRelationshipRequest(worldId, relationshipId) {
  return apiFetch(`/worlds/${worldId}/relationships/${relationshipId}`, {method: 'DELETE'});
}
