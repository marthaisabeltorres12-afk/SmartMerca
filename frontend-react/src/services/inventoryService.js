import { apiFetch } from './api';
export const inventoryService = {
  getAll:        (token)        => apiFetch('/inventory/', {}, token),
  addEntry:      (data, token)  => apiFetch('/inventory/entrada',        { method:'POST', body: JSON.stringify(data) }, token),
  addEntryNew:   (data, token)  => apiFetch('/inventory/entrada-nuevo',  { method:'POST', body: JSON.stringify(data) }, token),
  addEntryBatch: (data, token)  => apiFetch('/inventory/entrada-pedido', { method:'POST', body: JSON.stringify(data) }, token),
  addExit:       (data, token)  => apiFetch('/inventory/salida',         { method:'POST', body: JSON.stringify(data) }, token),
};