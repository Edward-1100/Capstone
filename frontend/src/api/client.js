const TOKEN_KEY = 'token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const isForm = options.body instanceof FormData;
  const headers = Object.assign(isForm ? {} : {'Content-Type': 'application/json'}, options.headers);

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, Object.assign({}, options, {headers}));
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    const error = new Error(message || 'Request failed');

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export async function apiDownload(path, body) {
  const token = getToken();
  const headers = {'Content-Type': 'application/json'};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {method: 'POST', headers, body: JSON.stringify(body)});

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    const error = new Error(message || 'Request failed');

    error.status = response.status;

    throw error;
  }

  const match = (response.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/);

  return {blob: await response.blob(), filename: match ? match[1] : 'world-export.json'};
}
