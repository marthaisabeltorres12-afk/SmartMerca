import { apiFetch } from './api';

export const creditService = {
  getCartera:           (token)             => apiFetch('/credit/', {}, token),
  getTransactions:      (customerId, token) => apiFetch(`/credit/${customerId}/transactions`, {}, token),
  getFacturasPendientes:(customerId, token) => apiFetch(`/credit/${customerId}/facturas`, {}, token),
  setLimit:             (customerId, data, token) => apiFetch(`/credit/${customerId}/limit`,   { method:'POST', body:JSON.stringify(data) }, token),
  addCredit:            (customerId, data, token) => apiFetch(`/credit/${customerId}/credito`, { method:'POST', body:JSON.stringify(data) }, token),
  addPayment:           (customerId, data, token) => apiFetch(`/credit/${customerId}/abono`,   { method:'POST', body:JSON.stringify(data) }, token),
};