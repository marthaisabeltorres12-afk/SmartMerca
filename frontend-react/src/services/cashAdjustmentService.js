import { apiFetch } from './api';

export const cashAdjustmentService = {
  getAll:  (token, cierre_id = null) => {
    const qs = cierre_id ? `?cierre_id=${cierre_id}` : '';
    return apiFetch(`/cash-adjustments/${qs}`, {}, token);
  },
  create: (data, token) =>
    apiFetch('/cash-adjustments/', { method: 'POST', body: JSON.stringify(data) }, token),
};