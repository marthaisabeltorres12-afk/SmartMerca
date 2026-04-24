import { apiFetch } from './api';
export const shiftService = {
  getActive:         (token)        => apiFetch('/shifts/active',                    {}, token),
  getAll:            (token)        => apiFetch('/shifts/',                           {}, token),
  open:              (data, token)  => apiFetch('/shifts/open',                       { method:'POST', body:JSON.stringify(data) }, token),
  requestCount:      (id, token)    => apiFetch(`/shifts/${id}/request-count`,        { method:'POST', body:'{}' }, token),
  submitCashierCount:(id, data, token) => apiFetch(`/shifts/${id}/cashier-count`,     { method:'POST', body:JSON.stringify(data) }, token),
  close:             (data, token)  => apiFetch('/shifts/close',                      { method:'POST', body:JSON.stringify(data) }, token),
  addWithdrawal:     (data, token)  => apiFetch('/shifts/withdrawal',                 { method:'POST', body:JSON.stringify(data) }, token),
  getDetail:         (id, token)    => apiFetch(`/shifts/${id}`,                      {}, token),
};