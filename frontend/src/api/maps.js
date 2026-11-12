import { apiFetch } from './client';

export function listMapsRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/maps`);
}

export function getMapRequest(worldId, mapId) {
  return apiFetch(`/worlds/${worldId}/maps/${mapId}`);
}

export function createMapRequest(worldId, name, file) {
  const form = new FormData();

  form.append('name', name);
  form.append('file', file);

  return apiFetch(`/worlds/${worldId}/maps`, {method: 'POST', body: form});
}

export function renameMapRequest(worldId, mapId, name) {
  return apiFetch(`/worlds/${worldId}/maps/${mapId}`, {method: 'PATCH', body: JSON.stringify({name})});
}

export function deleteMapRequest(worldId, mapId, confirmName) {
  return apiFetch(`/worlds/${worldId}/maps/${mapId}`, {method: 'DELETE', body: JSON.stringify({confirmName})});
}

export function createMarkerRequest(worldId, mapId, data) {
  return apiFetch(`/worlds/${worldId}/maps/${mapId}/markers`, {method: 'POST', body: JSON.stringify(data)});
}

export function updateMarkerRequest(worldId, markerId, data) {
  return apiFetch(`/worlds/${worldId}/markers/${markerId}`, {method: 'PATCH', body: JSON.stringify(data)});
}

export function deleteMarkerRequest(worldId, markerId) {
  return apiFetch(`/worlds/${worldId}/markers/${markerId}`, {method: 'DELETE'});
}

export function setEntryTypeMappableRequest(worldId, typeId, mappable) {
  return apiFetch(`/worlds/${worldId}/entry-types/${typeId}/mappable`, {method: 'PUT', body: JSON.stringify({mappable})});
}
