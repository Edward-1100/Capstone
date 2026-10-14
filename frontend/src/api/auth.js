import { apiFetch } from './client';

export function registerRequest(email, username, password) {

  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({email, username, password}),
  });

}

export function loginRequest(email, password) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({email, password}),
  });
}

export function meRequest() {
  return apiFetch('/auth/me');
}
