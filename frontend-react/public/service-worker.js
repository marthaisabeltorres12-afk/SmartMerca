/* eslint-disable no-restricted-globals */
// SmartMerca POS — Service Worker v1
// Modo offline: cachea el frontend y sincroniza ventas pendientes

const CACHE_NAME = 'smartmerca-v1';
const OFFLINE_URL = '/offline.html';

// Archivos a cachear al instalar
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
  '/manifest.json',
];

// ── Instalación ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Si algún asset falla, continuar igual
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// ── Activación ─────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls — network first, luego respuesta offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cachear respuestas GET de productos y presentaciones
          if (request.method === 'GET' &&
              (url.pathname.includes('/products') || url.pathname.includes('/presentations'))) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Sin internet — intentar cache
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Para ventas POST sin internet — retornar error especial
            if (request.method === 'POST' && url.pathname.includes('/sales')) {
              return new Response(
                JSON.stringify({ offline: true, message: 'Sin conexión — venta guardada localmente' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } }
              );
            }
            return new Response(
              JSON.stringify({ offline: true, message: 'Sin conexión' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Assets estáticos — cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Sin internet y sin cache — mostrar página offline
          if (request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});

// ── Sync en segundo plano ──────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-ventas') {
    event.waitUntil(syncVentasPendientes());
  }
});

async function syncVentasPendientes() {
  try {
    const db = await openDB();
    const ventas = await getAllPendingVentas(db);
    for (const venta of ventas) {
      try {
        const res = await fetch('/api/sales/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${venta.token}`,
          },
          body: JSON.stringify(venta.data),
        });
        if (res.ok) {
          await deletePendingVenta(db, venta.id);
          // Notificar al cliente
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) =>
              client.postMessage({ type: 'VENTA_SINCRONIZADA', ventaId: venta.id })
            );
          });
        }
      } catch (e) {
        console.error('Error sincronizando venta:', e);
      }
    }
  } catch (e) {
    console.error('Error en sync:', e);
  }
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('smartmerca-offline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('ventas_pendientes')) {
        db.createObjectStore('ventas_pendientes', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function getAllPendingVentas(db) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('ventas_pendientes', 'readonly');
    const store = tx.objectStore('ventas_pendientes');
    const req   = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function deletePendingVenta(db, id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('ventas_pendientes', 'readwrite');
    const store = tx.objectStore('ventas_pendientes');
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}