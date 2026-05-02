import { useCallback } from 'react';

/**
 * Hook para manejar reservas de stock del carrito en multi-caja.
 *
 * Uso en Sales.jsx:
 *   const { reservar, liberarProducto, liberarTodo } = useCartReservations(token);
 */
const useCartReservations = (token) => {

  // ── Reservar al agregar al carrito ────────────────────────────────────
  const reservar = useCallback(async (productId, quantity, cashRegisterId = null) => {
    /**
     * Retorna { ok: true, stock_disponible } o { ok: false, message }
     */
    try {
      const res = await fetch('/api/reservas/reservar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          product_id:       productId,
          quantity,
          cash_register_id: cashRegisterId,
        }),
      });
      return await res.json();
    } catch(e) {
      console.error('[useCartReservations] reservar error:', e);
      return { ok: true }; // fallback: permitir y dejar que el backend rechace al vender
    }
  }, [token]);

  // ── Actualizar reserva cuando cambia cantidad ─────────────────────────
  const actualizarReserva = useCallback(async (productId, nuevaCantidad) => {
    return reservar(productId, nuevaCantidad);
  }, [reservar]);

  // ── Liberar reserva de un producto (al quitar del carrito) ────────────
  const liberarProducto = useCallback(async (productId) => {
    try {
      await fetch('/api/reservas/liberar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ product_ids: [productId] }),
      });
    } catch(e) {
      console.error('[useCartReservations] liberar error:', e);
    }
  }, [token]);

  // ── Liberar todo el carrito (al vaciar o cerrar pestaña) ──────────────
  const liberarTodo = useCallback(async (productIds = null) => {
    try {
      await fetch('/api/reservas/liberar', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ product_ids: productIds }),
      });
    } catch(e) {
      console.error('[useCartReservations] liberarTodo error:', e);
    }
  }, [token]);

  // ── Obtener stock disponible de varios productos ───────────────────────
  const getStockDisponible = useCallback(async (productIds) => {
    if (!productIds?.length) return {};
    try {
      const res = await fetch(`/api/reservas/stock?ids=${productIds.join(',')}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return await res.json(); // { "1": { stock, reserved_stock, disponible }, ... }
    } catch(e) {
      return {};
    }
  }, [token]);

  return { reservar, actualizarReserva, liberarProducto, liberarTodo, getStockDisponible };
};

export default useCartReservations;