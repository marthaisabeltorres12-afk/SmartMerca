import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import { apiFetch } from '../../services/api';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const API  = 'http://localhost:5000/api/promotions/';
const PAPI = 'http://localhost:5000/api/products/';

const EMPTY = {
  name: '', type: 'descuento_pct', is_active: true,
  product_id: '', discount_value: '', buy_quantity: 1,
  free_quantity: 1, free_product_id: '', date_from: '', date_to: '',
};

const TYPE_LABEL = {
  descuento_pct:  '% Descuento',
  descuento_fijo: '$ Descuento fijo',
  lleva_gratis:   'Compra X lleva Y gratis',
};

const TYPE_ICON = {
  descuento_pct:  '🏷️',
  descuento_fijo: '💵',
  lleva_gratis:   '🎁',
};

const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n);

const productLabel = (p) => {
  let name = p.name;
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const qty = parseFloat(p.gramaje_cantidad);
    const qtyStr = qty === Math.floor(qty) ? String(Math.floor(qty)) : String(qty);
    name = `${p.name} · ${qtyStr} ${p.gramaje_unidad}`;
  }
  return `${name} — ${fmt(p.price)}`;
};

const statusBadge = promo => {
  if (!promo.is_active)      return { bg:'#f1f5f9', c:'#64748b', lb:'⏸️ Inactiva' };
  if (!promo.is_valid_today) return { bg:'#fef9c3', c:'#854d0e', lb:'⏳ Fuera de fecha' };
  return                            { bg:'#dcfce7', c:'#166534', lb:'✅ Activa hoy' };
};

const Promotions = () => {
  const { token }                   = useAuth();
  const [promos,     setPromos]     = useState([]);
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [alert,      setAlert]      = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [tab,        setTab]        = useState('activas');
  const [mainTab,    setMainTab]    = useState('promociones');

  // ── Listas de precios ──────────────────────────────────────────────────
  const [priceLists,    setPriceLists]    = useState([]);
  const [priceProducts, setPriceProducts] = useState([]);
  const [priceCustomers,setPriceCustomers]= useState([]);
  const [selList,       setSelList]       = useState(null);
  const [listItems,     setListItems]     = useState([]);
  const [showListModal, setShowListModal] = useState(false);
  const [listForm,      setListForm]      = useState({ nombre:'', descripcion:'', tipo:'porcentaje', descuento_pct:'' });
  const [editingList,   setEditingList]   = useState(null);
  const [itemForm,      setItemForm]      = useState({ product_id:'', precio_especial:'' });
  const [showItemForm,  setShowItemForm]  = useState(false);
  const [prodSearch,    setProdSearch]    = useState('');
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);

  // ── Cupones ────────────────────────────────────────────────────────────
  const [cupones,       setCupones]       = useState([]);
  const [showCuponModal,setShowCuponModal]= useState(false);
  const [cuponForm,     setCuponForm]     = useState({ codigo:'', tipo:'descuento_pct', valor:'', fecha_inicio:'', fecha_fin:'', min_purchase:'', customer_id:'' });
  const [confirmDelCupon, setConfirmDelCupon] = useState(null);

  const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = async () => {
    let pd = [];
    try {
      pd = await fetch(PAPI, { headers: h }).then(r => r.json());
      const activos = Array.isArray(pd) ? pd.filter(p => p.is_active) : [];
      setProducts(activos);
      setPriceProducts(activos);
    } catch { setProducts([]); setPriceProducts([]); }

    try {
      const pr = await fetch(API, { headers: h }).then(r => r.json());
      setPromos(Array.isArray(pr) ? pr : []);
    } catch { setPromos([]); }

    try {
      const [ls, custs, cups] = await Promise.all([
        apiFetch('/price-lists/', {}, token).catch(()=>[]),
        apiFetch('/customers/', {}, token).catch(()=>[]),
        apiFetch('/coupons/', {}, token).catch(()=>[]),
      ]);
      setPriceLists(Array.isArray(ls) ? ls : []);
      setPriceCustomers(Array.isArray(custs) ? custs : []);
      setCupones(Array.isArray(cups) ? cups : []);
    } catch {}

    setLoading(false);
  };

  useEffect(() => { load(); }, [token]);

  // ── Funciones listas de precios ────────────────────────────────────────
  const loadListItems = useCallback(async (listId) => {
    try {
      const its = await apiFetch(`/price-lists/${listId}/items`, {}, token);
      setListItems(Array.isArray(its) ? its : []);
    } catch { setListItems([]); }
  }, [token]);

  useEffect(() => { if (selList) loadListItems(selList.id); }, [selList, loadListItems]);

  const handleSaveList = async (e) => {
    e.preventDefault();
    try {
      if (editingList) {
        await apiFetch(`/price-lists/${editingList.id}`, { method:'PUT', body: JSON.stringify(listForm) }, token);
      } else {
        await apiFetch('/price-lists/', { method:'POST', body: JSON.stringify(listForm) }, token);
      }
      showMsg('success', editingList ? 'Lista actualizada' : 'Lista creada');
      setShowListModal(false); setListForm({ nombre:'', descripcion:'', tipo:'porcentaje', descuento_pct:'' }); setEditingList(null);
      load();
    } catch(e) { showMsg('danger', e.message); }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/price-lists/${selList.id}/items`, { method:'POST', body: JSON.stringify(itemForm) }, token);
      showMsg('success', 'Precio especial guardado');
      setItemForm({ product_id:'', precio_especial:'' }); setShowItemForm(false);
      loadListItems(selList.id);
    } catch(e) { showMsg('danger', e.message); }
  };

  const handleDeleteListItem = async (itemId) => {
    try {
      await apiFetch(`/price-lists/${selList.id}/items/${itemId}`, { method:'DELETE' }, token);
      loadListItems(selList.id);
    } catch(e) { showMsg('danger', e.message); }
  };

  const handleAssignList = async (customerId, priceListId) => {
    try {
      await apiFetch(`/customers/${customerId}`, { method:'PUT', body: JSON.stringify({ price_list_id: priceListId || null }) }, token);
      load();
    } catch(e) { showMsg('danger', e.message); }
  };

  // ── Funciones cupones ──────────────────────────────────────────────────
  const handleSaveCupon = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/coupons/', { method:'POST', body: JSON.stringify(cuponForm) }, token);
      showMsg('success', 'Cupón creado');
      setShowCuponModal(false); setCuponForm({ codigo:'', tipo:'descuento_pct', valor:'', fecha_inicio:'', fecha_fin:'', min_purchase:'', customer_id:'' });
      load();
    } catch(e) { showMsg('danger', e.message); }
  };

  const handleDeleteCupon = async (id) => {
    try {
      await apiFetch(`/coupons/${id}`, { method:'DELETE' }, token);
      showMsg('success', 'Cupón eliminado');
      setConfirmDelCupon(null); load();
    } catch(e) { showMsg('danger', e.message); }
  };

  const showMsg = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 3500);
  };

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = p => {
    setEditing(p);
    setForm({
      name:            p.name,
      type:            p.type,
      is_active:       p.is_active,
      product_id:      p.product_id,
      discount_value:  p.discount_value || '',
      buy_quantity:    p.buy_quantity   || 1,
      free_quantity:   p.free_quantity  || 1,
      free_product_id: p.free_product_id || '',
      date_from:       p.date_from || '',
      date_to:         p.date_to   || '',
    });
    setShowModal(true);
  };

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async e => {
    e.preventDefault();
    if (!form.name || !form.product_id) {
      showMsg('danger', 'Nombre y producto son requeridos');
      return;
    }
    setSaving(true);
    const body = {
      ...form,
      product_id:      parseInt(form.product_id),
      discount_value:  parseFloat(form.discount_value) || 0,
      buy_quantity:    parseInt(form.buy_quantity)  || 1,
      free_quantity:   parseInt(form.free_quantity) || 1,
      free_product_id: form.free_product_id ? parseInt(form.free_product_id) : null,
      date_from:       form.date_from || null,
      date_to:         form.date_to   || null,
    };
    try {
      const url    = editing ? `${API}${editing.id}` : API;
      const method = editing ? 'PUT' : 'POST';
      const res    = await fetch(url, { method, headers: h, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      showMsg('success', editing ? 'Promoción actualizada' : 'Promoción creada');
      setShowModal(false);
      load();
    } catch(e) { showMsg('danger', e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    try {
      await fetch(`${API}${id}`, { method: 'DELETE', headers: h });
      showMsg('success', 'Promoción eliminada');
      setConfirmDel(null);
      load();
    } catch { showMsg('danger', 'Error al eliminar'); }
  };

  const handleToggle = async promo => {
    try {
      const res     = await fetch(`${API}${promo.id}/toggle`, { method: 'PATCH', headers: h });
      const updated = await res.json();
      setPromos(prev => prev.map(p => p.id === updated.id ? updated : p));
    } catch { showMsg('danger', 'Error'); }
  };

  const activas = promos.filter(p => p.is_valid_today);
  const shown   = tab === 'activas' ? activas : promos;

  const selectedProduct     = products.find(p => p.id === parseInt(form.product_id));
  const selectedFreeProduct = products.find(p => p.id === parseInt(form.free_product_id));

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main style={{ marginLeft: 240, padding: 32 }}>
        <div className="d-flex align-items-center gap-2 text-muted">
          <div className="spinner-border spinner-border-sm"></div> Cargando...
        </div>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft:240, padding:28, background:'#f8fafc', minHeight:'100vh', width:'100%' }}>

        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold mb-0">🎁 Promociones y Precios</h4>
            <small className="text-muted">Promociones, listas de precios y cupones</small>
          </div>
          {mainTab === 'promociones' && <button className="btn btn-primary" onClick={openAdd}><i className="bi bi-plus-lg me-1"></i> Nueva promoción</button>}
          {mainTab === 'listas' && <button className="btn btn-primary" onClick={()=>{ setEditingList(null); setListForm({ nombre:'', descripcion:'', tipo:'porcentaje', descuento_pct:'' }); setShowListModal(true); }}>+ Nueva lista</button>}
          {mainTab === 'cupones' && <button className="btn btn-primary" onClick={()=>setShowCuponModal(true)}>+ Nuevo cupón</button>}
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2 mb-3`}>{alert.msg}</div>}

        {/* Tabs principales */}
        <ul className="nav nav-tabs mb-4">
          {[['promociones','🎁 Promociones'],['listas','🏷️ Listas de Precios'],['cupones','🎟️ Cupones']].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${mainTab===k?'active':''}`} onClick={()=>setMainTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* ══════ TAB PROMOCIONES ══════ */}
        {mainTab === 'promociones' && (<>
        <div className="row g-3 mb-4">
          {[
            { icon:'bi-tag-fill',         color:'#3b82f6', bg:'#eff6ff', label:'Total creadas',  val: promos.length },
            { icon:'bi-check-circle-fill',color:'#10b981', bg:'#f0fdf4', label:'Activas hoy',    val: activas.length },
            { icon:'bi-gift-fill',        color:'#8b5cf6', bg:'#f5f3ff', label:'Lleva gratis',   val: promos.filter(p=>p.type==='lleva_gratis').length },
            { icon:'bi-percent',          color:'#f59e0b', bg:'#fffbeb', label:'Descuentos %',   val: promos.filter(p=>p.type==='descuento_pct').length },
          ].map((c, i) => (
            <div key={i} className="col-6 col-md-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body d-flex align-items-center gap-3 py-3">
                  <div style={{ width:40, height:40, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={`bi ${c.icon}`} style={{ color:c.color, fontSize:18 }}></i>
                  </div>
                  <div>
                    <div className="fw-bold fs-5 lh-1">{c.val}</div>
                    <div className="text-muted" style={{ fontSize:12 }}>{c.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="btn-group btn-group-sm mb-3">
          <button className={`btn ${tab==='activas'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('activas')}>
            ✅ Activas hoy ({activas.length})
          </button>
          <button className={`btn ${tab==='todas'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('todas')}>
            📋 Todas ({promos.length})
          </button>
        </div>

        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize:13 }}>
                <thead style={{ background:'#f1f5f9' }}>
                  <tr>
                    {['Nombre','Tipo','Producto','Beneficio','Vigencia','Estado','Acciones'].map(h => (
                      <th key={h} style={{ padding:'11px 14px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted py-4">
                      {tab==='activas' ? 'No hay promociones activas hoy' : 'No hay promociones creadas'}
                    </td></tr>
                  )}
                  {shown.map(p => {
                    const st = statusBadge(p);
                    const prod = products.find(x => x.id === p.product_id);
                    const prodLabel = prod ? productLabel(prod) : (p.product_name || '—');
                    return (
                      <tr key={p.id}>
                        <td style={{ padding:'10px 14px', fontWeight:600 }}>{p.name}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background:'#ede9fe', color:'#6d28d9', fontSize:11, padding:'3px 9px', borderRadius:99, fontWeight:600 }}>
                            {TYPE_ICON[p.type]} {TYPE_LABEL[p.type]}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', color:'#374151', fontSize:12 }}>{prodLabel}</td>
                        <td style={{ padding:'10px 14px' }}>
                          {p.type==='descuento_pct'  && <span className="text-success fw-bold">-{p.discount_value}%</span>}
                          {p.type==='descuento_fijo' && <span className="text-success fw-bold">-{fmt(p.discount_value)}</span>}
                          {p.type==='lleva_gratis'   && (
                            <span style={{ fontSize:12 }}>
                              Compra <strong>{p.buy_quantity}</strong> → lleva <strong>{p.free_quantity}</strong>{' '}
                              {p.free_product_name
                                ? <span className="text-primary">({p.free_product_name})</span>
                                : 'gratis'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:12, color:'#64748b' }}>
                          {p.date_from || p.date_to
                            ? <>{p.date_from||'∞'} → {p.date_to||'∞'}</>
                            : <span className="text-muted">Sin fecha límite</span>}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background:st.bg, color:st.c, fontSize:11, padding:'3px 9px', borderRadius:99, fontWeight:600 }}>
                            {st.lb}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-outline-secondary" onClick={()=>openEdit(p)} title="Editar">
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className={`btn btn-sm ${p.is_active?'btn-outline-warning':'btn-outline-success'}`}
                              onClick={()=>handleToggle(p)}
                              title={p.is_active?'Desactivar':'Activar'}>
                              <i className={`bi ${p.is_active?'bi-pause-fill':'bi-play-fill'}`}></i>
                            </button>
                            <button className="btn btn-sm btn-outline-danger" onClick={()=>setConfirmDel(p)} title="Eliminar">
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Modal crear/editar ── */}
        {showModal && (
          <>
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1040 }} onClick={()=>setShowModal(false)}></div>
            <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'#fff', borderRadius:16, padding:28, zIndex:1050, width:530, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>

              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="fw-bold mb-0">{editing ? '✏️ Editar promoción' : '🎁 Nueva promoción'}</h5>
                <button className="btn-close" onClick={()=>setShowModal(false)}></button>
              </div>

              <form onSubmit={handleSave}>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Nombre <span className="text-danger">*</span></label>
                  <input className="form-control" value={form.name}
                    onChange={e=>set('name', e.target.value)}
                    placeholder="Ej: 2x1 en gaseosas, 15% dto. lácteos..." required />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Tipo <span className="text-danger">*</span></label>
                  <div className="d-flex gap-2">
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (
                      <label key={k} style={{
                        flex:1, padding:'10px 8px',
                        border:`2px solid ${form.type===k?'#3b82f6':'#e2e8f0'}`,
                        borderRadius:10, background:form.type===k?'#eff6ff':'#fff',
                        cursor:'pointer', textAlign:'center', fontSize:12, fontWeight:600
                      }}>
                        <input type="radio" name="type" value={k} checked={form.type===k}
                          onChange={()=>set('type', k)} style={{ display:'none' }} />
                        <div style={{ fontSize:18, marginBottom:4 }}>{TYPE_ICON[k]}</div>
                        {v}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    Producto al que aplica <span className="text-danger">*</span>
                  </label>
                  <select className="form-select" value={form.product_id}
                    onChange={e=>set('product_id', e.target.value)} required>
                    <option value="">— Seleccionar producto —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {productLabel(p)}
                      </option>
                    ))}
                  </select>
                  {selectedProduct && (
                    <div className="mt-2 px-3 py-2 rounded d-flex align-items-center gap-2"
                      style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:13 }}>
                      <i className="bi bi-box-seam text-success"></i>
                      <span className="fw-semibold">{selectedProduct.display_name || selectedProduct.name}</span>
                      <span className="text-muted">—</span>
                      <span className="text-success fw-bold">{fmt(selectedProduct.price)}</span>
                      <span className="badge bg-secondary ms-auto" style={{ fontSize:10 }}>
                        Stock: {selectedProduct.stock}
                      </span>
                    </div>
                  )}
                </div>

                {(form.type==='descuento_pct' || form.type==='descuento_fijo') && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      {form.type==='descuento_pct' ? 'Descuento (%)' : 'Descuento ($ COP)'}
                    </label>
                    <input type="number" className="form-control" min={0}
                      value={form.discount_value} onChange={e=>set('discount_value', e.target.value)}
                      placeholder={form.type==='descuento_pct' ? '15' : '5000'} />
                    {selectedProduct && form.discount_value > 0 && (
                      <div className="mt-2 px-3 py-2 rounded" style={{ background:'#fef9c3', fontSize:12 }}>
                        💰 Precio original: <strong>{fmt(selectedProduct.price)}</strong>
                        {' → '}
                        Precio con descuento:{' '}
                        <strong className="text-success">
                          {form.type==='descuento_pct'
                            ? fmt(parseFloat(selectedProduct.price) * (1 - parseFloat(form.discount_value)/100))
                            : fmt(parseFloat(selectedProduct.price) - parseFloat(form.discount_value))
                          }
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {form.type==='lleva_gratis' && (
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label fw-semibold">Compra (cantidad)</label>
                      <input type="number" className="form-control" min={1}
                        value={form.buy_quantity} onChange={e=>set('buy_quantity', e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold">Lleva gratis (cantidad)</label>
                      <input type="number" className="form-control" min={1}
                        value={form.free_quantity} onChange={e=>set('free_quantity', e.target.value)} />
                    </div>
                    {form.buy_quantity > 0 && form.free_quantity > 0 && selectedProduct && (
                      <div className="col-12">
                        <div className="px-3 py-2 rounded" style={{ background:'#f0f9ff', fontSize:12, border:'1px solid #bae6fd' }}>
                          🎁 Por cada <strong>{form.buy_quantity}</strong> {selectedProduct.display_name || selectedProduct.name} que compre el cliente,
                          lleva <strong>{form.free_quantity}</strong> gratis
                          {selectedFreeProduct && selectedFreeProduct.id !== selectedProduct.id
                            ? <> de <strong>{selectedFreeProduct.display_name || selectedFreeProduct.name}</strong></>
                            : ''}
                          .
                        </div>
                      </div>
                    )}
                    <div className="col-12">
                      <label className="form-label fw-semibold">
                        Producto gratis <span className="text-muted fw-normal">(opcional, si es diferente)</span>
                      </label>
                      <select className="form-select" value={form.free_product_id}
                        onChange={e=>set('free_product_id', e.target.value)}>
                        <option value="">— Mismo producto —</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {productLabel(p)}
                          </option>
                        ))}
                      </select>
                      {selectedFreeProduct && (
                        <div className="mt-2 px-3 py-2 rounded d-flex align-items-center gap-2"
                          style={{ background:'#fdf4ff', border:'1px solid #e9d5ff', fontSize:13 }}>
                          <i className="bi bi-gift text-purple" style={{ color:'#7c3aed' }}></i>
                          <span className="fw-semibold">{selectedFreeProduct.display_name || selectedFreeProduct.name}</span>
                          <span className="text-success fw-bold ms-auto">{fmt(selectedFreeProduct.price)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha inicio</label>
                    <input type="date" className="form-control" value={form.date_from}
                      onChange={e=>set('date_from', e.target.value)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Fecha fin</label>
                    <input type="date" className="form-control" value={form.date_to}
                      onChange={e=>set('date_to', e.target.value)} />
                  </div>
                  <div className="col-12">
                    <div className="form-text">Deja en blanco para que la promoción no tenga límite de fecha.</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" id="is_active"
                      checked={form.is_active} onChange={e=>set('is_active', e.target.checked)} />
                    <label className="form-check-label fw-semibold" htmlFor="is_active">
                      Promoción activa
                    </label>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary flex-fill"
                    onClick={()=>setShowModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary flex-fill" disabled={saving}>
                    {saving
                      ? <><span className="spinner-border spinner-border-sm me-1"></span>Guardando...</>
                      : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* ── Confirmar eliminar promoción ── */}
        <ConfirmModal
          show={!!confirmDel}
          titulo="¿Eliminar promoción?"
          mensaje={<>Se eliminará <strong>{confirmDel?.name}</strong>. Esta acción no se puede deshacer.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => handleDelete(confirmDel.id)}
          onCancelar={() => setConfirmDel(null)}
        />
        </>)}

        {/* ══════ TAB LISTAS DE PRECIOS ══════ */}
        {mainTab === 'listas' && (
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold py-2" style={{background:'#1e3a5f',color:'#fff'}}>Listas disponibles</div>
                <div className="list-group list-group-flush">
                  {!priceLists.length ? (
                    <div className="list-group-item text-muted text-center py-4">Sin listas creadas</div>
                  ) : priceLists.map(l=>(
                    <button key={l.id} className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selList?.id===l.id?'active':''}`}
                      onClick={()=>setSelList(l)}>
                      <div>
                        <div className="fw-semibold">{l.nombre}</div>
                        <div style={{fontSize:11}} className={selList?.id===l.id?'text-white-50':'text-muted'}>
                          {l.tipo==='porcentaje'?`${l.descuento_pct}% descuento`:'Precios manuales'}
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{fontSize:11}}
                        onClick={e=>{e.stopPropagation();setEditingList(l);setListForm({nombre:l.nombre,descripcion:l.descripcion||'',tipo:l.tipo,descuento_pct:l.descuento_pct||''});setShowListModal(true);}}>✏️</button>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-md-8">
              {!selList ? (
                <div className="text-center text-muted py-5"><div className="fs-2">👈</div><div>Selecciona una lista</div></div>
              ) : (
                <>
                  <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body py-3 d-flex justify-content-between">
                      <div>
                        <h5 className="fw-bold mb-0">{selList.nombre}</h5>
                        <span className={`badge ${selList.tipo==='porcentaje'?'bg-success':'bg-primary'}`}>
                          {selList.tipo==='porcentaje'?`${selList.descuento_pct}% descuento general`:'Precios manuales'}
                        </span>
                      </div>
                      <div className="text-muted small">{priceCustomers.filter(c=>c.price_list_id===selList.id).length} cliente(s)</div>
                    </div>
                  </div>
                  <div className="card border-0 shadow-sm mb-3">
                    <div className="card-header d-flex justify-content-between align-items-center py-2" style={{background:'#f8fafc'}}>
                      <span className="fw-semibold small">Precios especiales</span>
                      <button className="btn btn-sm btn-outline-primary py-0" onClick={()=>setShowItemForm(!showItemForm)}>
                        {showItemForm?'✕ Cancelar':'+ Agregar precio'}
                      </button>
                    </div>
                    {showItemForm && (
                      <div className="card-body border-bottom bg-light">
                        <form onSubmit={handleAddItem} className="row g-2 align-items-end">
                          <div className="col-5">
                            <input className="form-control form-control-sm" placeholder="Buscar producto..." value={prodSearch} onChange={e=>setProdSearch(e.target.value)} />
                            <select className="form-select form-select-sm mt-1" required size={4} value={itemForm.product_id}
                              onChange={e=>setItemForm({...itemForm,product_id:e.target.value})}>
                              <option value="">— Seleccionar —</option>
                              {priceProducts.filter(p=>!prodSearch||p.name.toLowerCase().includes(prodSearch.toLowerCase())).map(p=>(
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-4">
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">$</span>
                              <input type="number" className="form-control" required min="0" value={itemForm.precio_especial}
                                onChange={e=>setItemForm({...itemForm,precio_especial:e.target.value})} />
                            </div>
                          </div>
                          <div className="col-3"><button type="submit" className="btn btn-sm btn-success w-100">✅</button></div>
                        </form>
                      </div>
                    )}
                    <div className="card-body p-0">
                      {!listItems.length ? (
                        <div className="text-center text-muted py-3 small">Sin precios especiales</div>
                      ) : (
                        <table className="table table-sm mb-0" style={{fontSize:13}}>
                          <thead className="table-light"><tr><th>Producto</th><th className="text-end">Precio especial</th><th></th></tr></thead>
                          <tbody>
                            {listItems.map(i=>(
                              <tr key={i.id}>
                                <td>{i.product_name}</td>
                                <td className="text-end fw-bold text-success">${Number(i.precio_especial).toLocaleString('es-CO')}</td>
                                <td className="text-end">
                                  <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={()=>setConfirmDeleteItem(i)}>🗑</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                  <div className="card border-0 shadow-sm">
                    <div className="card-header fw-semibold py-2 small" style={{background:'#f8fafc'}}>Clientes con esta lista</div>
                    <div className="card-body p-0">
                      {!priceCustomers.filter(c=>c.price_list_id===selList.id).length ? (
                        <div className="text-center text-muted py-3 small">Sin clientes asignados</div>
                      ) : (
                        <table className="table table-sm mb-0" style={{fontSize:13}}>
                          <thead className="table-light"><tr><th>Cliente</th><th>Doc</th><th></th></tr></thead>
                          <tbody>
                            {priceCustomers.filter(c=>c.price_list_id===selList.id).map(c=>(
                              <tr key={c.id}>
                                <td className="fw-semibold">{c.full_name}</td>
                                <td className="text-muted">{c.doc_number}</td>
                                <td className="text-end">
                                  <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{fontSize:11}} onClick={()=>handleAssignList(c.id,null)}>Quitar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════ TAB CUPONES ══════ */}
        {mainTab === 'cupones' && (
          <div>
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                  <thead className="table-light">
                    <tr><th>Código</th><th>Cliente</th><th>Tipo</th><th className="text-end">Valor</th>
                      <th>Vigencia</th><th className="text-end">Mín. compra</th><th>Estado</th><th></th></tr>
                  </thead>
                  <tbody>
                    {!cupones.length ? (
                      <tr><td colSpan="8" className="text-center text-muted py-4">Sin cupones creados</td></tr>
                    ) : cupones.map(c=>(
                      <tr key={c.id} style={{opacity: !c.is_vigente ? 0.6 : 1}}>
                        <td><code className="fw-bold text-primary">{c.codigo}</code></td>
                        <td className="text-muted">{c.customer_name}</td>
                        <td>
                          <span className={`badge ${c.tipo==='descuento_pct'?'bg-success':c.tipo==='descuento_fijo'?'bg-primary':'bg-warning text-dark'}`}>
                            {c.tipo==='descuento_pct'?'% Descuento':c.tipo==='descuento_fijo'?'$ Fijo':'Puntos extra'}
                          </span>
                        </td>
                        <td className="text-end fw-bold">{c.tipo==='descuento_pct'?`${c.valor}%`:`$${Number(c.valor).toLocaleString('es-CO')}`}</td>
                        <td className="text-muted small">{c.fecha_inicio} → {c.fecha_fin}</td>
                        <td className="text-end">{c.min_purchase > 0 ? `$${Number(c.min_purchase).toLocaleString('es-CO')}` : '—'}</td>
                        <td>
                          {c.usado ? <span className="badge bg-secondary">Usado</span>
                            : c.is_vigente ? <span className="badge bg-success">Vigente</span>
                            : <span className="badge bg-danger">Vencido</span>}
                        </td>
                        <td>
                          {!c.usado && <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={()=>setConfirmDelCupon(c)}>🗑</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal lista de precios ── */}
        {showListModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">{editingList?'✏️ Editar':'🏷️ Nueva'} lista de precios</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setShowListModal(false)} />
                </div>
                <form onSubmit={handleSaveList}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Nombre *</label>
                      <input className="form-control" required value={listForm.nombre} onChange={e=>setListForm({...listForm,nombre:e.target.value})} placeholder="Ej: Mayorista, VIP..." />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Tipo *</label>
                      <select className="form-select" value={listForm.tipo} onChange={e=>setListForm({...listForm,tipo:e.target.value})}>
                        <option value="porcentaje">% Descuento general</option>
                        <option value="precio_manual">Precios especiales por producto</option>
                      </select>
                    </div>
                    {listForm.tipo === 'porcentaje' && (
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Porcentaje de descuento *</label>
                        <div className="input-group">
                          <input type="number" className="form-control" required min="0.1" max="100" step="0.1" value={listForm.descuento_pct}
                            onChange={e=>setListForm({...listForm,descuento_pct:e.target.value})} />
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowListModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold">✅ Guardar</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal nuevo cupón ── */}
        {showCuponModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">🎟️ Nuevo cupón</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setShowCuponModal(false)} />
                </div>
                <form onSubmit={handleSaveCupon}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">Código</label>
                        <input className="form-control" value={cuponForm.codigo} onChange={e=>setCuponForm({...cuponForm,codigo:e.target.value.toUpperCase()})} placeholder="Auto-generado si vacío" />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Tipo *</label>
                        <select className="form-select" required value={cuponForm.tipo} onChange={e=>setCuponForm({...cuponForm,tipo:e.target.value})}>
                          <option value="descuento_pct">% Descuento</option>
                          <option value="descuento_fijo">$ Descuento fijo</option>
                          <option value="puntos_extra">Puntos extra</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Valor *</label>
                        <div className="input-group">
                          <span className="input-group-text">{cuponForm.tipo==='descuento_pct'?'%':'$'}</span>
                          <input type="number" className="form-control" required min="0" value={cuponForm.valor} onChange={e=>setCuponForm({...cuponForm,valor:e.target.value})} />
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Compra mínima</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input type="number" className="form-control" min="0" value={cuponForm.min_purchase} onChange={e=>setCuponForm({...cuponForm,min_purchase:e.target.value})} />
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Fecha inicio *</label>
                        <input type="date" className="form-control" required value={cuponForm.fecha_inicio} onChange={e=>setCuponForm({...cuponForm,fecha_inicio:e.target.value})} />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Fecha fin *</label>
                        <input type="date" className="form-control" required value={cuponForm.fecha_fin} onChange={e=>setCuponForm({...cuponForm,fecha_fin:e.target.value})} />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Cliente específico</label>
                        <select className="form-select" value={cuponForm.customer_id} onChange={e=>setCuponForm({...cuponForm,customer_id:e.target.value})}>
                          <option value="">— Todos los clientes —</option>
                          {priceCustomers.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowCuponModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold">✅ Crear cupón</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirms ── */}
        <ConfirmModal
          show={!!confirmDeleteItem}
          titulo="¿Eliminar precio especial?"
          mensaje={<>Se eliminará el precio especial de <strong>{confirmDeleteItem?.product_name}</strong>.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => { handleDeleteListItem(confirmDeleteItem.id); setConfirmDeleteItem(null); }}
          onCancelar={() => setConfirmDeleteItem(null)}
        />
        <ConfirmModal
          show={!!confirmDelCupon}
          titulo="¿Eliminar cupón?"
          mensaje={<>Se eliminará el cupón <strong>{confirmDelCupon?.codigo}</strong>.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => handleDeleteCupon(confirmDelCupon.id)}
          onCancelar={() => setConfirmDelCupon(null)}
        />

      </main>
    </div>
  );
};

export default Promotions;