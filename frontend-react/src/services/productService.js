import { apiFetch } from './api';

export const productService = {
  getAll: (token) => apiFetch('/products/', {}, token),
  getById: (id, token) => apiFetch(`/products/${id}`, {}, token),
  create: (data, token) => apiFetch('/products/', { method: 'POST', body: JSON.stringify(data) }, token),
  update: (id, data, token) => apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),
  delete: (id, token) => apiFetch(`/products/${id}`, { method: 'DELETE' }, token),
  toggle: (id, token) => apiFetch(`/products/${id}/toggle`, { method: 'PATCH' }, token),
};
