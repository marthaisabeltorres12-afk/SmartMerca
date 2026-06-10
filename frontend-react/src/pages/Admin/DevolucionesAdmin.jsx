import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';

const fmtMoney = (n) => Number(n).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtDate  = (s) => s ? new Date(s).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' }) : '—';

const DevolucionesAdmin = () => {
  const { token } = useAuth();
  const [returns,   setReturns]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [filtroMode,  setFiltroMode]  = useState('todos');
  const [filtroPin,   setFiltroPin]   = useState('todos');
  const [filtroCajero,setFiltroCajero]= useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');

  useEffect(() => {
    fetch('/api/returns/', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { setReturns(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  // Cajeros únicos para el filtro
  const cajeros = [...new Set(returns.map(r => r.cashier).filter(Boolean))];

  // Filtros
  const filtered = returns.filter(r => {
    if (filtroMode   !== 'todos' && r.mode !== filtroMode) return false;
    if (filtroPin    === 'con'   && !r.authorized_by) return false;
    if (filtroPin    === 'sin'   && r.authorized_by)  return false;
    if (filtroCajero && r.cashier !== filtroCajero)  return false;
    if (dateFrom && r.created_at?.slice(0,10) < dateFrom) return false;
    if (dateTo   && r.created_at?.slice(0,10) > dateTo)   return false;
    return true;
  });

  // KPIs
  const totalDinero  = filtered.filter(r => r.mode === 'dinero').reduce((a,r) => a + Number(r.total), 0);
  const totalCambios = filtered.filter(r => r.mode === 'cambio').length;
  const conPin       = filtered.filter(r => r.authorized_by).length;
  const sinPin       = filtered.filter(r => !r.authorized_by).length;

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>

        <h4 className="fw-bold mb-1"><i className="bi bi-arrow-return-left me-2"></i> Devoluciones</h4>
        <p className="text-muted mb-4">Historial completo de devoluciones y cambios de productos</p>

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { label:'Total devoluciones', value: filtered.length,       icon:<i className="bi bi-arrow-return-left" style={{fontSize:22}}></i>, color:'#1e3a5f', bg:'#dbeafe' },
            { label:'Devuelto en dinero', value: fmtMoney(totalDinero), icon:<i className="bi bi-cash" style={{fontSize:22}}></i>, color:'#166534', bg:'#dcfce7' },
            { label:'Cambios de producto',value: totalCambios,          icon:<i className="bi bi-arrow-repeat" style={{fontSize:22}}></i>, color:'#1d4ed8', bg:'#eff6ff' },
            { label:'Con PIN de admin',   value: conPin,                icon:<i className="bi bi-lock-fill" style={{fontSize:22}}></i>, color:'#92400e', bg:'#fef3c7' },
            { label:'Sin PIN (libre)',    value: sinPin,                icon:<i className="bi bi-unlock" style={{fontSize:22}}></i>, color:'#991b1b', bg:'#fee2e2' },
          ].map((k,i) => (
            <div className="col-6 col-md-4 col-lg" key={i}>
              <div className="card border-0 shadow-sm h-100" style={{ borderRadius:12 }}>
                <div className="card-body py-3 px-3" style={{ background: k.bg, borderRadius:12 }}>
                  <div style={{ fontSize:22 }}>{k.icon}</div>
                  <div className="fw-bold mt-1" style={{ color: k.color, fontSize:20 }}>{k.value}</div>
                  <div className="small text-muted">{k.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius:12 }}>
          <div className="card-body py-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-2">
                <label className="form-label small fw-semibold mb-1">Modalidad</label>
                <select className="form-select form-select-sm" value={filtroMode} onChange={e=>setFiltroMode(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="dinero">Dinero</option>
<option value="cambio">Cambio</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold mb-1">Autorización PIN</label>
                <select className="form-select form-select-sm" value={filtroPin} onChange={e=>setFiltroPin(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="con">Con PIN</option>
<option value="sin">Sin PIN</option>
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold mb-1">Cajero</label>
                <select className="form-select form-select-sm" value={filtroCajero} onChange={e=>setFiltroCajero(e.target.value)}>
                  <option value="">Todos</option>
                  {cajeros.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
              </div>
              <div className="col-md-2">
                <button className="btn btn-outline-secondary btn-sm w-100"
                  onClick={() => { setFiltroMode('todos'); setFiltroPin('todos'); setFiltroCajero(''); setDateFrom(''); setDateTo(''); }}>
                  <i className="bi bi-trash me-1"></i> Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Venta</th>
                  <th>Cajero</th>
                  <th>Sucursal</th>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Modalidad</th>
                  <th>Producto a cambio</th>
                  <th>Autorizado por</th>
                  <th className="text-end">Total</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan="12" className="text-center py-5"><div className="spinner-border spinner-border-sm"/></td></tr>
                  : filtered.length === 0
                    ? <tr><td colSpan="12" className="text-center text-muted py-5">
                        <div style={{ fontSize:'2rem' }}><i className="bi bi-inbox me-2"></i></div>
                        Sin devoluciones en este período
                      </td></tr>
                    : filtered.map((r, i) => (
                      <React.Fragment key={r.id}>
                        <tr style={{ background: r.authorized_by ? '#fffbeb' : '' }}>
                          <td><span className="badge bg-secondary">{i+1}</span></td>
                          <td className="fw-bold">#{String(r.sale_id).padStart(6,'0')}</td>
                          <td className="small">{r.cashier}</td>
                          <td className="small">
                            {r.branch_name
                              ? <><i className="bi bi-geo-alt me-1 text-muted"></i>{r.branch_name}</>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td className="small">{r.customer || <span className="text-muted">—</span>}</td>
                          <td className="small text-muted" style={{ maxWidth:120 }}>
                            <span title={r.reason}>{r.reason?.slice(0,25) || '—'}</span>
                          </td>
                          <td>
                            <span className={`badge ${r.mode==='cambio' ? 'bg-info text-dark':'bg-success'}`}>
                              {r.mode==='cambio'
  ? <><i className="bi bi-arrow-repeat me-1"></i>Cambio</>
  : <><i className="bi bi-cash me-1"></i>Dinero</>}
                            </span>
                          </td>
                          <td className="small">
                            {r.exchange_product
                              ? <span className="text-primary fw-semibold">{r.exchange_product}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>
                            {r.authorized_by
                              ? <span className="badge bg-warning text-dark"><i className="bi bi-lock-fill me-1"></i> {r.authorized_by}</span>
                              : <span className="badge bg-light text-muted border"><i className="bi bi-unlock me-1"></i> Sin PIN</span>}
                          </td>
                          <td className="text-end fw-bold text-danger">{fmtMoney(r.total)}</td>
                          <td className="small text-muted">{fmtDate(r.created_at)}</td>
                          <td>
                            <button className="btn btn-outline-secondary btn-sm"
                              onClick={() => setExpanded(expanded===r.id ? null : r.id)}>
                              
<i className={`bi ${expanded===r.id?'bi-chevron-up':'bi-chevron-down'}`}></i>
                            </button>
                          </td>
                        </tr>

                        {/* Detalle expandido */}
                        {expanded === r.id && (
                          <tr>
                            <td colSpan="12" className="p-0">
                              <div className="px-4 py-3" style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                                <div className="row g-3">

                                  {/* Productos devueltos */}
                                  <div className="col-md-5">
                                    <div className="fw-semibold small mb-2"><i className="bi bi-arrow-repeat me-1"></i> Productos devueltos:</div>
                                    <table className="table table-sm table-bordered mb-0" style={{ fontSize:13 }}>
                                      <thead className="table-light">
                                        <tr>
                                          <th>Producto</th>
                                          <th className="text-center">Cantidad</th>
                                          <th className="text-end">Subtotal</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.items?.map((item, j) => (
                                          <tr key={j}>
                                            <td>{item.product_name}</td>
                                            <td className="text-center">{item.quantity}</td>
                                            <td className="text-end text-danger fw-bold">{fmtMoney(item.subtotal)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="table-light">
                                        <tr>
                                          <td colSpan="2" className="text-end fw-bold">Total:</td>
                                          <td className="text-end fw-bold text-danger">{fmtMoney(r.total)}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>

                                  {/* Info adicional */}
                                  <div className="col-md-7">
                                    <div className="row g-2">

                                      {/* Producto a cambio */}
                                      {r.mode === 'cambio' && (
                                        <div className="col-12">
                                          <div className="alert py-2 mb-0" style={{ background:'#eff6ff', border:'1px solid #bfdbfe' }}>
                                            <div className="fw-semibold small mb-1"><i className="bi bi-arrow-repeat me-1"></i> Producto entregado a cambio:</div>
                                            <div className="fw-bold" style={{ color:'#1d4ed8' }}>
                                              {r.exchange_product || <em className="text-muted">No registrado</em>}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* PIN info */}
                                      <div className="col-12">
                                        {r.authorized_by ? (
                                          <div className="alert alert-warning py-2 mb-0">
                                            <div className="fw-semibold small mb-1"><i className="bi bi-lock-fill me-1"></i> Autorización requerida:</div>
                                            <div>Autorizado por: <strong>{r.authorized_by}</strong></div>
                                          </div>
                                        ) : (
                                          <div className="alert alert-light py-2 mb-0 border">
                                            <div className="small text-muted"><i className="bi bi-unlock me-1"></i> Esta devolución no requirió PIN de autorización</div>
                                          </div>
                                        )}
                                      </div>

                                      {/* Datos generales */}
                                      <div className="col-12">
                                        <div className="card border-0" style={{ background:'#f1f5f9', borderRadius:8 }}>
                                          <div className="card-body py-2 px-3" style={{ fontSize:13 }}>
                                            <div className="row">
                                              <div className="col-6">
                                                <div><span className="text-muted">Cajero:</span> <strong>{r.cashier}</strong></div>
                                                <div><span className="text-muted">Cliente:</span> <strong>{r.customer || 'Consumidor Final'}</strong></div>
                                              </div>
                                              <div className="col-6">
                                                <div><span className="text-muted">Fecha:</span> <strong>{fmtDate(r.created_at)}</strong></div>
                                                <div><span className="text-muted">Motivo:</span> <strong>{r.reason || 'No especificado'}</strong></div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Pie con total */}
          {filtered.length > 0 && (
            <div className="card-footer bg-white d-flex justify-content-between align-items-center" style={{ borderRadius:'0 0 12px 12px' }}>
              <span className="text-muted small">{filtered.length} devolución(es)</span>
              <span className="fw-bold text-danger">
                Total devuelto en dinero: {fmtMoney(totalDinero)}
              </span>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default DevolucionesAdmin;