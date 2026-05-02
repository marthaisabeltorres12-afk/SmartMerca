import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { useLocation } from 'react-router-dom';

const SupervisorDashboard = () => {
  const { token, user } = useAuth();
  const location = useLocation();
  const [ventas,    setVentas]    = useState([]);
  const [productos, setProductos] = useState([]);
  const [clientes,  setClientes]  = useState([]);
  const [alertas,   setAlertas]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [busq,      setBusq]      = useState('');

  const tab = location.pathname.includes('ventas')     ? 'ventas'
            : location.pathname.includes('productos')  ? 'productos'
            : location.pathname.includes('clientes')   ? 'clientes'
            : location.pathname.includes('alertas')    ? 'alertas'
            : location.pathname.includes('analisis')   ? 'analisis'
            : 'dashboard';

  const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');
  const hoy = new Date().toISOString().slice(0,10);

  useEffect(() => {
    Promise.all([
      apiFetch('/sales/',     {}, token).catch(() => []),
      apiFetch('/products/',  {}, token).catch(() => []),
      apiFetch('/customers/', {}, token).catch(() => []),
      apiFetch('/notificaciones/?pendientes=true', {}, token).catch(() => []),
    ]).then(([v, p, c, a]) => {
      setVentas(Array.isArray(v) ? v : v.sales || []);
      setProductos(Array.isArray(p) ? p : []);
      setClientes(Array.isArray(c) ? c : c.customers || []);
      setAlertas(Array.isArray(a) ? a : []);
      setLoading(false);
    });
  }, [token]);

  const ventasHoy   = ventas.filter(v => v.created_at?.slice(0,10) === hoy);
  const totalHoy    = ventasHoy.reduce((a,v) => a + Number(v.total||0), 0);
  const stockBajos  = productos.filter(p => p.is_active && p.stock <= (p.min_stock||5));

  const filtered = {
    ventas:    ventas.filter(v => !busq || v.cashier_name?.toLowerCase().includes(busq.toLowerCase()) || v.customer_name?.toLowerCase().includes(busq.toLowerCase())),
    productos: productos.filter(p => p.is_active && (!busq || p.name?.toLowerCase().includes(busq.toLowerCase()))),
    clientes:  clientes.filter(c => !busq || c.full_name?.toLowerCase().includes(busq.toLowerCase()) || c.doc_number?.includes(busq)),
  };

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{marginLeft:240,minHeight:'100vh'}}>
        <div className="spinner-border text-primary"/>
      </main>
    </div>
  );

  const stats = [
    ['🧾 Ventas hoy',  ventasHoy.length,  'primary'],
    ['💰 Total hoy',   fmt(totalHoy),     'success'],
    ['⚠️ Stock bajo',  stockBajos.length, 'warning'],
    ['👥 Clientes',    clientes.length,   'info'],
  ];

  return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 p-4" style={{marginLeft:240, background:'#f8fafc', minHeight:'100vh'}}>
        <div className="mb-4">
          <h4 className="fw-bold mb-0">👁️ Panel Supervisor</h4>
          <small className="text-muted">Bienvenido, {user?.name} — {new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</small>
        </div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (<>
          <div className="row g-3 mb-4">
            {stats.map(([l,v,c]) => (
              <div key={l} className="col-md-3 col-6">
                <div className={`card border-0 shadow-sm border-start border-${c} border-3`}>
                  <div className="card-body py-3">
                    <div className="text-muted small">{l}</div>
                    <div className={`fw-bold fs-4 text-${c}`}>{v}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="row g-3">
            <div className="col-md-8">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">🧾 Últimas ventas del día</div>
                <div className="table-responsive">
                  <table className="table table-sm mb-0" style={{fontSize:13}}>
                    <thead className="table-light"><tr><th>#</th><th>Hora</th><th>Cajero</th><th>Cliente</th><th>Método</th><th className="text-end">Total</th></tr></thead>
                    <tbody>
                      {ventasHoy.slice(0,8).map(v => (
                        <tr key={v.id}>
                          <td className="text-muted">#{String(v.id).padStart(4,'0')}</td>
                          <td>{v.created_at?.slice(11,16)}</td>
                          <td>{v.cashier||'—'}</td>
                          <td>{v.customer?.full_name||'Consumidor Final'}</td>
                          <td><span className="badge bg-secondary">{v.payment_method||'efectivo'}</span></td>
                          <td className="text-end fw-bold text-success">{fmt(v.total)}</td>
                        </tr>
                      ))}
                      {!ventasHoy.length && <tr><td colSpan={6} className="text-center text-muted py-3">Sin ventas hoy</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm border-warning border-2">
                <div className="card-header fw-semibold text-warning">⚠️ Stock bajo ({stockBajos.length})</div>
                <div style={{maxHeight:280, overflowY:'auto'}}>
                  <table className="table table-sm mb-0" style={{fontSize:12}}>
                    <tbody>
                      {stockBajos.slice(0,10).map(p => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td className="text-end"><span className={`badge ${p.stock<=0?'bg-danger':'bg-warning text-dark'}`}>{p.stock}</span></td>
                        </tr>
                      ))}
                      {!stockBajos.length && <tr><td colSpan={2} className="text-center text-muted py-2">Todo en orden ✅</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </>)}

        {/* VENTAS */}
        {tab === 'ventas' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>🧾 Ventas de hoy — {hoy}</span>
              <div className="d-flex gap-2 align-items-center">
                <input className="form-control form-control-sm" placeholder="🔍 Buscar..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:180}}/>
                <span className="badge bg-success">{fmt(totalHoy)}</span>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>#</th><th>Hora</th><th>Cajero</th><th>Cliente</th><th>Método</th><th className="text-end">Total</th></tr></thead>
                <tbody>
                  {filtered.ventas.filter(v=>v.created_at?.slice(0,10)===hoy).map(v => (
                    <tr key={v.id}>
                      <td className="text-muted">#{String(v.id).padStart(4,'0')}</td>
                      <td>{v.created_at?.slice(11,16)}</td>
                      <td>{v.cashier||'—'}</td>
                      <td>{v.customer?.full_name||'Consumidor Final'}</td>
                      <td><span className="badge bg-secondary">{v.payment_method||'efectivo'}</span></td>
                      <td className="text-end fw-bold text-success">{fmt(v.total)}</td>
                    </tr>
                  ))}
                  {!ventasHoy.length && <tr><td colSpan={6} className="text-center text-muted py-4">Sin ventas hoy</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRODUCTOS */}
        {tab === 'productos' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>📦 Productos — Solo lectura</span>
              <input className="form-control form-control-sm" placeholder="🔍 Buscar..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:200}}/>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>Producto</th><th>Categoría</th><th className="text-end">Precio</th><th className="text-end">Stock</th><th className="text-center">Estado</th></tr></thead>
                <tbody>
                  {filtered.productos.slice(0,100).map(p => (
                    <tr key={p.id}>
                      <td className="fw-semibold">{p.name}</td>
                      <td className="text-muted">{p.category||'—'}</td>
                      <td className="text-end text-success fw-bold">{fmt(p.price)}</td>
                      <td className="text-end"><span className={`badge ${p.stock<=0?'bg-danger':p.stock<=(p.min_stock||5)?'bg-warning text-dark':'bg-success'}`}>{p.stock}</span></td>
                      <td className="text-center"><span className={`badge ${p.is_active?'bg-success':'bg-secondary'}`}>{p.is_active?'Activo':'Inactivo'}</span></td>
                    </tr>
                  ))}
                  {!filtered.productos.length && <tr><td colSpan={5} className="text-center text-muted py-4">Sin resultados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CLIENTES */}
        {tab === 'clientes' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
              <span>👥 Clientes ({filtered.clientes.length})</span>
              <input className="form-control form-control-sm" placeholder="🔍 Nombre o documento..." value={busq} onChange={e=>setBusq(e.target.value)} style={{width:220}}/>
            </div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light"><tr><th>Nombre</th><th>Documento</th><th>Teléfono</th><th className="text-end">Puntos</th><th className="text-end">Total compras</th></tr></thead>
                <tbody>
                  {filtered.clientes.slice(0,100).map(c => (
                    <tr key={c.id}>
                      <td className="fw-semibold">{c.full_name}</td>
                      <td className="text-muted">{c.doc_type} {c.doc_number}</td>
                      <td>{c.phone||'—'}</td>
                      <td className="text-end"><span className="badge bg-warning text-dark">⭐ {c.points||0}</span></td>
                      <td className="text-end fw-bold text-success">{fmt(c.total_purchases||0)}</td>
                    </tr>
                  ))}
                  {!filtered.clientes.length && <tr><td colSpan={5} className="text-center text-muted py-4">Sin resultados</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ALERTAS */}
        {tab === 'alertas' && (
          <div className="row g-3">
            <div className="col-12">
              <div className="card border-0 shadow-sm border-warning border-2">
                <div className="card-header fw-semibold text-warning">⚠️ Stock bajo ({stockBajos.length} productos)</div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0" style={{fontSize:13}}>
                    <thead className="table-light"><tr><th>Producto</th><th>Categoría</th><th className="text-end">Stock actual</th><th className="text-end">Mínimo</th></tr></thead>
                    <tbody>
                      {stockBajos.map(p => (
                        <tr key={p.id}>
                          <td className="fw-semibold">{p.name}</td>
                          <td className="text-muted">{p.category||'—'}</td>
                          <td className="text-end"><span className={`badge ${p.stock<=0?'bg-danger':'bg-warning text-dark'}`}>{p.stock}</span></td>
                          <td className="text-end text-muted">{p.min_stock||5}</td>
                        </tr>
                      ))}
                      {!stockBajos.length && <tr><td colSpan={4} className="text-center text-success py-3">✅ Todo el stock en orden</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-12">
              <div className="card border-0 shadow-sm border-danger border-2">
                <div className="card-header fw-semibold text-danger">🔔 Notificaciones pendientes ({alertas.length})</div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0" style={{fontSize:13}}>
                    <thead className="table-light"><tr><th>Tipo</th><th>Título</th><th>Mensaje</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {alertas.map(a => (
                        <tr key={a.id}>
                          <td><span className="badge bg-secondary">{a.tipo}</span></td>
                          <td className="fw-semibold">{a.titulo}</td>
                          <td className="text-muted">{a.mensaje||'—'}</td>
                          <td className="text-muted">{a.created_at?.slice(0,16).replace('T',' ')}</td>
                        </tr>
                      ))}
                      {!alertas.length && <tr><td colSpan={4} className="text-center text-success py-3">✅ Sin alertas pendientes</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANÁLISIS */}
        {tab === 'analisis' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold">📈 Análisis de ventas</div>
            <div className="card-body">
              <div className="row g-3 mb-4">
                {['efectivo','tarjeta','transferencia','credito'].map(m => {
                  const vM = ventas.filter(v=>(v.payment_method||'efectivo')===m);
                  const tot = vM.reduce((a,v)=>a+Number(v.total||0),0);
                  if (!vM.length) return null;
                  return (
                    <div key={m} className="col-md-3 col-6">
                      <div className="card border-0 bg-light">
                        <div className="card-body py-3 text-center">
                          <div className="text-muted small text-capitalize">{m}</div>
                          <div className="fw-bold fs-5 text-success">{fmt(tot)}</div>
                          <div className="text-muted" style={{fontSize:11}}>{vM.length} ventas</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="table-responsive">
                <table className="table table-sm mb-0" style={{fontSize:13}}>
                  <thead className="table-light"><tr><th>Fecha</th><th>Ventas</th><th className="text-end">Total</th></tr></thead>
                  <tbody>
                    {Object.entries(
                      ventas.reduce((acc,v) => {
                        const d = v.created_at?.slice(0,10)||'—';
                        if (!acc[d]) acc[d] = { count:0, total:0 };
                        acc[d].count++; acc[d].total += Number(v.total||0);
                        return acc;
                      }, {})
                    ).sort(([a],[b])=>b.localeCompare(a)).slice(0,10).map(([d,s]) => (
                      <tr key={d}>
                        <td className="fw-semibold">{d}</td>
                        <td><span className="badge bg-primary">{s.count}</span></td>
                        <td className="text-end fw-bold text-success">{fmt(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SupervisorDashboard;