import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const ESTADOS = {
  pendiente:  { label:' Pendiente',   color:'warning',  bg:'#fffbeb', text:'#92400e' },
  asignado:   { label:' Asignado',    color:'info',     bg:'#eff6ff', text:'#1d4ed8' },
  en_camino:  { label:' En camino',   color:'primary',  bg:'#eff6ff', text:'#1d4ed8' },
  entregado:  { label:' Entregado',   color:'success',  bg:'#f0fdf4', text:'#15803d' },
  cancelado:  { label:' Cancelado',   color:'danger',   bg:'#fef2f2', text:'#dc2626' },
};

const fmt = n => Number(n||0).toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0});
const fmtFecha = f => f ? new Date(f).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}) : '—';

export default function DomiciliosAdmin() {
  const { token } = useAuth();
  const [pedidos,       setPedidos]       = useState([]);
  const [domiciliarios,    setDomiciliarios]    = useState([]);
  const [modalAsignar,     setModalAsignar]     = useState(null); // pedido a asignar
  const [formDomiciliario, setFormDomiciliario] = useState({ nombre:'', celular:'', cedula:'', marca_moto:'', placa_moto:'' });
  const [modalCodigo,      setModalCodigo]      = useState(null); // pedido a confirmar entrega
  const [codigoInput,      setCodigoInput]      = useState('');
  const [stats,         setStats]         = useState(null);
  const [filtroEstado,  setFiltroEstado]  = useState('');
  const [loading,       setLoading]       = useState(true);
  const [alert,         setAlert]         = useState(null);
  const [showForm,      setShowForm]      = useState(false);
  const [productos,     setProductos]     = useState([]);
  const [form,          setForm]          = useState({
    cliente_nombre:'', cliente_telefono:'', cliente_direccion:'',
    cliente_referencia:'', metodo_pago:'efectivo', valor_domicilio:0, notas:'', items:[]
  });
  const [busqueda, setBusqueda] = useState('');
  const [pedidoDetalle, setPedidoDetalle] = useState(null);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, d, s] = await Promise.all([
        apiFetch(`/domicilios/${filtroEstado ? `?estado=${filtroEstado}` : ''}`, {}, token),
        apiFetch('/domicilios/domiciliarios', {}, token),
        apiFetch('/domicilios/stats', {}, token),
      ]);
      setPedidos(p); setDomiciliarios(d); setStats(s);
    } catch(e) { showAlert('danger', 'Error cargando domicilios'); }
    setLoading(false);
  }, [token, filtroEstado]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/products/', {}, token).then(setProductos).catch(()=>{});
  }, [token]);

  const generarCodigo = () => Math.floor(1000 + Math.random() * 9000).toString();

  const asignarDomiciliario = async () => {
    if (!formDomiciliario.nombre.trim() || !formDomiciliario.celular.trim()) {
      showAlert('warning', 'Nombre y celular del domiciliario son obligatorios'); return;
    }
    try {
      await apiFetch(`/domicilios/${modalAsignar.id}/estado`, {
        method: 'PUT',
        body: JSON.stringify({
          estado: 'asignado',
          domiciliario_nombre:  formDomiciliario.nombre,
          domiciliario_celular: formDomiciliario.celular,
          domiciliario_cedula:  formDomiciliario.cedula,
          domiciliario_marca:   formDomiciliario.marca_moto,
          domiciliario_placa:   formDomiciliario.placa_moto,
        })
      }, token);
      showAlert('success', ' Domiciliario asignado correctamente');
      setModalAsignar(null);
      setFormDomiciliario({ nombre:'', celular:'', cedula:'', marca_moto:'', placa_moto:'' });
      load();
    } catch { showAlert('danger', 'Error asignando domiciliario'); }
  };

  const confirmarEntrega = async () => {
    if (!codigoInput.trim()) { showAlert('warning', 'Ingrese el código'); return; }
    try {
      const res = await apiFetch(`/domicilios/${modalCodigo.id}/confirmar-entrega`, {
        method: 'POST',
        body: JSON.stringify({ codigo: codigoInput.trim() })
      }, token);
      showAlert('success', ' Entrega confirmada con código');
      // Enviar comprobante WhatsApp al domiciliario
      if (modalCodigo.domiciliario_celular) {
        const cel = modalCodigo.domiciliario_celular.replace(/[^0-9]/g, '');
        const celCol = cel.startsWith('57') ? cel : '57' + cel;
        const msg = encodeURIComponent(
          `✅ *Entrega confirmada* — SmartMerca\n` +
          `Pedido: ${modalCodigo.numero_pedido}\n` +
          `Cliente: ${modalCodigo.cliente_nombre}\n` +
          `Dirección: ${modalCodigo.cliente_direccion}\n` +
          `Total: $${Number(modalCodigo.total||0).toLocaleString('es-CO')}\n` +
          `¡Gracias por su servicio! 🛵`
        );
        window.open(`https://wa.me/${celCol}?text=${msg}`, '_blank');
      }
      setModalCodigo(null);
      setCodigoInput('');
      load();
    } catch (e) {
      showAlert('danger', e.message || 'Código incorrecto');
    }
  };

  const cambiarEstado = async (id, estado, domiciliario_id=null) => {
    try {
      await apiFetch(`/domicilios/${id}/estado`, {
        method:'PUT', body: JSON.stringify({ estado, domiciliario_id })
      }, token);
      showAlert('success', `Estado actualizado a ${ESTADOS[estado]?.label}`);
      load();
    } catch(e) { showAlert('danger', 'Error actualizando estado'); }
  };

  const agregarProducto = (prod) => {
    setForm(f => {
      const existe = f.items.find(i => i.product_id === prod.id);
      if (existe) return { ...f, items: f.items.map(i => i.product_id===prod.id ? {...i, quantity: i.quantity+1} : i) };
      return { ...f, items: [...f.items, { product_id:prod.id, product_name:prod.name, quantity:1, price:prod.final_price||prod.price||0 }] };
    });
  };

  const crearPedido = async () => {
    if (!form.cliente_nombre||!form.cliente_telefono||!form.cliente_direccion) {
      showAlert('danger','Nombre, teléfono y dirección son obligatorios'); return;
    }
    if (!form.items.length) { showAlert('danger','Agrega al menos un producto'); return; }
    try {
      await apiFetch('/domicilios/', { method:'POST', body: JSON.stringify(form) }, token);
      showAlert('success','Pedido creado exitosamente');
      setShowForm(false);
      setForm({ cliente_nombre:'', cliente_telefono:'', cliente_direccion:'', cliente_referencia:'', metodo_pago:'efectivo', valor_domicilio:0, notas:'', items:[] });
      load();
    } catch(e) { showAlert('danger','Error creando pedido'); }
  };

  const prodsFiltrados = productos.filter(p =>
    p.name?.toLowerCase().includes(busqueda.toLowerCase()) && p.is_active !== false
  ).slice(0,12);

  const totalForm = form.items.reduce((a,i)=>a+i.quantity*i.price,0) + Number(form.valor_domicilio||0);

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc' }}>
      <Navbar/>
      <main className="flex-grow-1" style={{ marginLeft:240, padding:'16px 24px' }}>

        <div style={{
            position:'fixed', top:20, left:'50%', transform:'translateX(-50%)',
            zIndex:99999, minWidth:380, maxWidth:520, textAlign:'center',
            borderRadius:12, padding:'14px 20px', fontWeight:600, fontSize:15,
            background: alert?.type==='success'?'#f0fdf4':alert?.type==='warning'?'#fffbeb':'#fef2f2',
            color: alert?.type==='success'?'#166534':alert?.type==='warning'?'#92400e':'#991b1b',
            border: `1.5px solid ${alert?.type==='success'?'#86efac':alert?.type==='warning'?'#fde68a':'#fca5a5'}`,
            boxShadow:'0 8px 25px rgba(0,0,0,0.15)',
            display: alert ? 'block' : 'none',
            pointerEvents: alert ? 'auto' : 'none',
          }}>
            <i className={`bi me-2 ${alert?.type==='success'?'bi-check-circle-fill':alert?.type==='danger'?'bi-x-circle-fill':'bi-exclamation-triangle-fill'}`}></i>
            {alert?.msg}
        </div>

        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h4 className="fw-bold mb-0"><i className="bi bi-bicycle me-2"></i> Domicilios </h4>
            <small className="text-muted">Gestión de pedidos a domicilio</small>
          </div>
          <button className="btn btn-success fw-bold" onClick={()=>setShowForm(true)}>
            + Nuevo pedido
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="row g-3 mb-3">
  {[
    {
      icon: <i className="bi bi-box-seam-fill"></i>,
      label: 'Pedidos hoy',
      val: stats.hoy_total,
      color: 'primary'
    },
    {
      icon: <i className="bi bi-check-circle-fill"></i>,
      label: 'Entregados hoy',
      val: stats.hoy_entregados,
      color: 'success'
    },
    {
      icon: <i className="bi bi-hourglass-split"></i>,
      label: 'En curso',
      val: stats.pendientes,
      color: 'warning'
    },
    {
      icon: <i className="bi bi-cash-coin"></i>,
      label: 'Ingresos hoy',
      val: fmt(stats.ingresos_hoy),
      color: 'info',
      isMoney: true
    },
  ].map((s, i) => (
    <div key={i} className="col-6 col-md-3">
      <div className={`card border-${s.color} border-2 text-center py-2`}>
        <div
          className={`text-${s.color}`}
          style={{ fontSize: 28 }}
        >
          {s.icon}
        </div>

        <div
          className={`fw-bold text-${s.color}`}
          style={{ fontSize: s.isMoney ? 16 : 24 }}
        >
          {s.val}
        </div>

        <div className="small text-muted">
          {s.label}
        </div>
      </div>
    </div>
  ))}
</div>
        )}

        {/* Filtros */}
       <div
  className="mb-3"
  style={{ overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 4 }}
>
  {[
    {
      val: "",
      label: "Todos",
      icon: "bi-card-list "
    },
    {
      val: "pendiente",
      label: "Pendiente",
      icon: "bi-hourglass-split"
    },
    {
      val: "asignado",
      label: "Asignado",
      icon: "bi-person-check-fill"
    },
    {
      val: "en_camino",
      label: "En camino",
      icon: "bi-scooter"
    },
    {
      val: "entregado",
      label: "Entregado",
      icon: "bi-check-circle-fill"
    },
    {
      val: "cancelado",
      label: "Cancelado",
      icon: "bi-x-circle-fill"
    },
  ].map((e) => (
    <button
      key={e.val}
      className={`btn btn-sm me-2 ${
        filtroEstado === e.val
          ? "btn-dark fw-bold"
          : "btn-outline-secondary"
      }`}
      style={{ display: "inline-block" }}
      onClick={() => setFiltroEstado(e.val)}
    >
      <i className={`bi ${e.icon} me-1`}></i>
      {e.label}
    </button>
  ))}

  <button
    className="btn btn-sm btn-outline-primary ms-2"
    onClick={load}
  >
    <i className="bi bi-arrow-clockwise me-1"></i>
    Actualizar
  </button>
</div>

        {/* Lista de pedidos */}
        {loading ? (
          <div className="text-center py-5 text-muted">
  <div style={{ fontSize: 48 }}>
    <i className="bi bi-inbox"></i>
  </div>
  <div>
    No hay pedidos {filtroEstado ? `con estado "${ESTADOS[filtroEstado]?.label}"` : ''}
  </div>
</div>
        ) : (
          <div className="row g-3">
            {pedidos.map(p => {
              const est = ESTADOS[p.estado] || ESTADOS.pendiente;
              return (
                <div key={p.id} className="col-12 col-md-6 col-xl-4">
                  <div className="card shadow-sm border-0" style={{borderLeft:`4px solid`,borderLeftColor:`var(--bs-${est.color})`}}>
                    <div className="card-body p-3">

                      {/* Header pedido */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <div className="fw-bold">{p.numero_pedido}</div>
                          <div className="small text-muted">{fmtFecha(p.created_at)}</div>
                        </div>
                        <span className={`badge bg-${est.color} bg-opacity-15 text-${est.color}`}
                          style={{background:est.bg,color:est.text}}>
                          {est.label}
                        </span>
                      </div>

                      {/* Cliente */}
                      <div className="mb-2 p-2 rounded" style={{ background: '#f8fafc' }}>
  <div className="fw-semibold">
    <i className="bi bi-person-fill me-2"></i>
    {p.cliente_nombre}
  </div>

  <div className="small text-muted">
    <i className="bi bi-telephone-fill me-2"></i>
    {p.cliente_telefono}
  </div>

  <div className="small text-muted">
    <i className="bi bi-geo-alt-fill me-2"></i>
    {p.cliente_direccion}
  </div>

  {p.cliente_referencia && (
    <div className="small text-muted">
      <i className="bi bi-house-door-fill me-2"></i>
      {p.cliente_referencia}
    </div>
  )}
</div>6

                      {/* Productos */}
                      <div className="mb-2">
                        {p.items?.map((item,i) => (
                          <div key={i} className="d-flex justify-content-between small">
                            <span>{item.quantity} × {item.product_name}</span>
                            <span className="fw-semibold">{fmt(item.subtotal)}</span>
                          </div>
                        ))}
                        <hr className="my-1"/>
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Total</span>
                          <span className="text-success">{fmt(p.total)}</span>
                        </div>
                        <div className="small text-muted">Pago: {p.metodo_pago} · Domicilio: {fmt(p.valor_domicilio)}</div>
                      </div>

                      {/* Cajero asignado */}
                      {p.cajero && (
                        <div className="small p-2 rounded mb-2" style={{ background: '#eff6ff' }}>
  <i className="bi bi-person-workspace me-2"></i>
  <strong>Cajero:</strong> {p.cajero.nombre}
</div>
                      )}

                      {/* Domiciliario */}
                      {(p.domiciliario || p.domiciliario_nombre) && (
                        <div className="small p-2 rounded mb-2" style={{background:'#eff6ff'}}>
                           <strong>{p.domiciliario_nombre || p.domiciliario?.nombre}</strong>
                          {' · '}{p.domiciliario_celular || p.domiciliario?.telefono}
                          {p.codigo_confirmacion && p.estado !== 'entregado' && (
                            <span className="badge bg-warning text-dark ms-2">Código: {p.codigo_confirmacion}</span>
                          )}
                        </div>
                      )}

                      {/* Timeline de estados */}
                      <div className="d-flex gap-1 mb-2">
                        {['pendiente','asignado','en_camino','entregado'].map((e,i) => {
                          const estados = ['pendiente','asignado','en_camino','entregado','cancelado'];
                          const idx = estados.indexOf(p.estado);
                          const eIdx = estados.indexOf(e);
                          const activo = idx >= eIdx;
                          return (
                            <div key={e} style={{flex:1,textAlign:'center'}}>
                              <div style={{
                                width:20,height:20,borderRadius:'50%',margin:'0 auto',
                                background: p.estado==='cancelado' ? '#fee2e2' : activo ? '#22c55e' : '#e2e8f0',
                                border: `2px solid ${p.estado==='cancelado' ? '#dc2626' : activo ? '#16a34a' : '#cbd5e1'}`,
                                display:'flex',alignItems:'center',justifyContent:'center',fontSize:10
                              }}>
                                {p.estado==='cancelado' && eIdx===0 ? '' : activo ? '✓' : ''}
                              </div>
                              <div style={{fontSize:8,color:'#64748b',marginTop:2}}>
                                {e==='pendiente'?'Pedido':e==='asignado'?'Asignado':e==='en_camino'?'Camino':'Entregado'}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Acciones */}
                      <div className="d-flex gap-2 flex-wrap">
                        {p.estado === 'pendiente' && (
                          <button className="btn btn-warning btn-sm fw-semibold"
                            onClick={() => { setModalAsignar(p); setFormDomiciliario({nombre:'',celular:'',cedula:'',marca_moto:'',placa_moto:''}); }}>
                             Asignar domiciliario
                          </button>
                        )}
                        {p.estado === 'asignado' && (
                          <button className="btn btn-primary btn-sm" onClick={()=>cambiarEstado(p.id,'en_camino')}>
                            En camino
                          </button>
                        )}
                        {p.estado === 'en_camino' && (
                          <button className="btn btn-success btn-sm fw-bold"
                            onClick={() => {
                              // El domiciliario envía foto a la tienda como comprobante
                              // Al marcar entregado se abre WhatsApp del domiciliario con mensaje a la tienda
                              if (p.domiciliario_celular) {
                                const celDom = p.domiciliario_celular.replace(/[^0-9]/g,'');
                                const celDomCol = celDom.startsWith('57') ? celDom : '57'+celDom;
                                const msg = encodeURIComponent(`📦 *Comprobante de entrega* — SmartMerca\nPedido: ${p.numero_pedido}\nCliente: ${p.cliente_nombre}\nDirección: ${p.cliente_direccion}\nTotal: $${Number(p.total||0).toLocaleString('es-CO')}\nPor favor envía foto del comprobante.`);
                                window.open(`https://wa.me/${celDomCol}?text=${msg}`,'_blank');
                              }
                              cambiarEstado(p.id,'entregado');
                            }}>
                             ✓ Entrega + WhatsApp
                          </button>
                        )}
                        {!['entregado','cancelado'].includes(p.estado) && (
                          <button className="btn btn-outline-danger btn-sm" onClick={()=>cambiarEstado(p.id,'cancelado')}>
                            Cancelar
                          </button>
                        )}
                      </div>

                      {p.estado==='entregado' && p.delivered_at && (
                        <div className="small text-success mt-1"> Entregado: {fmtFecha(p.delivered_at)}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Modal nuevo pedido */}
      {showForm && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fw-bold"> Nuevo pedido a domicilio</h5>
                <button className="btn-close" onClick={()=>setShowForm(false)}/>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Nombre cliente *</label>
                    <input className="form-control" placeholder="Juan Pérez"
                      value={form.cliente_nombre} onChange={e=>setForm(f=>({...f,cliente_nombre:e.target.value}))}/>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Teléfono *</label>
                    <input className="form-control" placeholder="3001234567"
                      value={form.cliente_telefono} onChange={e=>setForm(f=>({...f,cliente_telefono:e.target.value}))}/>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Dirección *</label>
                    <input className="form-control" placeholder="Calle 10 # 5-20"
                      value={form.cliente_direccion} onChange={e=>setForm(f=>({...f,cliente_direccion:e.target.value}))}/>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Referencia</label>
                    <input className="form-control" placeholder="Casa azul con reja negra"
                      value={form.cliente_referencia} onChange={e=>setForm(f=>({...f,cliente_referencia:e.target.value}))}/>
                  </div>
                  <div className="col-md-6">
  <label className="form-label fw-semibold">
    <i className="bi bi-credit-card-2-front-fill me-2"></i>
    Método de pago
  </label>

  <select
    className="form-select"
    value={form.metodo_pago}
    onChange={e => setForm(f => ({
      ...f,
      metodo_pago: e.target.value
    }))}
  >
    <option value="efectivo">Efectivo</option>
    <option value="nequi">Nequi</option>
    <option value="transferencia">Transferencia</option>
    <option value="tarjeta">Tarjeta</option>
  </select>
</div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Valor domicilio</label>
                    <input className="form-control" type="number" min="0" step="500"
                      value={form.valor_domicilio} onChange={e=>setForm(f=>({...f,valor_domicilio:e.target.value}))}/>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Notas</label>
                    <textarea className="form-control" rows={2} placeholder="Instrucciones especiales..."
                      value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))}/>
                  </div>
                </div>

                <hr/>
               <div className="fw-bold mb-2"><i className="bi bi-bag-fill me-2"></i>Productos</div>
                <input className="form-control form-control-sm mb-2" placeholder="Buscar producto..."
                  value={busqueda} onChange={e=>setBusqueda(e.target.value)}/>
                <div className="row g-1 mb-3" style={{maxHeight:180,overflowY:'auto'}}>
                  {prodsFiltrados.map(p => (
                    <div key={p.id} className="col-6">
                      <button className="btn btn-outline-secondary btn-sm w-100 text-start"
                        onClick={()=>agregarProducto(p)}>
                        + {p.name} — {p.promo_info ? (
                          <>
                            <span style={{textDecoration:'line-through',color:'#999',fontSize:11,marginRight:4}}>{fmt(p.price)}</span>
                            <span style={{color:'#dc2626',fontWeight:700}}>{fmt(p.final_price||p.price)}</span>
                            {p.promo_info.type==='lleva_gratis' && <span className="badge bg-success ms-1" style={{fontSize:9}}>🎁 {p.promo_info.buy_quantity}x{(p.promo_info.buy_quantity||0)+(p.promo_info.free_quantity||0)}</span>}
                            {p.promo_info.type==='descuento_pct' && <span className="badge bg-danger ms-1" style={{fontSize:9}}>-{p.promo_info.discount_value}%</span>}
                            {p.promo_info.type==='descuento_fijo' && <span className="badge bg-danger ms-1" style={{fontSize:9}}>-${Number(p.promo_info.discount_value).toLocaleString('es-CO')}</span>}
                          </>
                        ) : fmt(p.final_price||p.price)}
                      </button>
                    </div>
                  ))}
                </div>

                {form.items.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead>
                      <tbody>
                        {form.items.map((it,i) => (
                          <tr key={i}>
                            <td>{it.product_name}</td>
                            <td>
                              <input type="number" className="form-control form-control-sm" style={{width:70}}
                                min="1" value={it.quantity}
                                onChange={e=>setForm(f=>({...f,items:f.items.map((x,j)=>j===i?{...x,quantity:Number(e.target.value)}:x)}))}/>
                            </td>
                            <td>{fmt(it.price)}</td>
                            <td className="fw-semibold text-success">{fmt(it.quantity*it.price)}</td>
                            <td>
                              <button className="btn btn-sm btn-outline-danger"
                                onClick={()=>setForm(f=>({...f,items:f.items.filter((_,j)=>j!==i)}))}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-end fw-bold text-success">Total: {fmt(totalForm)}</div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancelar</button>
                <button className="btn btn-success fw-bold" onClick={crearPedido}>
                   Crear pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignar Domiciliario */}
      {modalAsignar && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:14,overflow:'hidden',maxWidth:420,width:'90%',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{background:'#1e3a5f',padding:'14px 20px'}}>
              <h5 style={{margin:0,fontWeight:700,color:'#fff'}}> Asignar Domiciliario</h5>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',marginTop:2}}>Pedido #{modalAsignar.id} · {modalAsignar.cliente_nombre}</div>
            </div>
            <div style={{padding:20}}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Nombre *</label>
                <input className="form-control" placeholder="Ej: Juan Pérez"
                  value={formDomiciliario.nombre} autoFocus
                  onChange={e => setFormDomiciliario(f=>({...f, nombre:e.target.value}))}/>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Celular *</label>
                <input className="form-control" placeholder="Ej: 3001234567"
                  value={formDomiciliario.celular}
                  onChange={e => setFormDomiciliario(f=>({...f, celular:e.target.value}))}/>
              </div>
              <div className="mb-3">
                <label className="form-label fw-semibold">Cédula</label>
                <input className="form-control" placeholder="Ej: 1234567890"
                  value={formDomiciliario.cedula}
                  onChange={e => setFormDomiciliario(f=>({...f, cedula:e.target.value}))}/>
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label fw-semibold">Marca moto</label>
                  <input className="form-control" placeholder="Ej: Yamaha"
                    value={formDomiciliario.marca_moto}
                    onChange={e => setFormDomiciliario(f=>({...f, marca_moto:e.target.value}))}/>
                </div>
                <div className="col-6">
                  <label className="form-label fw-semibold">Placa</label>
                  <input className="form-control" placeholder="Ej: ABC123"
                    value={formDomiciliario.placa_moto}
                    onChange={e => setFormDomiciliario(f=>({...f, placa_moto:e.target.value}))}/>
                </div>
              </div>
            </div>
            <div style={{padding:'0 20px 20px',display:'flex',gap:10}}>
              <button className="btn btn-outline-secondary flex-fill" onClick={()=>setModalAsignar(null)}>Cancelar</button>
              <button className="btn btn-warning fw-bold flex-fill" onClick={asignarDomiciliario}> Asignar</button>
            </div>
          </div>
        </div>
      )}


      </main>
    </div>
  );
}