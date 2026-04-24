import { apiFetch } from './api';
export const userService = {
  getAll:   (token)          => apiFetch('/users/', {}, token),
  getById:  (id, token)      => apiFetch(`/users/${id}`, {}, token),
  create:   (data, token)    => apiFetch('/users/', { method: 'POST', body: JSON.stringify(data) }, token),
  update:   (id, data, token)=> apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),
  delete:   (id, token)      => apiFetch(`/users/${id}`, { method: 'DELETE' }, token),
  approve:  (id, token)      => apiFetch(`/users/${id}/approve`, { method: 'PATCH' }, token),
  reject:   (id, token)      => apiFetch(`/users/${id}/reject`, { method: 'DELETE' }, token),
};