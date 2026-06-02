import { apiFetch } from './api';
export const categoryService = {
  getAll: (token) => apiFetch('/categories/', {}, token),
  getById: (id, token) => apiFetch(`/categories/${id}`, {}, token),
  create: (data, token) => apiFetch('/categories/', { method: 'POST', body: JSON.stringify(data) }, token),
  update: (id, data, token) => apiFetch(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }, token),
  delete: (id, token) => apiFetch(`/categories/${id}`, { method: 'DELETE' }, token),
};
