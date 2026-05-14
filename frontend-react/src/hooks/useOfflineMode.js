import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para manejar el modo offline en SmartMerca POS.
 * - Detecta pérdida de conexión
 * - Guarda ventas en IndexedDB cuando no hay internet
 * - Sincroniza automáticamente al reconectar
 * - Muestra notificaciones al usuario
 */
const useOfflineMode = (token, showAlert) => {
  const [isOnline,        setIsOnline]        = useState(navigator.onLine);
  const [pendingCount,    setPendingCount]    = useState(0);
  const [syncing,         setSyncing]         = useState(false);
  const dbRef = useRef(null);

  // ── Abrir IndexedDB ────────────────────────────────────────────────────
  const openDB = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (dbRef.current) { resolve(dbRef.current); return; }
      const req = indexedDB.open('smartmerca-offline', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('ventas_pendientes')) {
          db.createObjectStore('ventas_pendientes', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => { dbRef.current = e.target.result; resolve(dbRef.current); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }, []);

  // ── Guardar venta pendiente ────────────────────────────────────────────
  const guardarVentaPendiente = useCallback(async (ventaData) => {
    try {
      const db    = await openDB();
      const tx    = db.transaction('ventas_pendientes', 'readwrite');
      const store = tx.objectStore('ventas_pendientes');
      store.add({
        data:      ventaData,
        token:     token,
        timestamp: Date.now(),
      });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
      const count = await contarPendientes();
      setPendingCount(count);
      showAlert('warning', `📴 Sin internet — venta guardada localmente (${count} pendiente${count !== 1 ? 's' : ''})`);
      return true;
    } catch (e) {
      console.error('[offline] Error guardando venta:', e);
      return false;
    }
  }, [openDB, token, showAlert]);

  // ── Contar pendientes ──────────────────────────────────────────────────
  const contarPendientes = useCallback(async () => {
    try {
      const db    = await openDB();
      const tx    = db.transaction('ventas_pendientes', 'readonly');
      const store = tx.objectStore('ventas_pendientes');
      return await new Promise((res) => {
        const req = store.count();
        req.onsuccess = () => res(req.result);
        req.onerror   = () => res(0);
      });
    } catch { return 0; }
  }, [openDB]);

  // ── Sincronizar ventas pendientes ──────────────────────────────────────
  const sincronizarPendientes = useCallback(async () => {
    if (syncing || !isOnline) return;
    const count = await contarPendientes();
    if (count === 0) return;

    setSyncing(true);
    try {
      const db      = await openDB();
      const tx      = db.transaction('ventas_pendientes', 'readonly');
      const store   = tx.objectStore('ventas_pendientes');
      const ventas  = await new Promise((res) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
        req.onerror   = () => res([]);
      });

      let sincronizadas = 0;
      for (const venta of ventas) {
        try {
          const res = await fetch('/api/sales/', {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${venta.token || token}`,
            },
            body: JSON.stringify(venta.data),
          });

          if (res.ok) {
            const tx2    = db.transaction('ventas_pendientes', 'readwrite');
            const store2 = tx2.objectStore('ventas_pendientes');
            store2.delete(venta.id);
            sincronizadas++;
          }
        } catch (e) {
          console.error('[offline] Error sincronizando venta:', e);
        }
      }

      const restantes = await contarPendientes();
      setPendingCount(restantes);

      if (sincronizadas > 0) {
        showAlert('success', `✅ ${sincronizadas} venta${sincronizadas !== 1 ? 's' : ''} sincronizada${sincronizadas !== 1 ? 's' : ''} correctamente`);
      }
    } catch (e) {
      console.error('[offline] Error en sincronización:', e);
    } finally {
      setSyncing(false);
    }
  }, [syncing, isOnline, openDB, token, contarPendientes, showAlert]);

  // ── Detectar cambios de conectividad ──────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showAlert('success', '🌐 Conexión restaurada — sincronizando ventas...');
      setTimeout(sincronizarPendientes, 1000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      showAlert('warning', '📴 Sin conexión — las ventas se guardarán localmente');
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    // Contar pendientes al iniciar
    contarPendientes().then(setPendingCount);

    // Escuchar mensajes del Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'VENTA_SINCRONIZADA') {
          contarPendientes().then(setPendingCount);
        }
      });
    }

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sincronizarPendientes, contarPendientes, showAlert]);

  // ── Registrar Service Worker ───────────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then(() => console.log('[SW] Registrado correctamente'))
          .catch((e) => console.error('[SW] Error al registrar:', e));
      } else {
        navigator.serviceWorker.getRegistrations()
          .then((regs) => regs.forEach((reg) => reg.unregister()))
          .catch((e) => console.error('[SW] Error al desregistrar en dev:', e));
      }
    }
  }, []);

  return {
    isOnline,
    pendingCount,
    syncing,
    guardarVentaPendiente,
    sincronizarPendientes,
  };
};

export default useOfflineMode;