import { apiFetch } from './api';

export const customerService = {
  getAll:    (token)             => apiFetch('/customers/',           {}, token),
  getById:   (id, token)         => apiFetch(`/customers/${id}`,      {}, token),
  search:    (q, token)          => apiFetch(`/customers/search?q=${encodeURIComponent(q)}`, {}, token),
  create:    (data, token)       => apiFetch('/customers/',           { method:'POST', body:JSON.stringify(data) }, token),
  update:    (id, data, token)   => apiFetch(`/customers/${id}`,      { method:'PUT',  body:JSON.stringify(data) }, token),
  delete:    (id, token)         => apiFetch(`/customers/${id}`,      { method:'DELETE' }, token),
  addPoints: (id, pts, token)    => apiFetch(`/customers/${id}/points`,{ method:'POST', body:JSON.stringify({ points: pts }) }, token),
};