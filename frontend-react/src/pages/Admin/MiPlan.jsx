import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt = n => Number(n||0).toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0});

const PLANES = [
  {
    key: 'basico', nombre: 'Básico', icono: '',
    precio: 80000, precioReal: 150000,
    color: '#2563EB', bg: '#EFF6FF', borde: '#2563EB',
    features: [
      '1 caja · 3 usuarios · 1 sucursal',
      'Ventas con escáner de barras',
      'Pago mixto Nequi + efectivo',
      'Packs y presentaciones',
      'Stock en tiempo real',
      'Modo offline 2 horas',
      'Soporte incluido',
    ]
  },
  {
    key: 'estandar', nombre: 'Estándar', icono: '',
    precio: 150000, precioReal: 300000,
    color: '#16A34A', bg: '#F0FDF4', borde: '#16A34A',
    popular: true,
    features: [
      '5 cajas · 15 usuarios · 1 sucursal',
      'Todo lo del plan Básico +',
      'Multi-caja con stock compartido',
      'Facturación DIAN oficial',
      'Crédito a clientes',
      'Promociones y cupones',
      'IA predictiva de ventas',
      'Devoluciones y nómina',
    ]
  },
  {
    key: 'premium', nombre: 'Premium', icono: '',
    precio: 250000, precioReal: 500000,
    color: '#7C3AED', bg: '#F5F3FF', borde: '#7C3AED',
    features: [
      'Cajas · usuarios · sucursales ilimitadas',
      'Todo lo del plan Estándar +',
      ' Cámara IA identifica productos',
      ' Báscula digital integrada',
      'Catálogo online con pago Wompi',
      'Domicilios con rastreo',
      'Modo offline ilimitado',
      'Soporte por videollamada',
    ]
  },
];

const ORDEN = { basico: 0, estandar: 1, premium: 2 };

export default function MiPlan() {
  const { token } = useAuth();
  const [planActual, setPlanActual] = useState('basico');
  const [loading,    setLoading]    = useState(true);
  const [alert,      setAlert]      = useState(null);
  const [confirm,    setConfirm]    = useState(null);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),5000); };

  useEffect(() => {
    apiFetch('/config/', {}, token)
      .then(d => { setPlanActual(d.plan_actual || 'basico'); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const cambiarPlan = async (planKey) => {
    try {
      await apiFetch('/config/', { method:'PUT', body: JSON.stringify({ plan_actual: planKey }) }, token);
      setPlanActual(planKey);
      setConfirm(null);
      showAlert('success', ` Plan actualizado a ${PLANES.find(p=>p.key===planKey)?.nombre}`);
    } catch(e) {
      showAlert('danger', 'Error actualizando el plan');
    }
  };

  const planIdx   = ORDEN[planActual] ?? 0;
  const planInfo  = PLANES.find(p => p.key === planActual) || PLANES[0];

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc' }}>
      <Navbar/>
      <main style={{ marginLeft:240, padding:'24px' }}>

        {alert && (
          <div className={`alert alert-${alert.type} alert-dismissible`}>
            {alert.msg}
            <button className="btn-close" onClick={()=>setAlert(null)}/>
          </div>
        )}

        <div className="mb-4">
          <h4 className="fw-bold mb-0"><i className="bi bi-tag"></i> Mi Plan</h4>
          <small className="text-muted">Gestiona el plan de SmartMerca para tu negocio</small>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
        ) : (
          <>
            {/* Plan actual */}
            <div className="card border-0 shadow-sm mb-4"
              style={{ borderLeft:`5px solid ${planInfo.color}`, background: planInfo.bg }}>
              <div className="card-body d-flex align-items-center gap-4 py-3">
                <div style={{ fontSize:52 }}>{planInfo.icono}</div>
                <div>
                  <div className="text-muted small fw-semibold">PLAN ACTUAL</div>
                  <div className="fw-bold" style={{ fontSize:28, color: planInfo.color }}>{planInfo.nombre}</div>
                  <div className="fw-bold text-success" style={{ fontSize:18 }}>{fmt(planInfo.precio)}/mes</div>
                </div>
                {planActual !== 'premium' && (
                  <div className="ms-auto">
                    <div className="small text-muted mb-1">Precio de lanzamiento — solo 8 cupos</div>
                    <span className="badge" style={{ background:'#f59e0b', fontSize:11 }}>
                      <i className="bi bi-exclamation-triangle"></i> Actualiza antes del 31 de mayo 2026
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Características del plan actual */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header fw-bold" style={{ background:'#1e3a5f', color:'#fff' }}>
                <i className="bi bi-check2-circle"></i> Lo que incluye tu plan {planInfo.nombre}
              </div>
              <div className="card-body">
                <div className="row g-2">
                  {planInfo.features.map((f,i) => (
                    <div key={i} className="col-md-6">
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ color: planInfo.color, fontWeight:'bold' }}>✓</span>
                        <span>{f}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Planes disponibles */}
            <div className="mb-3 fw-bold" style={{ fontSize:18 }}>
              {planActual === 'premium' ? ' Ya tienes el plan máximo' : ' Sube de plan y desbloquea más funciones'}
            </div>

            <div className="row g-3">
              {PLANES.map(p => {
                const esPlanActual = p.key === planActual;
                const esInferior   = ORDEN[p.key] < planIdx;
                const esSuperior   = ORDEN[p.key] > planIdx;

                return (
                  <div key={p.key} className="col-md-4">
                    <div className="card h-100 border-2"
                      style={{
                        borderColor: esPlanActual ? p.color : '#E2E8F0',
                        background: esPlanActual ? p.bg : '#fff',
                        opacity: esInferior ? 0.6 : 1,
                        transform: p.popular ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: p.popular ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
                      }}>

                      {p.popular && !esPlanActual && (
                        <div className="text-center py-1 fw-bold small"
                          style={{ background: p.color, color:'#fff' }}>
                          <i className="bi bi-star"></i> El más elegido
                        </div>
                      )}
                      {esPlanActual && (
                        <div className="text-center py-1 fw-bold small"
                          style={{ background: p.color, color:'#fff' }}>
                          <i className="bi bi-check2-circle"></i> Tu plan actual
                        </div>
                      )}

                      <div className="card-body">
                        <div className="text-center mb-3">
                          <div style={{ fontSize:36 }}>{p.icono}</div>
                          <div className="fw-bold" style={{ fontSize:20, color: p.color }}>{p.nombre}</div>
                          <div className="text-muted small text-decoration-line-through">{fmt(p.precioReal)}/mes</div>
                          <div className="fw-bold" style={{ fontSize:28, color: p.color }}>{fmt(p.precio)}</div>
                          <div className="text-muted small">precio lanzamiento/mes</div>
                        </div>

                        {p.features.map((f,i) => (
                          <div key={i} className="small mb-1 d-flex align-items-start gap-1">
                            <span style={{ color: p.color, minWidth:14 }}>✓</span>
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      <div className="card-footer border-0 bg-transparent pb-3">
                        {esPlanActual ? (
                          <button className="btn w-100 fw-bold" style={{ background: p.color, color:'#fff' }} disabled>
                            <i className="bi bi-check2-circle"></i> Plan actual
                          </button>
                        ) : esInferior ? (
                          <button className="btn btn-outline-secondary w-100" disabled>
                            <i className="bi bi-arrow-down"></i> Plan inferior
                          </button>
                        ) : (
                          <button className="btn w-100 fw-bold"
                            style={{ background: p.color, color:'#fff' }}
                            onClick={() => setConfirm(p)}>
                            <i className="bi bi-arrow-up"></i> Subir a {p.nombre}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Contacto */}
            <div className="card border-0 shadow-sm mt-4" style={{ background:'#1e3a5f' }}>
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <div style={{ fontSize:32 }}><i className="bi bi-envelope"></i></div>
                <div>
                  <div className="fw-bold text-white">¿Necesitas ayuda para elegir tu plan?</div>
                  <div className="text-white-50 small">Escríbenos y te asesoramos sin costo</div>
                </div>
                <a href="https://wa.me/573203308547?text=Hola, quiero información sobre los planes de SmartMerca"
                  target="_blank" rel="noreferrer"
                  className="btn fw-bold ms-auto"
                  style={{ background:'#22c55e', color:'#fff' }}>
                  <i className="bi bi-whatsapp"></i> WhatsApp
                </a>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal confirmar cambio de plan */}
      {confirm && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,0.5)', zIndex:9999 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{ background: confirm.color, color:'#fff' }}>
                <h5 className="modal-title fw-bold">{confirm.icono} Subir al plan {confirm.nombre}</h5>
                <button className="btn-close btn-close-white" onClick={()=>setConfirm(null)}/>
              </div>
              <div className="modal-body text-center py-4">
                <div style={{ fontSize:52 }}>{confirm.icono}</div>
                <div className="fw-bold fs-5 mt-2">Plan {confirm.nombre}</div>
                <div className="fw-bold text-success fs-4">{fmt(confirm.precio)}/mes</div>
                <div className="text-muted small mt-2">precio de lanzamiento</div>
                <hr/>
                <div className="text-muted">
                  Al confirmar, tu plan cambiará a <strong>{confirm.nombre}</strong>.<br/>
                  Un asesor de SmartMerca te contactará para completar el proceso de pago.
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setConfirm(null)}>Cancelar</button>
                <button className="btn fw-bold" style={{ background: confirm.color, color:'#fff' }}
                  onClick={() => cambiarPlan(confirm.key)}>
                  <i className="bi bi-check2-circle"></i> Confirmar subida de plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}