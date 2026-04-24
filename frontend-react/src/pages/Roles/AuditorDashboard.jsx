import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { useLocation } from 'react-router-dom';

const AuditorDashboard = () => {
  const { token, user } = useAuth();
  const location = useLocation();
  const [auditoria,   setAuditoria]   = useState([]);
  const [ventas,      setVentas]      = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [busq,        setBusq]        = useState('');

  const tab = location.pathname.includes('logs')       ? 'logs'
            : location.pathname.includes('ventas')     ? 'ventas'
            : location.pathname.includes('inventario') ? 'inventario'
            : 'dashboard';

  const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');
  const hoy = new Date().toISOString().slice(0,10);

  useEffect(() => {
    Promise.all([
      apiFetch('/audit/',              {}, token).catch(() => []),
      apiFetch('/sales/',              {}, token).catch(() => []),
      apiFetch('/inventory/movements', {}, token).catch(() => []),
    ]).then(([a, v, m]) => {
      setAuditoria(Array.isArray(a) ? a : a.logs || []);
      setVentas(Array.isArray(v) ? v : v.sales || []);
      setMovimientos(Array.isArray(m) ? m : m.movements || []);
      setLoading(false);
    });
  }, [token]);

  const ventasHoy = ventas.filter(v => v.created_at?.slice(0,10) === hoy);
  const totalHoy  = ventasHoy.reduce((a,v) => a + Number(v.total||0), 0);
  const logsHoy   = auditoria.filter(a => a.fecha_hora?.slice(0,10) === hoy);

  const auditFilt = auditoria.filter(a =>
    !busq ||
    a.user_name?.toLowerCase().includes(busq.toLowerCase()) ||
    a.accion?.toLowerCase().includes(busq.toLowerCase()) ||
    a.descripcion?.toLowerCase().includes(busq.toLowerCase()) ||
    a.user_role?.toLowerCase().includes(busq.toLowerCase())
  );

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{marginLeft:240,minHeight:'100vh'}}>
        <div className="spinner-border text-primary"/>
      </main>
    </div>
  );

  return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 p-4" style={{marginLeft:240, background:'#f8fafc', minHeight:'100vh'}}>
        <div className="mb-4 d-flex align-items-center gap-3">
          <div>
            <h4 className="fw-bold mb-0">🔍 Panel Auditor</h4>
            <small className="text-muted">{user?.name} — Solo lectura</small>
          </div>
          <span className="badge bg-secondary">🔒 Solo lectura</span>
        </div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (<>
          <div className="row g-3 mb-4">
            {[
              ['🧾 Ventas hoy',   ventasHoy.length,   'primary'],
              ['💰 Total hoy',    fmt(totalHoy),       'success'],
              ['📋 Logs hoy',     logsHoy.length,      'info'],
              ['📦 Movimientos',  movimientos.length,  'warning'],
            ].map(([l,v,c]) => (
              <div key={l} className="col-md-3 col-6">
                <div className={`card border-0 shadow-sm border-start border-${c} border-3`}>
                  <div className="card-body py-3">
                    <div className="text-muted small">{l}</div>
                    <div className={`fw-bold fs-5 text-${c}`}>{v}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="row g-3">
            <div className="col-md-7">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">🔍 Últimas acciones del sistema</div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{fontSize:13}}>
                    <thead className="table-light"><tr><th>Hora</th><th>Usuario</th><th>Acción</th><th>Descripción</th></tr></thead>
                    <tbody>
                      {auditoria.slice(0,8).map((a,i) => (
                        <tr key={i}>
                          <td className="text-muted">{a.created_at?.slice(11,16)}</td>
                          <td className="fw-semibold">{a.usuario_nombre||'—'}</td>
                          <td><span className={`badge ${a.accion==='eliminar'?'bg-danger':a.accion==='crear'?'bg-success':a.accion==='editar'?'bg-warning text-dark':'bg-secondary'}`}>{a.accion||'—'}</span></td>
                          <td className="text-muted" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.descripcion||'—'}</td>
                        </tr>
                      ))}
                      {!auditoria.length && <tr><td colSpan={4} className="text-center text-muted py-3">Sin registros</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-md-5">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header fw-semibold">📊 Acciones por tipo hoy</div>
                <div className="card-body">
                  {['crear','editar','eliminar','login','otro'].map(tipo => {
                    const count = logsHoy.filter(a=>(a.accion||'otro')===tipo).length;
                    if (!count) return null;
                    const colors = {crear:'success',editar:'warning',eliminar:'danger',login:'info',otro:'secondary'};
                    return (
                      <div key={tipo} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <span className="text-capitalize fw-semibold">{tipo}</span>
                        <span className={`badge bg-${colors[tipo]||'secondary'}`}>{count}</span>
                      </div>
                    );
                  })}
                  {!logsHoy.length && <p className="text-muted text-center py-3 mb-0">Sin actividad hoy</p>}
                </div>
              </div>
            </div>
          </div>
        </>)}

        {/* LOGS */}
        {tab === 'logs' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>🛡️ Logs del sistema ({auditFilt.length})</span>
              <input className="form-control form-control-sm" placeholder="🔍 Usuario, acción, descripción..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:260}}/>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Descripción</th></tr></thead>
                <tbody>
                  {auditFilt.slice(0,200).map((a,i) => (
                    <tr key={i}>
                      <td className="text-muted">{a.fecha_hora?.slice(0,16).replace('T',' ')}</td>
                      <td className="fw-semibold">{a.usuario_nombre||'—'}</td>
                      <td><span className="badge bg-secondary" style={{fontSize:10}}>{a.rol||'—'}</span></td>
                      <td><span className={`badge ${a.accion==='eliminar'?'bg-danger':a.accion==='crear'?'bg-success':a.accion==='editar'?'bg-warning text-dark':'bg-secondary'}`}>{a.accion||'—'}</span></td>
                      <td>{a.descripcion||'—'}</td>
                    </tr>
                  ))}
                  {!auditFilt.length && <tr><td colSpan={5} className="text-center text-muted py-4">Sin registros</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VENTAS — solo lectura */}
        {tab === 'ventas' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>🧾 Ventas <span className="badge bg-secondary ms-2">Solo lectura</span></span>
              <div className="d-flex gap-2 align-items-center">
                <input className="form-control form-control-sm" placeholder="🔍 Buscar cajero..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:180}}/>
                <span className="badge bg-success">{fmt(totalHoy)} hoy</span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>#</th><th>Fecha</th><th>Cajero</th><th>Cliente</th><th>Método</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {ventas.filter(v=>!busq||v.cashier_name?.toLowerCase().includes(busq.toLowerCase())).slice(0,100).map(v => (
                    <tr key={v.id}>
                      <td className="text-muted">#{String(v.id).padStart(4,'0')}</td>
                      <td>{v.created_at?.slice(0,16).replace('T',' ')}</td>
                      <td>{v.cashier||'—'}</td>
                      <td>{v.customer?.full_name||'Consumidor Final'}</td>
                      <td><span className="badge bg-secondary">{v.payment_method||'efectivo'}</span></td>
                      <td className="text-end fw-bold text-success">{fmt(v.total)}</td>
                    </tr>
                  ))}
                  {!ventas.length && <tr><td colSpan={6} className="text-center text-muted py-4">Sin ventas</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MOVIMIENTOS INVENTARIO — solo lectura */}
        {tab === 'inventario' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>📦 Movimientos de inventario <span className="badge bg-secondary ms-2">Solo lectura</span></span>
              <input className="form-control form-control-sm" placeholder="🔍 Buscar producto..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:200}}/>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="text-center">Cantidad</th><th>Razón</th></tr></thead>
                <tbody>
                  {movimientos.filter(m=>!busq||m.product_name?.toLowerCase().includes(busq.toLowerCase())).slice(0,100).map((m,i) => (
                    <tr key={i}>
                      <td className="text-muted">{m.created_at?.slice(0,16).replace('T',' ')}</td>
                      <td className="fw-semibold">{m.product_name||'—'}</td>
                      <td><span className={`badge ${m.type==='entrada'?'bg-success':'bg-danger'}`}>{m.type}</span></td>
                      <td className="text-center fw-bold">{m.quantity}</td>
                      <td className="text-muted">{m.reason||'—'}</td>
                    </tr>
                  ))}
                  {!movimientos.length && <tr><td colSpan={5} className="text-center text-muted py-4">Sin movimientos</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AuditorDashboard;