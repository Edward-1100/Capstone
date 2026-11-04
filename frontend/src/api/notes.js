import { apiFetch } from './client';

export function listNotesRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/notes`);
}

export function createNoteRequest(worldId, entryId, body) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/notes`, {method: 'POST', body: JSON.stringify({body})});
}

export function updateNoteRequest(worldId, noteId, body) {
  return apiFetch(`/worlds/${worldId}/notes/${noteId}`, {method: 'PATCH', body: JSON.stringify({body})});
}

export function deleteNoteRequest(worldId, noteId) {
  return apiFetch(`/worlds/${worldId}/notes/${noteId}`, {method: 'DELETE'});
}
