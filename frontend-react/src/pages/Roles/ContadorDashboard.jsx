import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { useLocation } from 'react-router-dom';

const ContadorDashboard = () => {
  const { token, user } = useAuth();
  const location = useLocation();
  const [ventas,     setVentas]     = useState([]);
  const [finanzas,   setFinanzas]   = useState(null);
  const [nomina,     setNomina]     = useState([]);
  const [empleados,  setEmpleados]  = useState([]);
  const [facturas,   setFacturas]   = useState([]);
  const [auditoria,  setAuditoria]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busq,       setBusq]       = useState('');

  const tab = location.pathname.includes('finanzas')  ? 'finanzas'
            : location.pathname.includes('ventas')    ? 'ventas'
            : location.pathname.includes('nomina')    ? 'nomina'
            : location.pathname.includes('cuentas')   ? 'cuentas'
            : location.pathname.includes('auditoria') ? 'auditoria'
            : 'dashboard';

  const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');
  const hoy = new Date().toISOString().slice(0,10);

  useEffect(() => {
    Promise.all([
      apiFetch('/sales/',             {}, token).catch(() => []),
      apiFetch('/finance/summary',    {}, token).catch(() => null),
      apiFetch('/payroll/periods',    {}, token).catch(() => []),
      apiFetch('/payroll/employees',  {}, token).catch(() => []),
      apiFetch('/supplier-invoices/', {}, token).catch(() => []),
      apiFetch('/audit/',             {}, token).catch(() => []),
    ]).then(([v, f, n, e, fac, a]) => {
      setVentas(Array.isArray(v) ? v : v.sales || []);
      setFinanzas(f);
      setNomina(Array.isArray(n) ? n : []);
      setEmpleados(Array.isArray(e) ? e : []);
      setFacturas(Array.isArray(fac) ? fac : fac.invoices || []);
      setAuditoria(Array.isArray(a) ? a : a.logs || []);
      setLoading(false);
    });
  }, [token]);

  const ventasHoy = ventas.filter(v => v.created_at?.slice(0,10) === hoy);
  const totalHoy  = ventasHoy.reduce((a,v) => a + Number(v.total||0), 0);
  const totalMes  = ventas.filter(v => v.created_at?.slice(0,7) === hoy.slice(0,7))
                          .reduce((a,v) => a + Number(v.total||0), 0);
  const cuentasPend = facturas.filter(f => f.estado === 'pendiente' || f.balance_pendiente > 0);

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
        <div className="mb-4">
          <h4 className="fw-bold mb-0">📊 Panel Contador</h4>
          <small className="text-muted">Bienvenido, {user?.name}</small>
        </div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (<>
          <div className="row g-3 mb-4">
            {[
              ['💰 Ventas hoy',       fmt(totalHoy),        'success'],
              ['📅 Ventas del mes',   fmt(totalMes),        'primary'],
              ['🧾 Transacciones',    ventasHoy.length,     'info'],
              ['⚠️ Cuentas por pagar',cuentasPend.length,   'danger'],
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
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header fw-semibold">💳 Ventas por método de pago hoy</div>
                <div className="card-body">
                  {['efectivo','tarjeta','transferencia','credito','mixto'].map(m => {
                    const vM = ventasHoy.filter(v=>(v.payment_method||'efectivo')===m);
                    if (!vM.length) return null;
                    const tot = vM.reduce((a,v)=>a+Number(v.total||0),0);
                    return (
                      <div key={m} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <span className="text-capitalize fw-semibold">{m}</span>
                        <div className="text-end">
                          <div className="fw-bold text-success">{fmt(tot)}</div>
                          <div className="text-muted" style={{fontSize:11}}>{vM.length} venta(s)</div>
                        </div>
                      </div>
                    );
                  })}
                  {!ventasHoy.length && <p className="text-muted text-center py-3 mb-0">Sin ventas hoy</p>}
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header fw-semibold">👤 Últimos períodos de nómina</div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{fontSize:13}}>
                    <thead className="table-light"><tr><th>Período</th><th>Estado</th><th className="text-end">Total neto</th></tr></thead>
                    <tbody>
                      {nomina.slice(0,5).map(n => (
                        <tr key={n.id}>
                          <td>{n.nombre||`Período ${n.id}`}</td>
                          <td><span className={`badge ${n.estado==='pagado'?'bg-success':n.estado==='aprobado'?'bg-primary':'bg-warning text-dark'}`}>{n.estado}</span></td>
                          <td className="text-end fw-bold">{fmt(n.total_neto||0)}</td>
                        </tr>
                      ))}
                      {!nomina.length && <tr><td colSpan={3} className="text-center text-muted py-3">Sin períodos de nómina</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>)}

        {/* FINANZAS */}
        {tab === 'finanzas' && (<>
          <div className="row g-3 mb-4">
            {[
              ['💰 Total ventas mes',  fmt(totalMes),    'success'],
              ['🧾 Ventas hoy',        fmt(totalHoy),    'primary'],
              ['📋 Cuentas pendientes',fmt(cuentasPend.reduce((a,f)=>a+Number(f.balance_pendiente||0),0)), 'danger'],
              ['📊 Transacciones mes', ventas.filter(v=>v.created_at?.slice(0,7)===hoy.slice(0,7)).length, 'info'],
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
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>💰 Ventas por día</span>
              <input className="form-control form-control-sm" placeholder="🔍 Buscar cajero..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:200}}/>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>Fecha</th><th className="text-center">Transacciones</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {Object.entries(
                    ventas.reduce((acc,v) => {
                      const d = v.created_at?.slice(0,10)||'—';
                      if (!acc[d]) acc[d] = { count:0, total:0 };
                      acc[d].count++; acc[d].total += Number(v.total||0);
                      return acc;
                    }, {})
                  ).sort(([a],[b])=>b.localeCompare(a)).slice(0,30).map(([d,s]) => (
                    <tr key={d}>
                      <td className="fw-semibold">{d}</td>
                      <td className="text-center"><span className="badge bg-primary">{s.count}</span></td>
                      <td className="text-end fw-bold text-success">{fmt(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>)}

        {/* VENTAS */}
        {tab === 'ventas' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>🧾 Historial de ventas</span>
              <div className="d-flex gap-2 align-items-center">
                <input className="form-control form-control-sm" placeholder="🔍 Buscar..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:180}}/>
                <span className="badge bg-success">{fmt(totalMes)} este mes</span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>#</th><th>Fecha</th><th>Cajero</th><th>Cliente</th><th>Método</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {ventas.filter(v=>!busq||v.cashier_name?.toLowerCase().includes(busq.toLowerCase())||v.customer_name?.toLowerCase().includes(busq.toLowerCase())).slice(0,100).map(v => (
                    <tr key={v.id}>
                      <td className="text-muted">#{String(v.id).padStart(4,'0')}</td>
                      <td>{v.created_at?.slice(0,16).replace('T',' ')}</td>
                      <td>{v.cashier_name||v.cashier||'—'}</td>
                      <td>{v.customer_name||'Consumidor Final'}</td>
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

        {/* NÓMINA */}
        {tab === 'nomina' && (
          <div className="row g-4">
            <div className="col-md-5">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">👥 Empleados ({empleados.length})</div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{fontSize:13}}>
                    <thead className="table-light"><tr><th>Nombre</th><th>Cargo</th><th className="text-end">Salario base</th></tr></thead>
                    <tbody>
                      {empleados.map(e => (
                        <tr key={e.id}>
                          <td className="fw-semibold">{e.nombre}</td>
                          <td className="text-muted">{e.cargo||'—'}</td>
                          <td className="text-end text-success fw-bold">{fmt(e.salario_base)}</td>
                        </tr>
                      ))}
                      {!empleados.length && <tr><td colSpan={3} className="text-center text-muted py-3">Sin empleados registrados</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-md-7">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">📋 Períodos de nómina</div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{fontSize:13}}>
                    <thead className="table-light"><tr><th>Período</th><th>Inicio</th><th>Fin</th><th>Estado</th><th className="text-end">Total neto</th></tr></thead>
                    <tbody>
                      {nomina.map(n => (
                        <tr key={n.id}>
                          <td className="fw-semibold">{n.nombre||`Período ${n.id}`}</td>
                          <td>{n.fecha_inicio?.slice(0,10)||'—'}</td>
                          <td>{n.fecha_fin?.slice(0,10)||'—'}</td>
                          <td><span className={`badge ${n.estado==='pagado'?'bg-success':n.estado==='aprobado'?'bg-primary':'bg-warning text-dark'}`}>{n.estado}</span></td>
                          <td className="text-end fw-bold text-success">{fmt(n.total_neto||0)}</td>
                        </tr>
                      ))}
                      {!nomina.length && <tr><td colSpan={5} className="text-center text-muted py-3">Sin períodos de nómina</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUENTAS POR PAGAR */}
        {tab === 'cuentas' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>🏦 Cuentas por pagar ({cuentasPend.length} pendientes)</span>
              <span className="badge bg-danger">{fmt(cuentasPend.reduce((a,f)=>a+Number(f.balance_pendiente||0),0))}</span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>Proveedor</th><th>Factura</th><th>Fecha</th><th>Estado</th><th className="text-end">Total</th><th className="text-end">Pendiente</th></tr></thead>
                <tbody>
                  {facturas.slice(0,100).map(f => (
                    <tr key={f.id}>
                      <td className="fw-semibold">{f.supplier_name||f.proveedor||'—'}</td>
                      <td className="text-muted">{f.numero_factura||f.invoice_number||'—'}</td>
                      <td>{f.fecha?.slice(0,10)||f.created_at?.slice(0,10)||'—'}</td>
                      <td><span className={`badge ${f.estado==='pagado'?'bg-success':f.estado==='parcial'?'bg-warning text-dark':'bg-danger'}`}>{f.estado||'pendiente'}</span></td>
                      <td className="text-end fw-bold">{fmt(f.total||0)}</td>
                      <td className="text-end fw-bold text-danger">{fmt(f.balance_pendiente||0)}</td>
                    </tr>
                  ))}
                  {!facturas.length && <tr><td colSpan={6} className="text-center text-muted py-4">Sin facturas</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDITORÍA */}
        {tab === 'auditoria' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>🔍 Logs de auditoría</span>
              <input className="form-control form-control-sm" placeholder="🔍 Buscar..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:220}}/>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Descripción</th></tr></thead>
                <tbody>
                  {auditoria.filter(a=>!busq||a.user_name?.toLowerCase().includes(busq.toLowerCase())||a.descripcion?.toLowerCase().includes(busq.toLowerCase())).slice(0,100).map((a,i) => (
                    <tr key={i}>
                      <td className="text-muted">{a.fecha_hora?.slice(0,16).replace('T',' ')}</td>
                      <td className="fw-semibold">{a.usuario_nombre||'—'}</td>
                      <td><span className="badge bg-secondary">{a.rol||'—'}</span></td>
                      <td><span className={`badge ${a.accion==='eliminar'?'bg-danger':a.accion==='crear'?'bg-success':a.accion==='editar'?'bg-warning text-dark':'bg-secondary'}`}>{a.accion||'—'}</span></td>
                      <td className="text-muted">{a.descripcion||'—'}</td>
                    </tr>
                  ))}
                  {!auditoria.length && <tr><td colSpan={5} className="text-center text-muted py-4">Sin registros</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ContadorDashboard;