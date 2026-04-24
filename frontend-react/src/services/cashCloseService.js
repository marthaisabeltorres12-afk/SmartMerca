import { apiFetch } from './api';

export const cashCloseService = {
  getAll:  (token)         => apiFetch('/cash-closes/', {}, token),
  create:  (data, token)   => apiFetch('/cash-closes/', { method:'POST', body: JSON.stringify(data) }, token),
  review:  (id, data, token) => apiFetch(`/cash-closes/${id}/review`, { method:'PATCH', body: JSON.stringify(data) }, token),
};