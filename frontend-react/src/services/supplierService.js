import { apiFetch } from './api';
export const supplierService = {
  getAll: (token) => apiFetch('/suppliers/', {}, token),
  getById: (id, token) => apiFetch(`/suppliers/${id}`, {}, token),
  create: (data, token) => apiFetch('/suppliers/', { method: 'POST', body: JSON.stringify(data) }, token),
  update: (id, data, token) => apiFetch(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),
  delete: (id, token) => apiFetch(`/suppliers/${id}`, { method: 'DELETE' }, token),
};
