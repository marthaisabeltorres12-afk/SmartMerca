import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../services/productService';
import { supplierService } from '../../services/supplierService';
import { apiFetch } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import 'bootstrap/dist/css/bootstrap.min.css';

const EMPTY = { name:'', description:'', price:'', stock:'', category:'', barcode:'', supplier_id:'', expiry_date:'', discount:0, discount_start:'', discount_end:'', gramaje_cantidad:'', gramaje_unidad:'', iva_type:19 };

const CATEGORIAS = [
  '🥦 Frutas y Verduras','🥩 Carnes y Embutidos','🥛 Lácteos y Huevos',
  '🍞 Panadería y Repostería','🥤 Bebidas y Jugos','🍺 Bebidas Alcohólicas',
  '🍿 Snacks y Dulces','🥫 Enlatados y Conservas','🌾 Granos y Cereales',
  '🫙 Aceites y Condimentos','🧊 Congelados','🧹 Limpieza del Hogar',
  '🧴 Higiene Personal','👶 Bebés y Maternidad','🐾 Mascotas',
  '📝 Papelería','🔋 Electrónica y Pilas','💊 Medicamentos Básicos','📦 Otros',
];

const ManageProducts = () => {
  const { token } = useAuth();
  const [products, setProducts]           = useState([]);
  const [suppliers, setSuppliers]         = useState([]);
  const [search, setSearch]               = useState('');
  const [catFilter, setCatFilter]         = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [alert, setAlert]                 = useState(null);
  const [loading, setLoading]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [priceHistoryModal, setPriceHistoryModal] = useState(null);
  const [priceHistory, setPriceHistory]   = useState([]);

  const load = async () => {
    try {
      const [p, s] = await Promise.all([productService.getAll(token), supplierService.getAll(token)]);
      setProducts(p); setSuppliers(s);
    } catch (e) { showAlert('danger', e.message); }
  };
  useEffect(() => { load(); }, [token]);

  const showAlert = (type, msg) => { setAlert({type, msg}); setTimeout(() => setAlert(null), 3500); };

  const openPriceHistory = async (p) => {
    setPriceHistoryModal(p);
    setPriceHistory([]);
    try {
      const h = await apiFetch(`/products/${p.id}/price-history`, {}, token);
      setPriceHistory(Array.isArray(h) ? h : []);
    } catch(e) { setPriceHistory([]); }
  };
  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name||'', description: p.description||'', price: p.price||'',
      stock: p.stock||'', category: p.category||'', barcode: p.barcode||'',
      supplier_id: p.supplier_id||'', expiry_date: p.expiry_date||'',
      discount: p.discount||0, discount_start: p.discount_start||'', discount_end: p.discount_end||'',
      gramaje_cantidad: p.gramaje_cantidad||'', gramaje_unidad: p.gramaje_unidad||'',
      iva_type: p.iva_type ?? 19
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setLoading(true);
    const payload = {
      name: form.name, description: form.description,
      price: parseFloat(form.price), stock: parseInt(form.stock)||0,
      category: form.category, supplier_id: form.supplier_id ? parseInt(form.supplier_id) : null,
      expiry_date: form.expiry_date || null,
      discount:       parseFloat(form.discount)||0,
      discount_start: form.discount_start || null,
      discount_end:   form.discount_end   || null,
      iva_type:       parseInt(form.iva_type) ?? 19,
      gramaje_cantidad: form.gramaje_cantidad ? parseFloat(form.gramaje_cantidad) : null,
      gramaje_unidad:   form.gramaje_unidad   || null,
    };
    if (form.barcode) payload.barcode = form.barcode;
    try {
      if (editing) { await productService.update(editing.id, payload, token); showAlert('success','Producto actualizado'); }
      else         { await productService.create(payload, token);             showAlert('success','Producto creado'); }
      setShowModal(false); load();
    } catch (e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { await productService.delete(id, token); showAlert('success','Producto eliminado'); setConfirmDelete(null); load(); }
    catch (e) { showAlert('danger', e.message); }
  };

  const handleToggle = async (p) => {
    try {
      const updated = await productService.toggle(p.id, token);
      setProducts(prev => prev.map(x => x.id === updated.id ? updated : x));
    }
    catch (e) { showAlert('danger', e.message); }
  };

  // Calcular precio con descuento
  const priceWithDiscount = (p) => {
    if (!p.discount || p.discount <= 0) return null;
    if (p.discount_type === 'percent') return parseFloat(p.price) * (1 - p.discount/100);
    return parseFloat(p.price) - p.discount;
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search);
    const matchCat = catFilter === '' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-4">📦 Gestión de Productos</h4>

        {alert && <div className={`alert alert-${alert.type} alert-dismissible`}>{alert.msg}</div>}

        <div className="d-flex gap-2 mb-3 flex-wrap">
          <input className="form-control" style={{ maxWidth: 300 }}
            placeholder="🔍 Buscar por nombre, categoría o código..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select" style={{ maxWidth: 240 }}
            value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">📂 Todas las categorías</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {catFilter && (
            <button className="btn btn-outline-secondary" onClick={() => setCatFilter('')}>✕ Limpiar filtro</button>
          )}
         
        </div>

        <p className="text-muted small mb-2">
          Mostrando <strong>{filtered.length}</strong> de <strong>{products.length}</strong> productos
          {catFilter && <> en <strong>{catFilter}</strong></>}
        </p>

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr><th>#</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Descuento</th><th>Stock</th><th>Código</th><th>Proveedor</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="10" className="text-center text-muted py-4">No hay productos</td></tr>
                ) : filtered.map((p, i) => {
                  const discPrice = priceWithDiscount(p);
                  return (
                    <tr key={p.id}>
                      <td>{i+1}</td>
                      <td>
                        <div className="fw-semibold">{p.name}</div>
                        {p.gramaje_cantidad && p.gramaje_unidad && (
                          <div className="badge bg-light text-dark border" style={{fontSize:10}}>
                            ⚖️ {p.gramaje_cantidad} {p.gramaje_unidad}
                          </div>
                        )}
                        {p.description && <div className="text-muted small">{p.description.slice(0,40)}</div>}
                      </td>
                      <td><span className="badge bg-light text-dark border">{p.category || '—'}</span></td>
                      <td>
                        {discPrice ? (
                          <>
                            <div className="text-decoration-line-through text-muted small">${parseFloat(p.price).toLocaleString('es-CO')}</div>
                            <div className="text-success fw-bold">${discPrice.toLocaleString('es-CO', {maximumFractionDigits:0})}</div>
                          </>
                        ) : (
                          <span className="text-success fw-bold">${parseFloat(p.price).toLocaleString('es-CO')}</span>
                        )}
                      </td>
                      <td>
                        {p.active_discount > 0
                          ? <div>
                              <span className="badge bg-danger">🏷️ {p.active_discount}% OFF</span>
                              <div className="text-success fw-bold small">${Number(p.final_price).toLocaleString('es-CO')}</div>
                              {p.discount_end && <div className="text-muted" style={{fontSize:'0.7rem'}}>hasta {p.discount_end}</div>}
                            </div>
                          : p.discount > 0
                            ? <span className="badge bg-secondary">⏸️ {p.discount}% (inactivo)</span>
                            : <span className="text-muted small">—</span>
                        }
                      </td>
                      <td>
                        <span className={`badge ${p.stock <= 5 ? 'bg-danger' : p.stock <= 15 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                          {p.stock} {p.stock <= 5 && '⚠️'}
                        </span>
                      </td>
                      <td className="text-muted small">{p.barcode || '—'}</td>
                      <td>{p.supplier_display_name || p.supplier_company || p.supplier || '—'}</td>
                      <td>
                        <span className={`badge ${p.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="text-nowrap">
  <div className="d-flex align-items-center gap-1">
    <button
      className={`btn btn-sm ${p.is_active ? 'btn-outline-secondary' : 'btn-outline-success'}`}
      onClick={() => handleToggle(p)}
    >
      {p.is_active ? '❌' : '✅'}
    </button>

    <button
      className="btn btn-warning btn-sm"
      onClick={() => openEdit(p)}
    >
      ✏️
    </button>

    <button
      className="btn btn-sm btn-outline-info"
      title="Historial de precios"
      onClick={() => openPriceHistory(p)}
    >
      📊
    </button>

    <button
      className="btn btn-danger btn-sm"
      onClick={() => setConfirmDelete(p)}
    >
      🗑️
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

        {/* Modal Agregar/Editar */}
        {showModal && (
          <div className="modal d-block" style={{ background: 'rgba(0,0,0,.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{editing ? '✏️ Editar Producto' : '+ Nuevo Producto'}</h5>
                  <button className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Nombre *</label>
                        <input className="form-control" value={form.name}
                          onChange={e => setForm({...form, name: e.target.value})} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Categoría</label>
                        <select className="form-select" value={form.category}
                          onChange={e => setForm({...form, category: e.target.value})}>
                          <option value="">— Seleccionar categoría —</option>
                          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Precio *</label>
                        <input className="form-control" type="number" step="0.01" min="0"
                          value={form.price} onChange={e => setForm({...form, price: e.target.value})} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Stock</label>
                        <input className="form-control" type="number" min="0"
                          value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">⚠️ Stock mínimo</label>
                        <input className="form-control" type="number" min="0"
                          value={form.min_stock} onChange={e => setForm({...form, min_stock: e.target.value})} />
                        <div className="form-text text-muted">Alerta cuando baje de este nivel</div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Código de barras</label>
                        <input className="form-control" value={form.barcode}
                          onChange={e => setForm({...form, barcode: e.target.value})} />
                      </div>

                      {/* Gramaje */}
                      <div className="col-12">
                        <label className="form-label fw-semibold">⚖️ Gramaje / Presentación del producto</label>
                        <div className="row g-2">
                          <div className="col-md-4">
                            <label className="form-label small text-muted">Cantidad</label>
                            <input className="form-control" type="number" min="0" step="0.001"
                              placeholder="Ej: 500, 1.5, 250"
                              value={form.gramaje_cantidad}
                              onChange={e => setForm({...form, gramaje_cantidad: e.target.value})} />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small text-muted">Unidad</label>
                            <select className="form-select" value={form.gramaje_unidad}
                              onChange={e => setForm({...form, gramaje_unidad: e.target.value})}>
                              <option value="">— Sin gramaje —</option>
                              <option value="g">g (gramos)</option>
                              <option value="kg">kg (kilogramos)</option>
                              <option value="lb">lb (libras)</option>
                              <option value="oz">oz (onzas)</option>
                              <option value="ml">ml (mililitros)</option>
                              <option value="L">L (litros)</option>
                              <option value="und">und (unidad)</option>
                              <option value="m">m (metros)</option>
                            </select>
                          </div>
                          <div className="col-md-4 d-flex align-items-end">
                            {form.gramaje_cantidad && form.gramaje_unidad && (
                              <div className="p-2 rounded w-100 text-center" style={{background:'#f0f9ff', border:'1px solid #bae6fd'}}>
                                <div className="text-muted small">Vista previa del nombre</div>
                                <div className="fw-semibold">{form.name || 'Producto'} · {form.gramaje_cantidad} {form.gramaje_unidad}</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="form-text text-muted">Opcional. Aparece en el POS junto al nombre del producto.</div>
                      </div>

                      {/* IVA */}
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">🏛️ Tipo de IVA</label>
                        <select className="form-select" value={form.iva_type}
                          onChange={e => setForm({...form, iva_type: parseInt(e.target.value)})}>
                          <option value={0}>0% — Exento (canasta familiar)</option>
                          <option value={5}>5% — IVA reducido</option>
                          <option value={19}>19% — IVA general</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Proveedor</label>
                        <select className="form-select" value={form.supplier_id}
                          onChange={e => setForm({...form, supplier_id: e.target.value})}>
                          <option value="">— Sin proveedor —</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Fecha de Vencimiento</label>
                        <input className="form-control" type="date" value={form.expiry_date}
                          onChange={e => setForm({...form, expiry_date: e.target.value})} />
                      </div>

                      {/* Descuento */}
                      <div className="col-md-4">
                        <label className="form-label">🏷️ Descuento (%)</label>
                        <div className="input-group">
                          <input className="form-control" type="number" min="0" max="100" step="1"
                            placeholder="0" value={form.discount}
                            onChange={e => setForm({...form, discount: e.target.value})} />
                          <span className="input-group-text">%</span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">📅 Inicio descuento</label>
                        <input className="form-control" type="date" value={form.discount_start}
                          onChange={e => setForm({...form, discount_start: e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">📅 Fin descuento</label>
                        <input className="form-control" type="date" value={form.discount_end}
                          onChange={e => setForm({...form, discount_end: e.target.value})} />
                      </div>
                      {form.discount > 0 && form.price && (
                        <div className="col-12">
                          <div className="alert alert-success py-2 mb-0">
                            💰 Precio original: <strong>${parseFloat(form.price).toLocaleString('es-CO')}</strong>
                            {' → '}
                            Precio con descuento: <strong className="text-success">
                              ${(parseFloat(form.price) * (1 - form.discount/100)).toLocaleString('es-CO', {maximumFractionDigits:0})}
                            </strong>
                            {' '}({form.discount}% OFF)
                            {form.discount_start && form.discount_end && (
                              <span className="ms-2 text-muted small">
                                Vigente del {form.discount_start} al {form.discount_end}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="col-12">
                        <label className="form-label">Descripción</label>
                        <textarea className="form-control" rows={2} value={form.description}
                          onChange={e => setForm({...form, description: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-success" disabled={loading}>
                      {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Producto'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmar Eliminar */}
        <ConfirmModal
          show={!!confirmDelete}
          titulo="¿Eliminar producto?"
          mensaje={<>Se eliminará <strong>{confirmDelete?.name}</strong>. Esta acción no se puede deshacer.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => handleDelete(confirmDelete.id)}
          onCancelar={() => setConfirmDelete(null)}
        />

        {/* Modal historial de precios */}
        {priceHistoryModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">📊 Historial de precios — {priceHistoryModal.name}</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setPriceHistoryModal(null)} />
                </div>
                <div className="modal-body p-0">
                  {!priceHistory.length ? (
                    <div className="text-center text-muted py-4">Sin cambios de precio registrados</div>
                  ) : (
                    <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                      <thead className="table-light">
                        <tr>
                          <th>Fecha</th><th>Tipo</th>
                          <th className="text-end">Precio anterior</th>
                          <th className="text-end">Precio nuevo</th>
                          <th className="text-end">Variación</th>
                          <th>Cambiado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceHistory.map(h => {
                          const subio = h.precio_nuevo > h.precio_anterior;
                          return (
                            <tr key={h.id}>
                              <td className="text-muted">{h.created_at?.slice(0,16).replace('T',' ')}</td>
                              <td><span className={`badge ${h.tipo==='precio_venta'?'bg-primary':'bg-secondary'}`}>{h.tipo}</span></td>
                              <td className="text-end">${Number(h.precio_anterior).toLocaleString('es-CO')}</td>
                              <td className="text-end fw-bold">${Number(h.precio_nuevo).toLocaleString('es-CO')}</td>
                              <td className="text-end">
                                {h.variacion_pct != null && (
                                  <span className={`badge ${subio?'bg-danger':'bg-success'}`}>
                                    {subio?'▲':'▼'} {Math.abs(h.variacion_pct)}%
                                  </span>
                                )}
                              </td>
                              <td className="text-muted">{h.cambiado_por_nombre||'—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={()=>setPriceHistoryModal(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
export default ManageProducts;