import { apiFetch } from './client';

export function getGraphRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/graph`);
}
