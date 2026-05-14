import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

/**
 * Panel de configuración DIAN — SmartMerca
 * Muestra el estado de la facturación electrónica real con Alegra.
 * 
 * PARA ACTIVAR — El cliente necesita:
 * 1. Contratar Alegra: https://alegra.com (desde $59.000 COP/mes)
 * 2. Ir a Alegra → Configuración → API
 * 3. Copiar Email y Token
 * 4. Agregar en Railway (variables de entorno):
 *    ALEGRA_EMAIL = correo@empresa.com
 *    ALEGRA_TOKEN = token-de-alegra
 *    ALEGRA_ENABLED = true
 *    DIAN_RESOLUCION = (número de resolución DIAN)
 *    DIAN_PREFIJO = FACT
 */
const ConfigDIAN = () => {
  const { token } = useAuth();
  const [estado,    setEstado]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState(null);

  useEffect(() => {
    apiFetch('/dian/estado', {}, token).then(setEstado).catch(() => {});
  }, [token]);

  const verificar = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/dian/verificar', {}, token);
      setMsg({ type: res.ok ? 'success' : 'danger', text: res.message });
      if (res.ok) setEstado(e => ({ ...e, empresa: res.empresa, nit: res.nit }));
    } catch(e) {
      setMsg({ type:'danger', text: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header fw-semibold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
        🧾 Facturación Electrónica DIAN
      </div>
      <div className="card-body">
        {/* Estado actual */}
        <div className={`alert py-2 mb-3 ${estado?.configured && estado?.enabled ? 'alert-success' : 'alert-warning'}`}>
          {estado?.configured && estado?.enabled
            ? '✅ DIAN activa — las facturas se emiten automáticamente'
            : '⚠️ DIAN no configurada — actualmente en modo simulado'}
        </div>

        {/* Info resolución */}
        {estado && (
          <div className="row g-2 mb-3">
            <div className="col-6">
              <div className="p-2 rounded" style={{ background:'#f8fafc' }}>
                <div className="text-muted" style={{ fontSize:11 }}>Resolución DIAN</div>
                <div className="fw-bold small">{estado.resolucion}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="p-2 rounded" style={{ background:'#f8fafc' }}>
                <div className="text-muted" style={{ fontSize:11 }}>Prefijo</div>
                <div className="fw-bold small">{estado.prefijo}</div>
              </div>
            </div>
          </div>
        )}

        {/* Pasos para activar */}
        {(!estado?.configured || !estado?.enabled) && (
          <div className="mb-4 p-3 rounded" style={{ background:'#f8fafc', border:'1px solid #e2e8f0' }}>
            <div className="fw-bold mb-2 small">📋 Pasos para activar la DIAN real:</div>
            <ol className="small text-muted mb-0">
              <li className="mb-1">
                Contratar <a href="https://alegra.com" target="_blank" rel="noreferrer" className="fw-semibold">Alegra.com</a> — desde <strong>$59.000 COP/mes</strong>
              </li>
              <li className="mb-1">
                En Alegra → <strong>Configuración → Empresa</strong> → ingresar resolución DIAN
              </li>
              <li className="mb-1">
                En Alegra → <strong>Configuración → API</strong> → copiar Email y Token
              </li>
              <li className="mb-1">
                Agregar en Railway (Variables de entorno):
              </li>
            </ol>
            <div className="mt-2 p-2 rounded" style={{ background:'#1e293b', color:'#4ade80', fontFamily:'monospace', fontSize:11 }}>
              {/* ══════════════════════════════════════════════════════
                  ESPACIO PARA CREDENCIALES DEL CLIENTE
                  El cliente llena estos valores en Railway
                  ══════════════════════════════════════════════════════ */}
              ALEGRA_EMAIL=correo@empresa.com<br/>
              ALEGRA_TOKEN=xxxxxxxxxxxxxxxx<br/>
              ALEGRA_ENABLED=true<br/>
              DIAN_RESOLUCION=18764050366042<br/>
              DIAN_PREFIJO=FACT
            </div>
          </div>
        )}

        {/* Verificar conexión */}
        {estado?.configured && (
          <button className="btn btn-primary btn-sm fw-bold" onClick={verificar} disabled={loading}>
            {loading ? 'Verificando...' : '🔌 Verificar conexión con Alegra'}
          </button>
        )}

        {msg && <div className={`alert alert-${msg.type} py-2 small mt-3`}>{msg.text}</div>}

        {/* Funciones disponibles */}
        <div className="mt-3">
          <div className="fw-semibold small mb-2">✅ Qué incluye la integración:</div>
          <div className="d-flex flex-column gap-1">
            {[
              ['🧾', 'Factura electrónica válida ante la DIAN'],
              ['📧', 'CUFE (código único) por cada factura'],
              ['📄', 'PDF de la factura descargable'],
              ['👤', 'Creación automática de cliente en Alegra'],
              ['📊', 'Reportes de ventas en Alegra automáticamente'],
            ].map(([icon, text]) => (
              <div key={text} className="d-flex gap-2 align-items-center p-2 rounded" style={{ background:'#f0fdf4', fontSize:13 }}>
                <span>{icon}</span><span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 p-2 rounded" style={{ background:'#fffbeb', border:'1px solid #fde68a', fontSize:12 }}>
          <strong>💡 Nota:</strong> Sin configurar Alegra, SmartMerca sigue funcionando en <strong>modo simulado</strong> — genera tickets internos sin reporte a la DIAN. Solo los negocios con obligación tributaria necesitan la DIAN real.
        </div>
      </div>
    </div>
  );
};

export default ConfigDIAN;