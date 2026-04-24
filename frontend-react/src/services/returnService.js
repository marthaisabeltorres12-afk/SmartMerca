import { apiFetch } from './api';

export const returnService = {
  getAll:      (token)         => apiFetch('/returns/', {}, token),
  getSale:     (saleId, token) => apiFetch(`/returns/sale/${saleId}`, {}, token),
  create:      (data, token)   => apiFetch('/returns/', { method:'POST', body: JSON.stringify(data) }, token),
};