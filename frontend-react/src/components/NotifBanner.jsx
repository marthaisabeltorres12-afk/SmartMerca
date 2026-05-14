import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

const TIPO_CONFIG = {
  producto_faltante: { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd', icon: '📦' },
  producto_danado:   { color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', icon: '⚠️' },
  stock_bajo:        { color: '#b45309', bg: '#fef3c7', border: '#fcd34d', icon: '📉' },
  vencimiento:       { color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', icon: '📅' },
  cierre_turno:      { color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd', icon: '🔒' },
  conteo_diferencia: { color: '#b45309', bg: '#fef3c7', border: '#fcd34d', icon: '🔢' },
  otro:              { color: '#1e3a5f', bg: '#eff6ff', border: '#93c5fd', icon: '🔔' },
};

const ADMIN_ROLES  = ['admin','admin_tecnico','supervisor','contador'];
const AUTH_PAGES   = ['/login','/forgot-password','/reset-password','/planes'];
const INTERVALO_MS = 120000; // 2 minutos

const NotifBanner = () => {
  const { token, user } = useAuth();
  const location        = useLocation();
  const [notifs, setNotifs] = useState([]);

  // Refs para evitar que el intervalo se recree en cada render
  const loadingRef  = useRef(false);
  const tokenRef    = useRef(token);
  const userRef     = useRef(user);
  const pathRef     = useRef(location.pathname);

  // Actualizar refs sin disparar efectos
  tokenRef.current = token;
  userRef.current  = user;
  pathRef.current  = location.pathname;

  // load no tiene dependencias — usa refs internamente
  const load = useCallback(async () => {
    const t       = tokenRef.current;
    const u       = userRef.current;
    const path    = pathRef.current;
    const isAdmin    = ADMIN_ROLES.includes(u?.role);
    const isAuthPage = AUTH_PAGES.includes(path);

    if (!t || !isAdmin || isAuthPage) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      await apiFetch('/notificaciones/generar-alertas', { method:'POST' }, t).catch(()=>{});
      const data = await apiFetch('/notificaciones/?pendientes=true', {}, t);
      if (Array.isArray(data)) setNotifs(data);
    } catch {}
    finally { loadingRef.current = false; }
  }, []); // sin dependencias — un solo intervalo para siempre

  useEffect(() => {
    const timer = setTimeout(load, 500); // pequeño delay al montar
    const iv    = setInterval(load, INTERVALO_MS);
    return () => { clearTimeout(timer); clearInterval(iv); };
  }, []); // solo al montar — nunca se recrea

  const resolver = async (id) => {
    try {
      await apiFetch(`/notificaciones/${id}/resolver`, { method:'POST' }, tokenRef.current);
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const isAdmin    = ADMIN_ROLES.includes(user?.role);
  const isAuthPage = AUTH_PAGES.includes(location.pathname);

  if (!notifs.length || !isAdmin || isAuthPage || !token) return null;

  const altura = Math.min(notifs.length, 4) * 37 + (notifs.length > 4 ? 24 : 0);

  return (
    <>
      <div style={{ height: altura, marginLeft: 240, flexShrink: 0 }} />
      <div style={{ position:'fixed', top:0, left:240, right:0, zIndex:1050 }}>
        {notifs.slice(0, 4).map(n => {
          const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.otro;
          return (
            <div key={n.id} style={{
              background: cfg.bg, borderBottom:`1px solid ${cfg.border}`,
              borderLeft:`4px solid ${cfg.color}`, padding:'7px 14px',
              display:'flex', alignItems:'center', gap:10,
              fontSize:13, color:'#1e293b', height:37,
            }}>
              <span style={{ fontSize:15, flexShrink:0 }}>{cfg.icon}</span>
              <div style={{ flex:1, overflow:'hidden' }}>
                <strong style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', display:'block' }}>
                  {n.titulo}
                </strong>
              </div>
              {n.mensaje && (
                <span style={{ color:'#475569', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', maxWidth:200, textOverflow:'ellipsis' }}>
                  {n.mensaje}
                </span>
              )}
              <button onClick={() => resolver(n.id)} style={{
                background:cfg.color, color:'#fff', border:'none',
                borderRadius:6, padding:'3px 10px', fontSize:11,
                fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
              }}>✓ Resolver</button>
              <button onClick={() => setNotifs(prev => prev.filter(x => x.id !== n.id))}
                style={{ background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:20, padding:'0 2px', lineHeight:1, flexShrink:0 }}>
                ×
              </button>
            </div>
          );
        })}
        {notifs.length > 4 && (
          <div style={{ background:'#1e293b', color:'#94a3b8', padding:'4px 14px', fontSize:11, textAlign:'center', height:24 }}>
            +{notifs.length - 4} notificaciones más pendientes
          </div>
        )}
      </div>
    </>
  );
};

export default NotifBanner;