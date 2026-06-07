import React from 'react';
import { usePlan, PLANES_INFO } from '../context/PlanContext';
import Navbar from './Navbar';

const PLAN_SIGUIENTE = { basico: 'estandar', estandar: 'premium', premium: null };

/**
 * PlanGuard — tres modos:
 * 
 * 1. <PlanGuard feature="devoluciones"> → bloquea toda la página
 * 2. <PlanGuard feature="reportes_pdf" inline> → solo muestra botón bloqueado
 * 3. <PlanGuard feature="dian" btn label="Factura DIAN"> → botón con candado
 */
const PlanGuard = ({ feature, children, inline = false, btn = false, label = '' }) => {
  const { hasFeature, plan, planVencido, soloLectura } = usePlan();

  // ── Modo solo lectura (7+ días vencido) ──────────────────────────────
  if (soloLectura) {
    if (inline || btn) {
      return (
        <span className="badge bg-danger ms-1" title="Plan vencido">
          <i className="bi bi-lock-fill me-1"></i>Vencido
        </span>
      );
    }
    return (
      <div className="d-flex">
        <Navbar />
        <main className="flex-grow-1 d-flex align-items-center justify-content-center"
          style={{ marginLeft: 240, minHeight: '100vh', background: '#f8fafc' }}>
          <div className="text-center p-5" style={{
            background: '#fff', borderRadius: 16,
            border: '1.5px solid #fca5a5', maxWidth: 480,
            boxShadow: '0 4px 24px rgba(239,68,68,0.1)'
          }}>
            <i className="bi bi-lock-fill text-danger" style={{ fontSize: 52 }}></i>
            <h5 className="mt-3 fw-bold text-danger">Sistema en modo solo lectura</h5>
            <p className="text-muted">Tu plan venció hace más de 7 días. Renueva para seguir registrando ventas.</p>
            <a href="https://smartmerca.com.co#planes" target="_blank" rel="noreferrer"
              className="btn btn-danger fw-bold px-4 mt-2">
              <i className="bi bi-arrow-up-circle me-2"></i>Renovar plan
            </a>
          </div>
        </main>
      </div>
    );
  }

  // ── Tiene la feature → mostrar normal ────────────────────────────────
  if (hasFeature(feature)) return <>{children}</>;

  const planSig = PLAN_SIGUIENTE[plan];
  const planSigInfo = planSig ? PLANES_INFO[planSig] : null;

  // ── Modo botón bloqueado ─────────────────────────────────────────────
  if (btn) {
    return (
      <button className="btn btn-outline-secondary" disabled
        title={`Requiere Plan ${planSigInfo?.nombre}`}>
        <i className="bi bi-lock-fill me-2"></i>{label}
      </button>
    );
  }

  // ── Modo inline (badge) ──────────────────────────────────────────────
  if (inline) {
    return (
      <span className="badge bg-secondary ms-1"
        title={`Requiere Plan ${planSigInfo?.nombre}`}
        style={{ fontSize: 10, cursor: 'default' }}>
        <i className="bi bi-lock-fill me-1"></i>
        {planSigInfo?.nombre}
      </span>
    );
  }

  // ── Modo página completa — con Navbar visible ────────────────────────
  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center"
        style={{ marginLeft: 240, minHeight: '100vh', background: '#f8fafc' }}>
        <div className="text-center p-5" style={{
          background: '#fff', borderRadius: 16,
          border: '1.5px solid #e2e8f0', maxWidth: 500,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: `linear-gradient(135deg, #1e3a5f, ${planSigInfo?.color || '#2563eb'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <i className="bi bi-lock-fill text-white" style={{ fontSize: 36 }}></i>
          </div>
          <h5 className="fw-bold mb-2">Función no disponible</h5>
          <p className="text-muted mb-1">Esta función requiere el</p>
          <span className="badge fs-6 px-3 py-2 mb-3"
            style={{ background: planSigInfo?.color || '#2563eb' }}>
            Plan {planSigInfo?.nombre}
          </span>
          <p className="text-muted small mb-4">
            Tu plan actual es <strong>Plan {PLANES_INFO[plan]?.nombre}</strong>.
            Actualiza para acceder a esta y muchas más funciones.
          </p>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <a href="https://smartmerca.com.co#planes" target="_blank" rel="noreferrer"
              className="btn btn-primary fw-bold px-4">
              <i className="bi bi-arrow-up-circle me-2"></i>Ver planes
            </a>
            <a href="https://wa.me/573001234567" target="_blank" rel="noreferrer"
              className="btn btn-outline-success fw-bold px-4">
              <i className="bi bi-whatsapp me-2"></i>Contactar
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlanGuard;