import { apiFetch } from './api';
export const linesService = {
  getAll:      (token)        => apiFetch('/lines/', {}, token),
  create:      (data, token)  => apiFetch('/lines/', { method:'POST', body: JSON.stringify(data) }, token),
  update:      (id, data, token) => apiFetch(`/lines/${id}`, { method:'PUT', body: JSON.stringify(data) }, token),
  remove:      (id, token)    => apiFetch(`/lines/${id}`, { method:'DELETE' }, token),
  dashboard:   (id, period, token) => apiFetch(`/lines/${id}/dashboard?period=${period}`, {}, token),
};