import { apiFetch } from './client';

export function listWorldsRequest() {
  return apiFetch('/worlds');
}

export function getWorldRequest(id) {
  return apiFetch(`/worlds/${id}`);
}

export function createWorldRequest(data) {
  return apiFetch('/worlds', {method: 'POST', body: JSON.stringify(data)});
}

export function updateWorldRequest(id, data) {
  return apiFetch(`/worlds/${id}`, {method: 'PATCH', body: JSON.stringify(data)});
}

export function deleteWorldRequest(id, confirmName) {
  return apiFetch(`/worlds/${id}`, {method: 'DELETE', body: JSON.stringify({confirmName})});
}

export function uploadThumbnailRequest(id, file) {
  const form = new FormData();

  form.append('file', file);

  return apiFetch(`/worlds/${id}/thumbnail`, {method: 'PUT', body: form});
}

export function deleteThumbnailRequest(id) {
  return apiFetch(`/worlds/${id}/thumbnail`, {method: 'DELETE'});
}
