import React, { useEffect } from 'react';
import useBascula from '../hooks/useBascula';

/**
 * Widget de báscula para el Punto de Venta.
 * Se muestra automáticamente cuando hay productos "por peso" en el carrito.
 * 
 * PARA EL CLIENTE:
 * 1. Conectar la báscula USB al computador
 * 2. Clic en "Conectar báscula" → seleccionar el puerto COM de la báscula
 * 3. El peso aparece automáticamente al poner el producto
 * 4. Clic en "Usar este peso" para agregarlo al carrito
 */
const BasculaWidget = ({ onPesoConfirmado, productoNombre }) => {
  const {
    soportado, conectada, peso, estable,
    error, leyendo, conectar, desconectar, tomarPeso,
  } = useBascula();

  // Auto-confirmar cuando el peso es estable y mayor a 0
  useEffect(() => {
    if (estable && peso > 0.01 && onPesoConfirmado) {
      // Pequeño delay para que el usuario vea el peso
      const timer = setTimeout(() => {
        // No auto-confirmar — dejar que el cajero lo confirme manualmente
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [estable, peso, onPesoConfirmado]);

  if (!soportado) {
    return (
      <div className="alert alert-warning py-2 small">
        ⚠️ Tu navegador no soporta báscula USB. Usa Chrome 89+ o Edge 89+.
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm" style={{ borderLeft: '4px solid #16a34a' }}>
      <div className="card-body py-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: 22 }}>⚖️</span>
            <div>
              <div className="fw-bold" style={{ fontSize: 13 }}>Báscula digital</div>
              {productoNombre && (
                <div className="text-muted" style={{ fontSize: 11 }}>{productoNombre}</div>
              )}
            </div>
          </div>
          <div>
            {!conectada ? (
              <button className="btn btn-success btn-sm fw-bold" onClick={conectar}>
                🔌 Conectar báscula
              </button>
            ) : (
              <button className="btn btn-outline-danger btn-sm" onClick={desconectar}>
                ✕ Desconectar
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small mb-2">{error}</div>
        )}

        {conectada && (
          <div>
            {/* Display de peso */}
            <div className="d-flex align-items-end justify-content-center gap-2 my-3">
              <div style={{
                background:   '#0f172a',
                border:       `2px solid ${estable ? '#16a34a' : '#d97706'}`,
                borderRadius: 12,
                padding:      '12px 24px',
                textAlign:    'center',
                minWidth:     180,
              }}>
                <div style={{
                  fontSize:   36,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  color:      estable ? '#4ade80' : '#fbbf24',
                  letterSpacing: 2,
                }}>
                  {peso !== null ? peso.toFixed(3) : '0.000'}
                </div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 2 }}>kg</div>
              </div>
              <div style={{ fontSize: 11, color: estable ? '#16a34a' : '#d97706', fontWeight: 700 }}>
                {estable ? '✅ Estable' : '⏳ Midiendo...'}
              </div>
            </div>

            {/* Botón confirmar peso */}
            {peso > 0.01 && (
              <button
                className="btn btn-success w-100 fw-bold"
                onClick={() => onPesoConfirmado && onPesoConfirmado(tomarPeso())}
                disabled={!estable}
              >
                ✅ Usar {peso?.toFixed(3)} kg
              </button>
            )}

            {/* Instrucciones */}
            <div className="text-center text-muted mt-2" style={{ fontSize: 11 }}>
              {!peso || peso <= 0.01
                ? 'Pon el producto en la báscula...'
                : estable
                ? 'Peso estable — listo para confirmar'
                : 'Espera que el peso se estabilice...'}
            </div>
          </div>
        )}

        {!conectada && !error && (
          <div className="text-center text-muted" style={{ fontSize: 12 }}>
            {/* ══════════════════════════════════════════════════════
                NOTA PARA EL CLIENTE:
                Conectar la báscula USB al computador antes de presionar
                el botón "Conectar báscula". Si no aparece el puerto,
                instalar el driver del CD que viene con la báscula.
                Modelos compatibles: Torrey, CAS, Mettler Toledo, AND
                ══════════════════════════════════════════════════════ */}
            Conecta tu báscula USB y presiona el botón para iniciar
          </div>
        )}
      </div>
    </div>
  );
};

export default BasculaWidget;