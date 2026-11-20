import { apiFetch } from './client';

function json(method, body) {
  return {method, body: JSON.stringify(body)};
}

export function getDashboardSettingsRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/dashboard/settings`);
}

export function saveDashboardSettingsRequest(worldId, settings, announcement) {
  return apiFetch(`/worlds/${worldId}/dashboard/settings`, json('PUT', {settings, announcement}));
}

export function addFeaturedRequest(worldId, data) {
  return apiFetch(`/worlds/${worldId}/dashboard/featured`, json('POST', data));
}

export function changeFeaturedRequest(worldId, itemId, data) {
  return apiFetch(`/worlds/${worldId}/dashboard/featured/${itemId}`, json('PATCH', data));
}

export function removeFeaturedRequest(worldId, itemId) {
  return apiFetch(`/worlds/${worldId}/dashboard/featured/${itemId}`, {method: 'DELETE'});
}

export function addPinnedRequest(worldId, data) {
  return apiFetch(`/worlds/${worldId}/dashboard/pinned`, json('POST', data));
}

export function changePinnedRequest(worldId, itemId, data) {
  return apiFetch(`/worlds/${worldId}/dashboard/pinned/${itemId}`, json('PATCH', data));
}

export function removePinnedRequest(worldId, itemId) {
  return apiFetch(`/worlds/${worldId}/dashboard/pinned/${itemId}`, {method: 'DELETE'});
}

export function createSuggestionRequest(worldId, body, entryId, anonymous) {
  return apiFetch(`/worlds/${worldId}/dashboard/suggestions`, json('POST', entryId ? {body, entryId, anonymous} : {body, anonymous}));
}

export function listSuggestionsRequest(worldId, closed) {
  return apiFetch(`/worlds/${worldId}/dashboard/suggestions?status=${closed ? 'closed' : 'open'}`);
}

export function setSuggestionStatusRequest(worldId, suggestionId, status) {
  return apiFetch(`/worlds/${worldId}/dashboard/suggestions/${suggestionId}`, json('PATCH', {status}));
}
