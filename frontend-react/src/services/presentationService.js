import { apiFetch } from './api';
export const presentationService = {
  getAll:       (token)        => apiFetch('/presentations/', {}, token),
  getByProduct: (id, token)    => apiFetch(`/presentations/product/${id}`, {}, token),
  create:       (data, token)  => apiFetch('/presentations/', { method:'POST', body:JSON.stringify(data) }, token),
  update:       (id, data, token) => apiFetch(`/presentations/${id}`, { method:'PUT', body:JSON.stringify(data) }, token),
  remove:       (id, token)    => apiFetch(`/presentations/${id}`, { method:'DELETE' }, token),
};