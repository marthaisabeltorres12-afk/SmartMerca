import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import { exportOrdenCompraPDF } from '../../services/exportService';
import ConfirmModal from '../../components/ConfirmModal';

const fmt    = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtNum = n => Number(n||0).toLocaleString('es-CO');

const statusBadge = s => {
  const map = {
    borrador:   ['secondary', '📝 Borrador'],
    enviada:    ['primary',   '📤 Activa'],
    parcial:    ['warning',   '📦 Parcial'],
    completada: ['success',   '✅ Completada'],
    cancelada:  ['danger',    '❌ Cancelada'],
  };
  const [color, label] = map[s] || ['secondary', s];
  return <span className={`badge bg-${color}`}>{label}</span>;
};

const OrdenesCompra = () => {
  const { token } = useAuth();
  const [orders,     setOrders]     = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [products,   setProducts]   = useState([]);
  const [suggested,  setSuggested]  = useState([]);
  const [tab,        setTab]        = useState('lista');
  const [filterStatus, setFilterStatus] = useState('');
  const [expanded,   setExpanded]   = useState(null);
  const [alert,      setAlert]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [editedQty,   setEditedQty]   = useState({});
  const [creatingAuto, setCreatingAuto] = useState(null);
  const [confirmApprove, setConfirmApprove] = useState(null);
  const [confirmCancel,  setConfirmCancel]  = useState(null);

  // Formulario nueva orden
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [orderForm,     setOrderForm]     = useState({ supplier_id:'', fecha_esperada:'', notas:'' });
  const [orderItems,    setOrderItems]    = useState([]);
  const [searchProd,    setSearchProd]    = useState('');

  // Modal recepción
  const [receiveModal,  setReceiveModal]  = useState(null);
  const [receiveItems,  setReceiveItems]  = useState([]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const [ords, sups, prods, sugg, autoSugg] = await Promise.all([
        apiFetch('/purchase-orders/', {}, token),
        apiFetch('/suppliers/', {}, token),
        apiFetch('/products/', {}, token),
        apiFetch('/purchase-orders/suggested', {}, token),
        apiFetch('/replenishment/suggestions', {}, token).catch(()=>[]),
      ]);
      setOrders(Array.isArray(ords) ? ords : []);
      setSuppliers(Array.isArray(sups) ? sups : []);
      setProducts(Array.isArray(prods) ? prods.filter(p=>p.is_active) : []);
      setSuggested(Array.isArray(sugg) ? sugg : []);
      const sugsArr = Array.isArray(autoSugg) ? autoSugg : [];
      setSuggestions(sugsArr);
      const qty = {};
      sugsArr.forEach(prov => prov.productos.forEach(p => { qty[p.product_id] = p.cantidad_sugerida; }));
      setEditedQty(qty);
    } catch(e) { showAlert('danger', e.message); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!orderItems.length) { showAlert('danger','Agrega al menos un producto'); return; }
    setLoading(true);
    try {
      await apiFetch('/purchase-orders/', { method:'POST', body: JSON.stringify({
        ...orderForm,
        items: orderItems,
      })}, token);
      showAlert('success', 'Orden creada correctamente');
      setNewOrderModal(false); setOrderForm({supplier_id:'',fecha_esperada:'',notas:''}); setOrderItems([]);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    try {
      await apiFetch(`/purchase-orders/${id}/approve`, { method:'PATCH' }, token);
      showAlert('success', 'Orden aprobada y enviada');
      setConfirmApprove(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
  };

  const handleCancel = async (id) => {
    try {
      await apiFetch(`/purchase-orders/${id}/cancel`, { method:'PATCH' }, token);
      showAlert('success', 'Orden cancelada');
      setConfirmCancel(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
  };

  const openReceive = (order) => {
    setReceiveModal(order);
    setReceiveItems(order.items.filter(i=>i.pendiente > 0).map(i=>({
      item_id: i.id,
      product_name: i.product_name,
      pendiente: i.pendiente,
      cantidad_recibida: i.pendiente, // default: recibir todo
    })));
  };

  const handleReceive = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiFetch(`/purchase-orders/${receiveModal.id}/receive`, { method:'POST', body: JSON.stringify({
        items: receiveItems.map(i=>({ item_id: i.item_id, cantidad_recibida: parseFloat(i.cantidad_recibida||0) }))
      })}, token);
      showAlert('success', 'Recepción registrada — stock actualizado');
      setReceiveModal(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const addItemToOrder = (product) => {
    if (orderItems.find(i=>i.product_id===product.id)) return;
    setOrderItems(prev => [...prev, {
      product_id: product.id,
      product_name: product.name,
      cantidad_solicitada: 1,
      precio_costo_acordado: '',
    }]);
  };

  const addSuggestedItems = () => {
    suggested.forEach(p => {
      if (!orderItems.find(i=>i.product_id===p.id)) {
        setOrderItems(prev => [...prev, {
          product_id: p.id,
          product_name: p.name,
          cantidad_solicitada: Math.max(1, (p.min_stock||5) * 2),
          precio_costo_acordado: '',
        }]);
      }
    });
  };

  const filteredOrders = !filterStatus ? orders
    : filterStatus === 'activa'
    ? orders.filter(o => ['borrador','enviada','parcial'].includes(o.status))
    : orders.filter(o => o.status === filterStatus);
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchProd.toLowerCase()));

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold mb-0">📦 Órdenes de Compra</h4>
            <p className="text-muted small mb-0">Pedidos a proveedores y recepción de mercancía</p>
          </div>
          <button className="btn btn-primary fw-bold" onClick={()=>setNewOrderModal(true)}>
            + Nueva orden
          </button>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2`}>{alert.msg}</div>}

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { label:'Borradores',  val: orders.filter(o=>o.status==='borrador').length,   color:'secondary' },
            { label:'Enviadas',    val: orders.filter(o=>o.status==='enviada').length,    color:'primary'   },
            { label:'Parciales',   val: orders.filter(o=>o.status==='parcial').length,    color:'warning'   },
            { label:'Stock bajo',  val: suggested.length,                                  color:'danger'    },
          ].map((k,i)=>(
            <div key={i} className="col-6 col-md-3">
              <div className={`card border-${k.color} border-2 text-center`}>
                <div className="card-body py-2">
                  <div className={`fs-4 fw-bold text-${k.color}`}>{k.val}</div>
                  <div className="text-muted small">{k.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          {[['lista','📋 Órdenes'],['sugeridos','⚠️ Stock bajo'],['sugerencias','🔄 Sugerencias auto']].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}
                {k==='sugeridos' && suggested.length > 0 && <span className="badge bg-danger ms-1">{suggested.length}</span>}
              </button>
            </li>
          ))}
        </ul>

        {/* Tab lista de órdenes */}
        {tab === 'lista' && (
          <div>
            <div className="d-flex gap-2 mb-3 flex-wrap">
              {[
                ['',           'Todas'],
                ['activa',     'Activas'],
                ['parcial',    'Parcial'],
                ['completada', 'Completada'],
                ['cancelada',  'Cancelada'],
              ].map(([s,l])=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  className={`btn btn-sm ${filterStatus===s?'btn-dark':'btn-outline-secondary'}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                  <thead className="table-light">
                    <tr><th>Orden</th><th>Proveedor</th><th>Fecha esperada</th>
                      <th className="text-center">Productos</th><th className="text-end">Valor total</th>
                      <th>Estado</th><th></th></tr>
                  </thead>
                  <tbody>
                    {!filteredOrders.length ? (
                      <tr><td colSpan="7" className="text-center text-muted py-4">Sin órdenes</td></tr>
                    ) : filteredOrders.map(o => (
                      <React.Fragment key={o.id}>
                        <tr>
                          <td className="fw-semibold">{o.numero_orden}</td>
                          <td>🏭 {o.supplier_name}</td>
                          <td className="text-muted">{o.fecha_esperada || '—'}</td>
                          <td className="text-center">{o.total_items}</td>
                          <td className="text-end fw-bold">{fmt(o.valor_total)}</td>
                          <td>{statusBadge(o.status)}</td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              <button className="btn btn-sm btn-outline-secondary py-0 px-2"
                                onClick={()=>setExpanded(expanded===o.id?null:o.id)}
                                title="Ver detalle de productos">
                                {expanded===o.id?'▲':'▼'}
                              </button>
                              <button className="btn btn-sm btn-outline-danger py-0 px-2"
                                title="Descargar PDF para enviar al proveedor"
                                onClick={()=>exportOrdenCompraPDF(o)}>
                                📄 PDF
                              </button>
                              {o.status !== 'completada' && o.status !== 'cancelada' && (
                                <>
                                  <button className="btn btn-sm btn-outline-primary py-0 px-2"
                                    onClick={()=>openReceive(o)}>📥 Recibir</button>
                                  <button className="btn btn-sm btn-outline-danger py-0 px-1"
                                    title="Cancelar orden"
                                    onClick={()=>setConfirmCancel(o)}>❌</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded === o.id && (
                          <tr><td colSpan="7" className="p-0">
                            <div className="bg-light p-3">
                              {(!o.items || !o.items.length) ? (
                                <div className="text-muted small">Sin productos registrados</div>
                              ) : (
                                <table className="table table-sm mb-0" style={{fontSize:12}}>
                                  <thead><tr><th>Producto</th><th className="text-end">Solicitado</th><th className="text-end">Recibido</th><th className="text-end">Pendiente</th><th className="text-end">Precio acordado</th></tr></thead>
                                  <tbody>
                                    {o.items.map(i=>(
                                      <tr key={i.id}>
                                        <td>{i.product_name}</td>
                                        <td className="text-end">{fmtNum(i.cantidad_solicitada)}</td>
                                        <td className="text-end text-success">{fmtNum(i.cantidad_recibida)}</td>
                                        <td className="text-end">
                                          {i.pendiente > 0
                                            ? <span className="text-danger fw-bold">{fmtNum(i.pendiente)}</span>
                                            : <span className="text-success">✅</span>}
                                        </td>
                                        <td className="text-end">{i.precio_costo_acordado ? fmt(i.precio_costo_acordado) : '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {o.notas && <div className="text-muted small mt-2">📝 {o.notas}</div>}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab stock bajo */}
        {tab === 'sugeridos' && (
          <div>
            {!suggested.length ? (
              <div className="text-center text-muted py-5">
                <div className="fs-2">✅</div>
                <div>Todos los productos tienen stock suficiente</div>
              </div>
            ) : (
              <>
                <div className="alert alert-warning py-2 mb-3">
                  <strong>{suggested.length} producto(s)</strong> por debajo del stock mínimo.
                  <button className="btn btn-sm btn-warning ms-3" onClick={()=>{ setNewOrderModal(true); addSuggestedItems(); }}>
                    📦 Crear orden con todos
                  </button>
                </div>
                <div className="card border-0 shadow-sm">
                  <table className="table table-hover mb-0" style={{fontSize:13}}>
                    <thead className="table-light">
                      <tr><th>Producto</th><th>Proveedor</th><th className="text-end">Stock actual</th><th className="text-end">Stock mínimo</th></tr>
                    </thead>
                    <tbody>
                      {suggested.map(p=>(
                        <tr key={p.id} style={{background:'#fff5f5'}}>
                          <td className="fw-semibold">⚠️ {p.name}</td>
                          <td className="text-muted">{p.supplier||'—'}</td>
                          <td className="text-end fw-bold text-danger">{fmtNum(p.stock)}</td>
                          <td className="text-end text-muted">{fmtNum(p.min_stock)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab sugerencias automáticas */}
        {tab === 'sugerencias' && (
          <div>
            {!suggestions.length ? (
              <div className="text-center text-muted py-5">
                <div className="fs-2">✅</div>
                <div className="fw-bold text-success">Todo el inventario está en orden</div>
                <div className="small mt-1">Ningún producto está por debajo del stock mínimo</div>
              </div>
            ) : suggestions.map(prov => (
              <div key={prov.proveedor_id} className="card border-0 shadow-sm mb-4">
                <div className="card-header d-flex justify-content-between align-items-center py-3"
                  style={{background:'#1e3a5f',color:'#fff'}}>
                  <div>
                    <span className="fw-bold">🏭 {prov.proveedor_nombre}</span>
                    <span className="ms-2 badge bg-warning text-dark">{prov.productos.length} producto(s)</span>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <span className="text-white-50 small">Estimado: <strong className="text-white">{fmt(prov.valor_total_estimado)}</strong></span>
                    {prov.proveedor_id > 0 && (
                      <button className="btn btn-success btn-sm fw-bold"
                        disabled={creatingAuto === prov.proveedor_id}
                        onClick={async () => {
                          setCreatingAuto(prov.proveedor_id);
                          try {
                            const items = prov.productos.map(p => ({
                              product_id: p.product_id,
                              cantidad_solicitada: editedQty[p.product_id] ?? p.cantidad_sugerida,
                              precio_costo_acordado: p.ultimo_costo || null,
                            })).filter(i => parseFloat(i.cantidad_solicitada) > 0);
                            const res = await apiFetch('/replenishment/create-order', {
                              method: 'POST', body: JSON.stringify({ supplier_id: prov.proveedor_id, items })
                            }, token);
                            showAlert('success', `✅ Orden ${res.numero_orden} creada en borrador`);
                            load();
                          } catch(e) { showAlert('danger', e.message); }
                          finally { setCreatingAuto(null); }
                        }}>
                        {creatingAuto === prov.proveedor_id ? '⏳ Creando...' : '📦 Crear orden'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                    <thead className="table-light">
                      <tr><th>Producto</th><th className="text-end">Stock</th><th className="text-end">Mínimo</th>
                        <th className="text-end">Rotación/sem</th><th className="text-end" style={{width:120}}>Cantidad a pedir</th>
                        <th className="text-end">Costo estimado</th></tr>
                    </thead>
                    <tbody>
                      {prov.productos.map(p => {
                        const qty = editedQty[p.product_id] ?? p.cantidad_sugerida;
                        return (
                          <tr key={p.product_id}>
                            <td className="fw-semibold">⚠️ {p.product_name}</td>
                            <td className="text-end text-danger fw-bold">{fmtNum(p.stock_actual)}</td>
                            <td className="text-end text-muted">{fmtNum(p.min_stock)}</td>
                            <td className="text-end text-muted">{p.rotacion_semanal} uds</td>
                            <td className="text-end">
                              <input type="number" className="form-control form-control-sm text-end"
                                style={{width:100}} min="0" step="1" value={qty}
                                onChange={e=>setEditedQty(prev=>({...prev,[p.product_id]:e.target.value}))} />
                            </td>
                            <td className="text-end fw-bold">{p.ultimo_costo ? fmt(qty * p.ultimo_costo) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal nueva orden */}
        {newOrderModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">📦 Nueva Orden de Compra</h5>
                  <button className="btn-close btn-close-white" onClick={()=>{ setNewOrderModal(false); setOrderItems([]); }} />
                </div>
                <form onSubmit={handleCreateOrder}>
                  <div className="modal-body">
                    <div className="row g-3 mb-4">
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Proveedor *</label>
                        <select className="form-select" required value={orderForm.supplier_id}
                          onChange={e=>setOrderForm({...orderForm, supplier_id:e.target.value})}>
                          <option value="">— Seleccionar —</option>
                          {suppliers.map(s=><option key={s.id} value={s.id}>{s.company_name||s.name}</option>)}
                        </select>
                      </div>
                      <div className="col-md-3">
                        <label className="form-label fw-semibold">Fecha esperada</label>
                        <input type="date" className="form-control" value={orderForm.fecha_esperada}
                          onChange={e=>setOrderForm({...orderForm, fecha_esperada:e.target.value})} />
                      </div>
                      <div className="col-md-5">
                        <label className="form-label fw-semibold">Notas</label>
                        <input className="form-control" value={orderForm.notas}
                          onChange={e=>setOrderForm({...orderForm, notas:e.target.value})}
                          placeholder="Instrucciones especiales..." />
                      </div>
                    </div>

                    <div className="row g-3">
                      {/* Buscador de productos */}
                      <div className="col-md-5">
                        <div className="fw-semibold mb-2 small">Buscar y agregar productos:</div>
                        <input className="form-control form-control-sm mb-2" placeholder="Buscar producto..."
                          value={searchProd} onChange={e=>setSearchProd(e.target.value)} />
                        {suggested.length > 0 && (
                          <button type="button" className="btn btn-sm btn-outline-warning mb-2 w-100"
                            onClick={addSuggestedItems}>
                            ⚠️ Agregar todos los de stock bajo ({suggested.length})
                          </button>
                        )}
                        <div style={{maxHeight:300, overflowY:'auto', border:'1px solid #dee2e6', borderRadius:4}}>
                          {filteredProducts.map(p=>(
                            <div key={p.id} className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom"
                              style={{fontSize:12, cursor:'pointer', background: p.stock<=(p.min_stock||5)?'#fff5f5':'',
                                ':hover':{background:'#f0f9ff'}}}
                              onClick={()=>addItemToOrder(p)}>
                              <div>
                                <div>{p.name}</div>
                                <div className="text-muted" style={{fontSize:10}}>Stock: {p.stock}</div>
                              </div>
                              <span className="badge bg-primary">+</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Lista de items */}
                      <div className="col-md-7">
                        <div className="fw-semibold mb-2 small">Productos en la orden ({orderItems.length}):</div>
                        {!orderItems.length ? (
                          <div className="text-center text-muted py-4 border rounded" style={{fontSize:13}}>
                            Haz clic en productos para agregarlos
                          </div>
                        ) : (
                          <div style={{maxHeight:320, overflowY:'auto'}}>
                            <table className="table table-sm table-bordered mb-0" style={{fontSize:12}}>
                              <thead className="table-dark sticky-top">
                                <tr>
                                  <th style={{minWidth:160}}>Producto</th>
                                  <th className="text-center" style={{width:90}}>Cantidad</th>
                                  <th className="text-center" style={{width:110}}>Precio costo</th>
                                  <th className="text-center" style={{width:90}}>Subtotal</th>
                                  <th style={{width:40}}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {orderItems.map((item,i)=>(
                                  <tr key={i}>
                                    <td className="fw-semibold align-middle">{item.product_name}</td>
                                    <td className="text-center align-middle">
                                      <input type="number" className="form-control form-control-sm text-center"
                                        min="0.001" step="1" value={item.cantidad_solicitada}
                                        onChange={e=>setOrderItems(prev=>prev.map((x,j)=>j===i?{...x,cantidad_solicitada:e.target.value}:x))} />
                                    </td>
                                    <td className="text-center align-middle">
                                      <div className="input-group input-group-sm">
                                        <span className="input-group-text">$</span>
                                        <input type="number" className="form-control text-end"
                                          min="0" step="100" placeholder="0"
                                          value={item.precio_costo_acordado}
                                          onChange={e=>setOrderItems(prev=>prev.map((x,j)=>j===i?{...x,precio_costo_acordado:e.target.value}:x))} />
                                      </div>
                                    </td>
                                    <td className="text-end align-middle fw-bold text-success">
                                      {item.precio_costo_acordado
                                        ? fmt(parseFloat(item.cantidad_solicitada||0)*parseFloat(item.precio_costo_acordado||0))
                                        : '—'}
                                    </td>
                                    <td className="text-center align-middle">
                                      <button type="button" className="btn btn-sm btn-outline-danger py-0 px-1"
                                        title="Eliminar"
                                        onClick={()=>setOrderItems(prev=>prev.filter((_,j)=>j!==i))}>🗑</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="table-light">
                                <tr>
                                  <td colSpan="3" className="fw-bold text-end">Total estimado:</td>
                                  <td className="text-end fw-bold text-success">
                                    {fmt(orderItems.reduce((a,i)=>a+(parseFloat(i.cantidad_solicitada||0)*parseFloat(i.precio_costo_acordado||0)),0))}
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>{ setNewOrderModal(false); setOrderItems([]); }}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={loading}>
                      {loading ? 'Guardando...' : '✅ Crear orden'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal recepción */}
        {receiveModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#166534',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">📥 Registrar Recepción — {receiveModal.numero_orden}</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setReceiveModal(null)} />
                </div>
                <form onSubmit={handleReceive}>
                  <div className="modal-body">
                    <div className="alert alert-info py-2 small mb-3">
                      Ingresa las cantidades que realmente llegaron. Si llegó menos, la orden quedará en estado "Parcial".
                    </div>
                    <table className="table table-sm" style={{fontSize:13}}>
                      <thead className="table-light">
                        <tr><th>Producto</th><th className="text-end">Pendiente</th><th className="text-end">Cantidad recibida</th></tr>
                      </thead>
                      <tbody>
                        {receiveItems.map((item,i)=>(
                          <tr key={i}>
                            <td>{item.product_name}</td>
                            <td className="text-end text-muted">{fmtNum(item.pendiente)}</td>
                            <td className="text-end">
                              <input type="number" className="form-control form-control-sm text-end" style={{width:90}}
                                min="0" max={item.pendiente} step="1"
                                value={item.cantidad_recibida}
                                onChange={e=>setReceiveItems(prev=>prev.map((x,j)=>j===i?{...x,cantidad_recibida:e.target.value}:x))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setReceiveModal(null)}>Cancelar</button>
                    <button type="submit" className="btn btn-success fw-bold" disabled={loading}>
                      {loading ? 'Guardando...' : '📥 Registrar recepción'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </main>

      <ConfirmModal
        show={!!confirmCancel}
        titulo="¿Cancelar esta orden?"
        mensaje={<>Se cancelará la orden <strong>{confirmCancel?.numero_orden}</strong>. Esta acción no se puede deshacer.</>}
        txtConfirmar="Sí, cancelar"
        onConfirmar={() => handleCancel(confirmCancel.id)}
        onCancelar={() => setConfirmCancel(null)}
      />
    </div>
  );
};

export default OrdenesCompra;