import { apiFetch } from './client';

export function listCommentsRequest(worldId, entryId) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/comments`);
}

export function createCommentRequest(worldId, entryId, body) {
  return apiFetch(`/worlds/${worldId}/entries/${entryId}/comments`, {method: 'POST', body: JSON.stringify({body})});
}

export function updateCommentRequest(worldId, commentId, body) {
  return apiFetch(`/worlds/${worldId}/comments/${commentId}`, {method: 'PATCH', body: JSON.stringify({body})});
}

export function deleteCommentRequest(worldId, commentId) {
  return apiFetch(`/worlds/${worldId}/comments/${commentId}`, {method: 'DELETE'});
}
