import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../services/productService';
import { presentationService } from '../../services/presentationService';
import ConfirmModal from '../../components/ConfirmModal';

// Muestra gramaje junto al nombre si existe
const dname = (p) => {
  if (!p) return '';
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const q = parseFloat(p.gramaje_cantidad);
    return `${p.name} · ${q === Math.floor(q) ? Math.floor(q) : q} ${p.gramaje_unidad}`;
  }
  return p.display_name || p.name;
};

const fmt = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });

const EMPTY_FORM = { base_product_id:'', name:'', units_per_pack:'', price:'', barcode:'' };

const ManagePresentations = () => {
  const { token } = useAuth();
  const [products,      setProducts]      = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [alert,         setAlert]         = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [editing,       setEditing]       = useState(null);  // presentation id
  const [filterProd,    setFilterProd]    = useState('');    // filtrar por producto base
  const [searchBase,    setSearchBase]    = useState('');    // buscar en selector del form
  const [confirmDeletePres, setConfirmDeletePres] = useState(null);

  const load = async () => {
    try {
      const [p, pr] = await Promise.all([
        productService.getAll(token),
        presentationService.getAll(token),
      ]);
      setProducts(p);
      setPresentations(pr);
    } catch(e) { showAlert('danger', e.message); }
  };

  useEffect(() => { load(); }, [token]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.base_product_id || !form.name || !form.units_per_pack || !form.price) {
      showAlert('danger', 'Completa todos los campos obligatorios');
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        await presentationService.update(editing, form, token);
        showAlert('success', 'Presentación actualizada');
      } else {
        await presentationService.create(form, token);
        showAlert('success', 'Presentación creada');
      }
      setForm(EMPTY_FORM);
      setEditing(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleEdit = (p) => {
    setForm({
      base_product_id: String(p.base_product_id),
      name:            p.name,
      units_per_pack:  String(p.units_per_pack),
      price:           String(p.price),
      barcode:         p.barcode || '',
    });
    setEditing(p.id);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id, name) => {
    try {
      await presentationService.remove(id, token);
      showAlert('success', 'Eliminada');
      load();
    } catch(e) { showAlert('danger', e.message); }
  };

  // Productos agrupados con sus presentaciones
  const prodConPres = products.filter(p => {
    if (!filterProd) return true;
    const q = filterProd.toLowerCase();
    // Buscar por nombre del producto base
    if (dname(p).toLowerCase().includes(q)) return true;
    // Buscar por código de barras del producto base
    if (p.barcode && p.barcode.toLowerCase().includes(q)) return true;
    // Buscar dentro de las presentaciones (nombre o código)
    const pres = presentations.filter(pr => pr.base_product_id === p.id);
    return pres.some(pr =>
      (pr.name && pr.name.toLowerCase().includes(q)) ||
      (pr.barcode && pr.barcode.toLowerCase().includes(q))
    );
  });
  const presByProd = (prodId) => presentations.filter(p => p.base_product_id === prodId);

  const baseSelected = products.find(p => p.id === parseInt(form.base_product_id));

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <h4 className="fw-bold mb-1">🥚 Presentaciones de Venta</h4>
        <p className="text-muted mb-4">
          Define cómo se agrupan los productos para la venta. Ejemplo: llegan 500 huevos,
          se venden por media cubeta (15) o cubeta completa (30). El stock siempre se descuenta del producto base.
        </p>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        <div className="row g-4">
          {/* ── Formulario ── */}
          <div className="col-md-4">
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3"
                style={{ background: editing ? '#1e40af' : '#1e3a5f', color:'#fff' }}>
                {editing ? '✏️ Editar presentación' : '➕ Nueva presentación'}
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Producto base *</label>
                    <input className="form-control form-control-sm mb-1"
                      placeholder="Buscar producto por nombre o código..."
                      value={searchBase}
                      onChange={e => setSearchBase(e.target.value)} />
                    <select className="form-select" value={form.base_product_id}
                      onChange={e => setForm({...form, base_product_id:e.target.value})} required
                      size={searchBase ? Math.min(6, products.filter(p =>
                        dname(p).toLowerCase().includes(searchBase.toLowerCase()) ||
                        (p.barcode && p.barcode.includes(searchBase))
                      ).length + 1) : 1}>
                      <option value="">— Seleccionar —</option>
                      {products.filter(p =>
                        !searchBase ||
                        dname(p).toLowerCase().includes(searchBase.toLowerCase()) ||
                        (p.barcode && p.barcode.includes(searchBase))
                      ).map(p => (
                        <option key={p.id} value={p.id}>
                          {dname(p)} (Stock: {p.stock})
                        </option>
                      ))}
                    </select>
                    {baseSelected && (
                      <div className="form-text">
                        {dname(baseSelected)} — Stock: <strong>{baseSelected.stock}</strong> uds
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Nombre de la presentación *</label>
                    <input className="form-control" placeholder="Ej: Cubeta x30, Media cubeta"
                      value={form.name} onChange={e => setForm({...form, name:e.target.value})} required />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Unidades del producto base por pack *</label>
                    <div className="input-group">
                      <input type="number" className="form-control" min="1" step="1"
                        placeholder="Ej: 30"
                        value={form.units_per_pack}
                        onChange={e => setForm({...form, units_per_pack:e.target.value})} required />
                      <span className="input-group-text">uds</span>
                    </div>
                    {baseSelected && form.units_per_pack && (
                      <div className="form-text text-success">
                        Con {baseSelected.stock} en stock → hay <strong>
                          {Math.floor(baseSelected.stock / parseInt(form.units_per_pack||1))}
                        </strong> packs disponibles
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Precio de venta del pack *</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input type="number" className="form-control" min="0" step="1"
                        placeholder="0"
                        value={form.price}
                        onChange={e => setForm({...form, price:e.target.value})} required />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold small">Código de barras (opcional)</label>
                    <input className="form-control" placeholder="Código propio de la presentación"
                      value={form.barcode}
                      onChange={e => setForm({...form, barcode:e.target.value})} />
                    <div className="form-text">El cajero puede escanear este código para agregar la presentación</div>
                  </div>

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-dark flex-fill fw-bold" disabled={loading}>
                      {loading ? 'Guardando...' : editing ? '✅ Actualizar' : '➕ Crear'}
                    </button>
                    {editing && (
                      <button type="button" className="btn btn-outline-secondary"
                        onClick={() => { setForm(EMPTY_FORM); setEditing(null); }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Explicación visual */}
            <div className="card border-0 shadow-sm mt-3" style={{ background:'#f0fdf4' }}>
              <div className="card-body" style={{ fontSize:12 }}>
                <div className="fw-semibold mb-2">📖 ¿Cómo funciona?</div>
                <div className="d-flex flex-column gap-1">
                  <div>1. El producto base es la <strong>unidad mínima</strong> (ej: Huevo)</div>
                  <div>2. La presentación define cuántos entran en un pack (ej: 30)</div>
                  <div>3. Al vender 2 cubetas x30, se descuentan <strong>60 huevos</strong> del stock</div>
                  <div>4. El cajero ve la presentación en el buscador igual que cualquier producto</div>
                  <div>5. El stock siempre se muestra en <strong>unidades base</strong></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Lista de presentaciones ── */}
          <div className="col-md-8">
            <div className="mb-3">
              <input className="form-control" placeholder="🔍 Buscar por nombre de producto, presentación o código de barras..."
                value={filterProd}
                onChange={e => setFilterProd(e.target.value)} />
            </div>

            {prodConPres.length === 0 ? (
              <div className="text-center text-muted py-5">No hay productos</div>
            ) : prodConPres.map(prod => {
              const pres = presByProd(prod.id);
              if (!pres.length && filterProd) return null;
              return (
                <div key={prod.id} className="card border-0 shadow-sm mb-3">
                  <div className="card-header d-flex align-items-center justify-content-between py-2"
                    style={{ background:'#f8fafc' }}>
                    <div>
                      <span className="fw-semibold">{dname(prod)}</span>
                      <span className="badge bg-secondary ms-2" style={{ fontSize:10 }}>
                        Stock base: {prod.stock} uds
                      </span>
                      {prod.category && (
                        <span className="badge bg-light text-dark border ms-1" style={{ fontSize:10 }}>
                          {prod.category}
                        </span>
                      )}
                    </div>
                    <span className="text-muted small">{pres.length} presentacion{pres.length !== 1 ? 'es' : ''}</span>
                  </div>
                  {pres.length === 0 ? (
                    <div className="card-body py-2 text-muted small">Sin presentaciones — se vende por unidad</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0" style={{ fontSize:13 }}>
                        <thead className="table-light">
                          <tr>
                            <th>Presentación</th>
                            <th className="text-center">Uds. base</th>
                            <th className="text-end">Precio pack</th>
                            <th className="text-center">Stock packs</th>
                            <th style={{ fontFamily:'monospace', fontSize:11 }}>Código</th>
                            <th style={{ width:90 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pres.map(p => (
                            <tr key={p.id}>
                              <td className="fw-semibold">{p.name}</td>
                              <td className="text-center">
                                <span className="badge bg-primary">{p.units_per_pack}</span>
                              </td>
                              <td className="text-end text-success fw-bold">{fmt(p.price)}</td>
                              <td className="text-center">
                                <span className={`badge ${p.stock_packs === 0 ? 'bg-danger' : p.stock_packs <= 3 ? 'bg-warning text-dark' : 'bg-success'}`}>
                                  {p.stock_packs}
                                </span>
                              </td>
                              <td className="text-muted" style={{ fontFamily:'monospace', fontSize:11 }}>
                                {p.barcode || '—'}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <button className="btn btn-sm btn-outline-primary py-0 px-2"
                                    onClick={() => handleEdit(p)}>✏️</button>
                                  <button className="btn btn-sm btn-outline-danger py-0 px-2"
                                    onClick={() => setConfirmDeletePres({id: p.id, name: p.name})}>🗑️</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <ConfirmModal
        show={!!confirmDeletePres}
        titulo="¿Eliminar presentación?"
        mensaje={<>Se eliminará <strong>{confirmDeletePres?.name}</strong>. Esta acción no se puede deshacer.</>}
        txtConfirmar="Sí, eliminar"
        onConfirmar={() => { handleDelete(confirmDeletePres.id, confirmDeletePres.name); setConfirmDeletePres(null); }}
        onCancelar={() => setConfirmDeletePres(null)}
      />
    </div>
  );
};

export default ManagePresentations;