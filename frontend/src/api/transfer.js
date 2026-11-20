import { apiDownload, apiFetch } from './client';

export function getExportManifestRequest(worldId) {
  return apiFetch(`/worlds/${worldId}/export`);
}

export function exportWorldRequest(worldId, select, options) {
  return apiDownload(`/worlds/${worldId}/export`, {select, options});
}

function importForm(file, plan) {
  const form = new FormData();

  form.append('file', file, 'import.json');

  if (plan) {
    form.append('plan', JSON.stringify(plan));
  }

  return form;
}

export function previewImportRequest(worldId, file) {
  return apiFetch(worldId ? `/worlds/${worldId}/import/preview` : '/worlds/import/preview', {method: 'POST', body: importForm(file)});
}

export function runImportRequest(worldId, file, plan) {
  return apiFetch(worldId ? `/worlds/${worldId}/import` : '/worlds/import', {method: 'POST', body: importForm(file, plan)});
}
