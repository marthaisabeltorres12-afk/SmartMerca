import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();
const POLL_MS = 60000; // consulta cada 60 segundos

function calcAlerts(products) {
  const hoy = new Date().toISOString().slice(0, 10);
  const d7  = (() => { const d = new Date(); d.setDate(d.getDate() + 7);  return d.toISOString().slice(0,10); })();
  const d30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0,10); })();
  const out = [];

  products.forEach(p => {
    // Stock
    if (p.stock === 0)
      out.push({ id:`so-${p.id}`, type:'danger',  icon:'❌', title:'Agotado',            msg: p.name,                               cat:'stock' });
    else if (p.stock <= 5)
      out.push({ id:`sl-${p.id}`, type:'warning', icon:'⚠️', title:`Stock bajo (${p.stock} und.)`, msg: p.name,                    cat:'stock' });

    // Vencimiento
    if (!p.expiry_date) return;
    if (p.expiry_date < hoy)
      out.push({ id:`ev-${p.id}`, type:'danger',  icon:'🗓️', title:'Vencido',            msg:`${p.name} — ${p.expiry_date}`,       cat:'expiry' });
    else if (p.expiry_date <= d7)
      out.push({ id:`e7-${p.id}`, type:'danger',  icon:'🔴', title:'Vence en menos de 7 días', msg:`${p.name} — ${p.expiry_date}`, cat:'expiry' });
    else if (p.expiry_date <= d30)
      out.push({ id:`e3-${p.id}`, type:'warning', icon:'🟡', title:'Vence en menos de 30 días', msg:`${p.name} — ${p.expiry_date}`, cat:'expiry' });
  });
  return out;
}

export const NotificationProvider = ({ children }) => {
  const { token } = useAuth();
  const [alerts,    setAlerts]    = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sm_dismissed') || '[]'); } catch { return []; }
  });
  const [lastCheck, setLastCheck] = useState(null);
  const timer = useRef(null);

  const doFetch = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/products/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      setAlerts(calcAlerts(await res.json()));
      setLastCheck(new Date());
    } catch (_) {}
  }, [token]);

  useEffect(() => {
    if (!token) { setAlerts([]); clearInterval(timer.current); return; }
    doFetch();
    timer.current = setInterval(doFetch, POLL_MS);
    return () => clearInterval(timer.current);
  }, [token, doFetch]);

  const dismiss    = id => { const n=[...dismissed,id];  setDismissed(n); localStorage.setItem('sm_dismissed', JSON.stringify(n)); };
  const dismissAll = ()  => { const n=alerts.map(a=>a.id); setDismissed(n); localStorage.setItem('sm_dismissed', JSON.stringify(n)); };

  const visible = alerts.filter(a => !dismissed.includes(a.id));

  return (
    <NotificationContext.Provider value={{ alerts: visible, dismiss, dismissAll, lastCheck, refresh: doFetch }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);