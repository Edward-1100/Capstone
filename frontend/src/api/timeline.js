import { apiFetch } from './client';

export function listTimelineRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/timeline`);
}

export function createTimelineEntryRequest(worldId, data) {
  return apiFetch(`/worlds/${worldId}/timeline`, {method: 'POST', body: JSON.stringify(data)});
}

export function updateTimelineEntryRequest(worldId, itemId, data) {
  return apiFetch(`/worlds/${worldId}/timeline/${itemId}`, {method: 'PATCH', body: JSON.stringify(data)});
}

export function deleteTimelineEntryRequest(worldId, itemId) {
  return apiFetch(`/worlds/${worldId}/timeline/${itemId}`, {method: 'DELETE'});
}

export function setEntryTypeTimelineableRequest(worldId, typeId, timelineable) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}/timelineable`, {method: 'PUT', body: JSON.stringify({timelineable})});
}

export function setTimelineColorRequest(worldId, itemId, color) {
  return apiFetch(`/worlds/${worldId}/timeline/${itemId}/color`, {method: 'PUT', body: JSON.stringify({color})});
}
