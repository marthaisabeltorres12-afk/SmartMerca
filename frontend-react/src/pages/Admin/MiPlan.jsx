import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt = n => Number(n||0).toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0});

const PLANES = [
  {
    key: 'basico', nombre: 'Básico', precio: 80000, precioReal: 150000,
    color: '#2563EB', bg: '#EFF6FF',
    limites: '1 caja · 3 usuarios · 1 sucursal',
    features: [
      'Ventas con código de barras',
      'Efectivo, Nequi y transferencia',
      'Pago mixto (dos métodos)',
      'Presentaciones, cubetas y packs',
      'Control de stock en tiempo real',
      'Alertas agotados y vencimientos',
      'Cartera / fío',
      'Turnos de caja apertura y cierre',
      'Auditoría completa',
      'Backup de base de datos',
      'Importar productos desde Excel',
      'Modo offline',
    ],
    no: ['Etiquetas', 'Devoluciones', 'Domicilios', 'Promociones y cupones', 'Facturación DIAN', 'Multi-caja'],
  },
  {
    key: 'estandar', nombre: 'Estándar', precio: 150000, precioReal: 300000,
    color: '#16A34A', bg: '#F0FDF4', popular: true,
    limites: '6 cajas · 10 usuarios · 2 sucursales',
    features: [
      'Todo lo del Plan Básico +',
      'Etiquetas y códigos de barras',
      'Devoluciones en dinero o cambio',
      'Domicilios',
      'Promociones y cupones',
      'Órdenes de compra a proveedores',
      'Reportes exportables Excel y PDF',
      'Facturación DIAN',
      'Multi-caja (6 cajas)',
      'Análisis de ventas',
      'Crédito con límite y abonos',
      'Listas de precios por cliente',
      'Roles supervisor y bodeguero',
      'Tarjeta de autorización PIN',
      '2 sucursales',
    ],
    no: ['Sucursales ilimitadas', 'Roles contador y auditor', 'Cámara IA', 'Catálogo QR'],
  },
  {
    key: 'premium', nombre: 'Premium', precio: 250000, precioReal: 500000,
    color: '#7C3AED', bg: '#F5F3FF',
    limites: 'Cajas · usuarios · sucursales ilimitadas',
    features: [
      'Todo lo del Plan Estándar +',
      'Sucursales ilimitadas con panel comparativo',
      'Cajas ilimitadas',
      'Usuarios ilimitados',
      'Roles contador y auditor',
      'Cámara IA frutas y verduras',
      'Catálogo público con QR',
      'Báscula digital integrada',
      'Datáfono integrado',
      'Dashboard financiero avanzado por sucursal',
      'Soporte prioritario con videollamada',
    ],
    no: [],
  },
];

const ORDEN = { basico: 0, estandar: 1, premium: 2 };

export default function MiPlan() {
  const { token } = useAuth();
  const [planActual, setPlanActual] = useState('basico');
  const [planVence,  setPlanVence]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [alert,      setAlert]      = useState(null);
  const [confirm,    setConfirm]    = useState(null);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),5000); };

  useEffect(() => {
    apiFetch('/system-config/', {}, token)
      .then(d => { setPlanActual(d.plan_actual || 'basico'); setPlanVence(d.plan_vence || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const planIdx  = ORDEN[planActual] ?? 0;
  const planInfo = PLANES.find(p => p.key === planActual) || PLANES[0];

  const diasRestantes = planVence
    ? Math.ceil((new Date(planVence) - new Date()) / (1000*60*60*24))
    : null;

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc' }}>
      <Navbar/>
      <main style={{ marginLeft:240, padding:'24px' }}>

        {/* Toast */}
        {alert && (
          <div style={{
            position:'fixed', bottom:28, right:28, zIndex:99999,
            minWidth:340, borderRadius:12, padding:'14px 20px', fontWeight:600,
            background: alert.type==='success'?'#f0fdf4':'#fef2f2',
            color: alert.type==='success'?'#166534':'#991b1b',
            border:`1.5px solid ${alert.type==='success'?'#86efac':'#fca5a5'}`,
            boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
          }}>
            <i className={`bi me-2 ${alert.type==='success'?'bi-check-circle-fill':'bi-x-circle-fill'}`}></i>
            {alert.msg}
          </div>
        )}

        <div className="mb-4">
          <h4 className="fw-bold mb-0"><i className="bi bi-award me-2"></i>Mi Plan</h4>
          <small className="text-muted">Gestiona el plan de SmartMerca para tu negocio</small>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary"/></div>
        ) : (
          <>
            {/* Plan actual */}
            <div className="card border-0 shadow-sm mb-4" style={{ borderLeft:`5px solid ${planInfo.color}`, background: planInfo.bg }}>
              <div className="card-body py-3">
                <div className="d-flex align-items-center gap-4">
                  <div>
                    <div className="text-muted small fw-semibold">PLAN ACTUAL</div>
                    <div className="fw-bold" style={{ fontSize:28, color: planInfo.color }}>Plan {planInfo.nombre}</div>
                    <div className="small text-muted">{planInfo.limites}</div>
                    <div className="fw-bold text-success mt-1" style={{ fontSize:18 }}>{fmt(planInfo.precio)}/mes</div>
                  </div>
                  {planVence && (
                    <div className="ms-auto text-end">
                      <div className="small text-muted">Vence el</div>
                      <div className="fw-bold">{new Date(planVence).toLocaleDateString('es-CO')}</div>
                      {diasRestantes !== null && diasRestantes <= 7 && (
                        <span className={`badge ${diasRestantes <= 0 ? 'bg-danger' : 'bg-warning text-dark'}`}>
                          {diasRestantes <= 0 ? 'Vencido' : `${diasRestantes} días restantes`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lo que incluye */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header fw-bold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                <i className="bi bi-check2-circle me-2"></i>Lo que incluye tu Plan {planInfo.nombre}
              </div>
              <div className="card-body">
                <div className="row g-2">
                  {planInfo.features.map((f,i) => (
                    <div key={i} className="col-md-6">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-check-circle-fill" style={{ color: planInfo.color, flexShrink:0 }}></i>
                        <span className="small">{f}</span>
                      </div>
                    </div>
                  ))}
                  {planInfo.no.map((f,i) => (
                    <div key={'no'+i} className="col-md-6">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-x-circle text-muted" style={{ flexShrink:0 }}></i>
                        <span className="small text-muted">{f}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Planes */}
            {planActual !== 'premium' && (
              <>
                <div className="fw-bold mb-3" style={{ fontSize:18 }}>
                  <i className="bi bi-arrow-up-circle me-2 text-primary"></i>Sube de plan y desbloquea más funciones
                </div>
                <div className="row g-3">
                  {PLANES.map(p => {
                    const esPlanActual = p.key === planActual;
                    const esInferior   = ORDEN[p.key] < planIdx;
                    if (esInferior || esPlanActual) return null;
                    return (
                      <div key={p.key} className="col-md-6">
                        <div className="card h-100 border-2 shadow-sm" style={{ borderColor: p.color }}>
                          {p.popular && (
                            <div className="text-center py-1 fw-bold small" style={{ background: p.color, color:'#fff' }}>
                              <i className="bi bi-star me-1"></i>El más elegido
                            </div>
                          )}
                          <div className="card-body">
                            <div className="fw-bold mb-1" style={{ fontSize:20, color: p.color }}>Plan {p.nombre}</div>
                            <div className="small text-muted mb-2">{p.limites}</div>
                            <div className="text-muted small text-decoration-line-through">{fmt(p.precioReal)}/mes</div>
                            <div className="fw-bold mb-3" style={{ fontSize:26, color: p.color }}>{fmt(p.precio)}<span className="fs-6 text-muted">/mes</span></div>
                            {p.features.map((f,i) => (
                              <div key={i} className="small mb-1 d-flex gap-2">
                                <i className="bi bi-check-circle-fill" style={{ color: p.color, flexShrink:0, marginTop:2 }}></i>
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
                          <div className="card-footer border-0 bg-transparent pb-3">
                            <a href="https://wa.me/573001234567" target="_blank" rel="noreferrer"
                              className="btn w-100 fw-bold" style={{ background: p.color, color:'#fff' }}>
                              <i className="bi bi-whatsapp me-2"></i>Contratar Plan {p.nombre}
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {planActual === 'premium' && (
              <div className="alert border-0 shadow-sm py-3" style={{ background:'#f5f3ff', borderLeft:'5px solid #7c3aed' }}>
                <i className="bi bi-trophy-fill me-2 text-warning"></i>
                <strong>¡Tienes el Plan Premium!</strong> Estás usando todas las funciones de SmartMerca.
              </div>
            )}

            {/* Contacto */}
            <div className="card border-0 shadow-sm mt-4" style={{ background:'#1e3a5f' }}>
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <i className="bi bi-headset text-white" style={{ fontSize:32 }}></i>
                <div>
                  <div className="fw-bold text-white">¿Necesitas ayuda para elegir tu plan?</div>
                  <div className="text-white-50 small">Escríbenos y te asesoramos sin costo</div>
                </div>
                <a href="https://wa.me/573001234567?text=Hola, quiero información sobre los planes de SmartMerca"
                  target="_blank" rel="noreferrer"
                  className="btn fw-bold ms-auto" style={{ background:'#22c55e', color:'#fff' }}>
                  <i className="bi bi-whatsapp me-2"></i>WhatsApp
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}