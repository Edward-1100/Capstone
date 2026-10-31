import { apiFetch } from './client';

export function listTagsRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/tags`);
}

export function createTagRequest(worldId, data) {
  return apiFetch(`/worlds/${worldId}/tags`, {method: 'POST', body: JSON.stringify(data)});
}

export function updateTagRequest(worldId, tagId, data) {
  return apiFetch(`/worlds/${worldId}/tags/${tagId}`, {method: 'PATCH', body: JSON.stringify(data)});
}

export function deleteTagRequest(worldId, tagId, confirmName) {
  return apiFetch(`/worlds/${worldId}/tags/${tagId}`, {method: 'DELETE', body: JSON.stringify({confirmName})});
}

export function listEntryTagsRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/tags`);
}

export function addEntryTagRequest(worldId, entryId, tagId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/tags/${tagId}`, {method: 'PUT'});
}

export function removeEntryTagRequest(worldId, entryId, tagId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/tags/${tagId}`, {method: 'DELETE'});
}
