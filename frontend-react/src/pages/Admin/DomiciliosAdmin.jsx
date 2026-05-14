import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt    = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtDate = iso => iso ? new Date(iso).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';

const ESTADOS = {
  pendiente:  { label:'⏳ Pendiente',   color:'warning', bg:'#fffbeb' },
  asignado:   { label:'👤 Asignado',    color:'info',    bg:'#eff6ff' },
  en_camino:  { label:'🛵 En camino',   color:'primary', bg:'#eff6ff' },
  entregado:  { label:'✅ Entregado',   color:'success', bg:'#f0fdf4' },
  cancelado:  { label:'❌ Cancelado',   color:'danger',  bg:'#fff5f5' },
};

const DomiciliosAdmin = () => {
  const { token } = useAuth();
  const [pedidos,        setPedidos]        = useState([]);
  const [domiciliarios,  setDomiciliarios]  = useState([]);
  const [stats,          setStats]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState('pedidos');
  const [filtroEstado,   setFiltroEstado]   = useState('');
  const [showNuevo,      setShowNuevo]      = useState(false);
  const [showNuevoDom,   setShowNuevoDom]   = useState(false);
  const [alert,          setAlert]          = useState(null);
  const [pedidoDetalle,  setPedidoDetalle]  = useState(null);

  // Formulario nuevo pedido
  const [form, setForm] = useState({
    cliente_nombre:'', cliente_telefono:'', cliente_direccion:'',
    cliente_referencia:'', metodo_pago:'efectivo', valor_domicilio:3000,
    notas:'', items:[{ product_id:'', product_name:'', quantity:1, price:0 }]
  });

  // Formulario nuevo domiciliario
  const [formDom, setFormDom] = useState({ nombre:'', telefono:'', documento:'', vehiculo:'moto', placa:'' });

  const showMsg = (type, msg) => { setAlert({ type, msg }); setTimeout(() => setAlert(null), 4000); };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, s] = await Promise.all([
        apiFetch('/domicilios/' + (filtroEstado ? `?estado=${filtroEstado}` : ''), {}, token),
        apiFetch('/domicilios/domiciliarios', {}, token),
        apiFetch('/domicilios/stats', {}, token),
      ]);
      setPedidos(Array.isArray(p) ? p : []);
      setDomiciliarios(Array.isArray(d) ? d : []);
      setStats(s);
    } catch(e) { showMsg('danger', e.message); }
    finally { setLoading(false); }
  }, [token, filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  // Auto-refresh cada 30s
  useEffect(() => {
    const interval = setInterval(cargar, 30000);
    return () => clearInterval(interval);
  }, [cargar]);

  const cambiarEstado = async (id, estado, domiciliario_id = null) => {
    try {
      await apiFetch(`/domicilios/${id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ estado, domiciliario_id }),
      }, token);
      cargar();
    } catch(e) { showMsg('danger', e.message); }
  };

  const crearPedido = async () => {
    if (!form.cliente_nombre || !form.cliente_telefono || !form.cliente_direccion) {
      showMsg('danger', 'Nombre, teléfono y dirección son obligatorios'); return;
    }
    try {
      await apiFetch('/domicilios/', {
        method: 'POST',
        body: JSON.stringify(form),
      }, token);
      showMsg('success', 'Pedido creado correctamente');
      setShowNuevo(false);
      setForm({ cliente_nombre:'', cliente_telefono:'', cliente_direccion:'', cliente_referencia:'', metodo_pago:'efectivo', valor_domicilio:3000, notas:'', items:[{ product_id:'', product_name:'', quantity:1, price:0 }] });
      cargar();
    } catch(e) { showMsg('danger', e.message); }
  };

  const crearDomiciliario = async () => {
    if (!formDom.nombre || !formDom.telefono) { showMsg('danger', 'Nombre y teléfono son obligatorios'); return; }
    try {
      await apiFetch('/domicilios/domiciliarios', { method:'POST', body: JSON.stringify(formDom) }, token);
      showMsg('success', 'Domiciliario registrado');
      setShowNuevoDom(false);
      setFormDom({ nombre:'', telefono:'', documento:'', vehiculo:'moto', placa:'' });
      cargar();
    } catch(e) { showMsg('danger', e.message); }
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>

        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold mb-0">🛵 Módulo de Domicilios</h4>
            <small className="text-muted">Gestión de pedidos y domiciliarios</small>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={cargar}>🔄</button>
            <button className="btn btn-success btn-sm fw-bold" onClick={() => setShowNuevo(true)}>
              + Nuevo pedido
            </button>
          </div>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2 mb-3`}>{alert.msg}</div>}

        {/* KPIs */}
        {stats && (
          <div className="row g-3 mb-4">
            {[
              { icon:'📦', label:'Pedidos hoy',    val: stats.hoy_total,      color:'primary' },
              { icon:'✅', label:'Entregados hoy', val: stats.hoy_entregados, color:'success' },
              { icon:'⏳', label:'En curso',       val: stats.pendientes,     color:'warning' },
              { icon:'💰', label:'Ingresos hoy',   val: fmt(stats.ingresos_hoy), color:'success', isMoney: true },
            ].map((k,i) => (
              <div key={i} className="col-6 col-md-3">
                <div className={`card border-0 shadow-sm border-start border-${k.color} border-3`}>
                  <div className="card-body py-3">
                    <div className="text-muted small">{k.icon} {k.label}</div>
                    <div className={`fw-bold fs-5 text-${k.color}`}>{k.val}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button className={`nav-link ${tab==='pedidos'?'active fw-bold':''}`} onClick={()=>setTab('pedidos')}>
              📋 Pedidos
              {stats?.pendientes > 0 && <span className="badge bg-warning text-dark ms-1">{stats.pendientes}</span>}
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab==='domiciliarios'?'active fw-bold':''}`} onClick={()=>setTab('domiciliarios')}>
              🧑 Domiciliarios
            </button>
          </li>
        </ul>

        {/* ── PEDIDOS ── */}
        {tab === 'pedidos' && (
          <div>
            {/* Filtros */}
            <div className="d-flex gap-2 mb-3 flex-wrap">
              {['', 'pendiente','asignado','en_camino','entregado','cancelado'].map(e => (
                <button key={e} className={`btn btn-sm ${filtroEstado===e?'btn-dark':'btn-outline-secondary'}`}
                  style={{ borderRadius:20, fontSize:12 }}
                  onClick={() => setFiltroEstado(e)}>
                  {e ? ESTADOS[e]?.label : 'Todos'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-4"><div className="spinner-border text-primary"/></div>
            ) : !pedidos.length ? (
              <div className="text-center py-5 text-muted">
                <div style={{fontSize:48}}>🛵</div>
                <div className="mt-2">No hay pedidos {filtroEstado ? `con estado "${filtroEstado}"` : ''}</div>
              </div>
            ) : (
              <div className="row g-3">
                {pedidos.map(p => {
                  const est = ESTADOS[p.estado] || ESTADOS.pendiente;
                  return (
                    <div key={p.id} className="col-md-6">
                      <div className="card border-0 shadow-sm" style={{ borderLeft:`4px solid var(--bs-${est.color})`, background: est.bg }}>
                        <div className="card-body">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <div className="fw-bold">{p.numero_pedido}</div>
                              <div className="text-muted small">{fmtDate(p.created_at)}</div>
                            </div>
                            <span className={`badge bg-${est.color} ${est.color==='warning'?'text-dark':''}`}>
                              {est.label}
                            </span>
                          </div>

                          <div className="mb-2">
                            <div className="fw-semibold">{p.cliente_nombre}</div>
                            <div className="text-muted small">📱 {p.cliente_telefono}</div>
                            <div className="text-muted small">📍 {p.cliente_direccion}</div>
                            {p.cliente_referencia && <div className="text-muted small">💬 {p.cliente_referencia}</div>}
                          </div>

                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <span className="fw-bold text-success">{fmt(p.total)}</span>
                              {p.valor_domicilio > 0 && <span className="text-muted small ms-1">(+{fmt(p.valor_domicilio)} domicilio)</span>}
                            </div>
                            <span className="badge bg-secondary text-capitalize">{p.metodo_pago}</span>
                          </div>

                          {p.domiciliario && (
                            <div className="mb-2 p-2 rounded" style={{background:'rgba(0,0,0,0.05)'}}>
                              <div className="small fw-semibold">🧑 {p.domiciliario.nombre}</div>
                              <div className="small text-muted">📱 {p.domiciliario.telefono}</div>
                            </div>
                          )}

                          {/* Acciones según estado */}
                          <div className="d-flex gap-2 flex-wrap mt-2">
                            {p.estado === 'pendiente' && (
                              <select className="form-select form-select-sm"
                                onChange={e => e.target.value && cambiarEstado(p.id, 'asignado', parseInt(e.target.value))}>
                                <option value="">👤 Asignar domiciliario...</option>
                                {domiciliarios.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                              </select>
                            )}
                            {p.estado === 'asignado' && (
                              <button className="btn btn-primary btn-sm" onClick={() => cambiarEstado(p.id, 'en_camino')}>
                                🛵 Marcar en camino
                              </button>
                            )}
                            {p.estado === 'en_camino' && (
                              <button className="btn btn-success btn-sm fw-bold" onClick={() => cambiarEstado(p.id, 'entregado')}>
                                ✅ Marcar entregado
                              </button>
                            )}
                            {!['entregado','cancelado'].includes(p.estado) && (
                              <button className="btn btn-outline-danger btn-sm" onClick={() => cambiarEstado(p.id, 'cancelado')}>
                                ❌ Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DOMICILIARIOS ── */}
        {tab === 'domiciliarios' && (
          <div>
            <div className="d-flex justify-content-end mb-3">
              <button className="btn btn-success btn-sm fw-bold" onClick={() => setShowNuevoDom(true)}>
                + Registrar domiciliario
              </button>
            </div>
            <div className="row g-3">
              {domiciliarios.map(d => (
                <div key={d.id} className="col-md-4">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body">
                      <div className="fw-bold fs-6">{d.nombre}</div>
                      <div className="text-muted small">📱 {d.telefono}</div>
                      {d.vehiculo && <div className="text-muted small">🏍️ {d.vehiculo} {d.placa ? `· ${d.placa}` : ''}</div>}
                      {d.documento && <div className="text-muted small">📄 {d.documento}</div>}
                      <div className="mt-2">
                        <span className={`badge ${d.activo ? 'bg-success' : 'bg-secondary'}`}>
                          {d.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {!domiciliarios.length && (
                <div className="col-12 text-center py-4 text-muted">
                  No hay domiciliarios registrados
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal nuevo pedido */}
        {showNuevo && (
          <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:9999 }}>
            <div className="modal-dialog modal-lg" style={{ marginTop:'4vh' }}>
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header" style={{ background:'#1e3a5f', color:'#fff' }}>
                  <h5 className="modal-title fw-bold">🛵 Nuevo pedido de domicilio</h5>
                  <button className="btn-close btn-close-white" onClick={() => setShowNuevo(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Nombre del cliente *</label>
                      <input className="form-control" value={form.cliente_nombre}
                        onChange={e => setForm(f => ({...f, cliente_nombre: e.target.value}))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">Teléfono *</label>
                      <input className="form-control" value={form.cliente_telefono}
                        onChange={e => setForm(f => ({...f, cliente_telefono: e.target.value}))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Dirección *</label>
                      <input className="form-control" value={form.cliente_direccion}
                        onChange={e => setForm(f => ({...f, cliente_direccion: e.target.value}))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Referencia / Indicaciones</label>
                      <input className="form-control" placeholder="Barrio, color de la casa, etc."
                        value={form.cliente_referencia}
                        onChange={e => setForm(f => ({...f, cliente_referencia: e.target.value}))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Método de pago</label>
                      <select className="form-select" value={form.metodo_pago}
                        onChange={e => setForm(f => ({...f, metodo_pago: e.target.value}))}>
                        {['efectivo','nequi','transferencia','tarjeta'].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Valor domicilio</label>
                      <input className="form-control" type="number" value={form.valor_domicilio}
                        onChange={e => setForm(f => ({...f, valor_domicilio: parseFloat(e.target.value)||0}))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Notas</label>
                      <input className="form-control" value={form.notas}
                        onChange={e => setForm(f => ({...f, notas: e.target.value}))} />
                    </div>

                    {/* Items */}
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Productos del pedido</label>
                      {form.items.map((item, i) => (
                        <div key={i} className="d-flex gap-2 mb-2 align-items-center">
                          <input className="form-control form-control-sm" placeholder="Nombre producto"
                            value={item.product_name}
                            onChange={e => setForm(f => ({ ...f, items: f.items.map((it,idx) => idx===i ? {...it, product_name: e.target.value} : it) }))} />
                          <input className="form-control form-control-sm" type="number" placeholder="Cant." style={{width:80}}
                            value={item.quantity}
                            onChange={e => setForm(f => ({ ...f, items: f.items.map((it,idx) => idx===i ? {...it, quantity: parseFloat(e.target.value)||1} : it) }))} />
                          <input className="form-control form-control-sm" type="number" placeholder="Precio"
                            value={item.price}
                            onChange={e => setForm(f => ({ ...f, items: f.items.map((it,idx) => idx===i ? {...it, price: parseFloat(e.target.value)||0} : it) }))} />
                          {form.items.length > 1 && (
                            <button className="btn btn-outline-danger btn-sm"
                              onClick={() => setForm(f => ({...f, items: f.items.filter((_,idx) => idx!==i)}))}>✕</button>
                          )}
                        </div>
                      ))}
                      <button className="btn btn-outline-primary btn-sm"
                        onClick={() => setForm(f => ({...f, items: [...f.items, {product_id:'', product_name:'', quantity:1, price:0}]}))}>
                        + Agregar producto
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowNuevo(false)}>Cancelar</button>
                  <button className="btn btn-success fw-bold px-4" onClick={crearPedido}>
                    🛵 Crear pedido
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal nuevo domiciliario */}
        {showNuevoDom && (
          <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:9999 }}>
            <div className="modal-dialog" style={{ marginTop:'15vh' }}>
              <div className="modal-content border-0 shadow-lg">
                <div className="modal-header" style={{ background:'#1e3a5f', color:'#fff' }}>
                  <h5 className="modal-title fw-bold">🧑 Registrar domiciliario</h5>
                  <button className="btn-close btn-close-white" onClick={() => setShowNuevoDom(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-6"><label className="form-label fw-semibold small">Nombre *</label>
                      <input className="form-control" value={formDom.nombre} onChange={e => setFormDom(f=>({...f,nombre:e.target.value}))} /></div>
                    <div className="col-6"><label className="form-label fw-semibold small">Teléfono *</label>
                      <input className="form-control" value={formDom.telefono} onChange={e => setFormDom(f=>({...f,telefono:e.target.value}))} /></div>
                    <div className="col-6"><label className="form-label fw-semibold small">Documento</label>
                      <input className="form-control" value={formDom.documento} onChange={e => setFormDom(f=>({...f,documento:e.target.value}))} /></div>
                    <div className="col-6"><label className="form-label fw-semibold small">Vehículo</label>
                      <select className="form-select" value={formDom.vehiculo} onChange={e => setFormDom(f=>({...f,vehiculo:e.target.value}))}>
                        {['moto','bicicleta','a pie','carro'].map(v=><option key={v}>{v}</option>)}
                      </select></div>
                    <div className="col-6"><label className="form-label fw-semibold small">Placa</label>
                      <input className="form-control" value={formDom.placa} onChange={e => setFormDom(f=>({...f,placa:e.target.value}))} /></div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowNuevoDom(false)}>Cancelar</button>
                  <button className="btn btn-success fw-bold" onClick={crearDomiciliario}>Registrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default DomiciliosAdmin;