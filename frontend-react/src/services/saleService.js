import { apiFetch } from './api';

export const saleService = {
  getAll:              (token)       => apiFetch('/sales/', {}, token),
  getByCashier:        (token)       => apiFetch('/sales/by-cashier', {}, token),
  getByCashierDetail:  (token)       => apiFetch('/sales/by-cashier-detail', {}, token),  // ← NUEVO
  create:              (data, token) => apiFetch('/sales/', { method: 'POST', body: JSON.stringify(data) }, token),
};