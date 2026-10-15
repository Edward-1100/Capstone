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
