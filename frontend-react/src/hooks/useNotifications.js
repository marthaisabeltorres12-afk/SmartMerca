import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../services/api';

const POLL_INTERVAL = 30000; // 30 segundos

export const useNotifications = (token, isAdmin) => {
  const [notifications, setNotifications] = useState([]);
  const [toasts,        setToasts]        = useState([]);
  const [unread,        setUnread]        = useState(0);
  const prevIds = useRef(new Set());

  const fetchNotifications = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      // Generar alertas automáticas primero
      await apiFetch('/notificaciones/generar-alertas', { method: 'POST' }, token).catch(()=>{});
      // Luego obtener todas las pendientes
      const data = await apiFetch('/notificaciones/?pendientes=true', {}, token);
      if (!Array.isArray(data)) return;

      setNotifications(data);
      setUnread(data.length);

      // Detectar notificaciones NUEVAS para mostrar como toast
      const newOnes = data.filter(n => !prevIds.current.has(n.id));
      if (newOnes.length > 0 && prevIds.current.size > 0) {
        setToasts(prev => [
          ...prev,
          ...newOnes.slice(0, 3).map(n => ({ ...n, toastId: Date.now() + Math.random() }))
        ]);
      }
      prevIds.current = new Set(data.map(n => n.id));
    } catch {}
  }, [token, isAdmin]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllRead = () => setUnread(0);

  const dismissToast = (toastId) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  };

  const resolverNotif = async (id) => {
    try {
      await apiFetch(`/notificaciones/${id}/resolver`, { method: 'POST' }, token);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnread(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const resolverTodas = async () => {
    try {
      await apiFetch('/notificaciones/resolver-todas', { method: 'POST' }, token);
      setNotifications([]);
      setUnread(0);
    } catch {}
  };

  return { notifications, unread, toasts, markAllRead, dismissToast, resolverNotif, resolverTodas, refetch: fetchNotifications };
};