import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt    = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtNum = n => Number(n||0).toLocaleString('es-CO');

const tipoIcon = t => ({ bodega:'🏭', sala:'🛒', produccion:'⚙️', frio:'🧊' })[t] || '📦';
const tipoBadge = t => {
  const map = { bodega:'secondary', sala:'success', produccion:'warning', frio:'info' };
  return <span className={`badge bg-${map[t]||'secondary'}`}>{tipoIcon(t)} {t}</span>;
};

const EMPTY_LOC = { nombre:'', tipo:'bodega', requiere_temperatura: false };
const EMPTY_TRANSFER = { product_id:'', from_location_id:'', to_location_id:'', cantidad:'', motivo:'' };

const Bodegas = () => {
  const { token } = useAuth();
  const [locations,  setLocations]  = useState([]);
  const [products,   setProducts]   = useState([]);
  const [transfers,  setTransfers]  = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [locStock,   setLocStock]   = useState([]);
  const [tab,        setTab]        = useState('ubicaciones');
  const [alert,      setAlert]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');

  const [locModal,       setLocModal]       = useState(false);
  const [locForm,        setLocForm]        = useState(EMPTY_LOC);
  const [editingLoc,     setEditingLoc]     = useState(null);
  const [transferModal,  setTransferModal]  = useState(false);
  const [transferForm,   setTransferForm]   = useState(EMPTY_TRANSFER);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const [locs, prods, trans] = await Promise.all([
        apiFetch('/locations/', {}, token),
        apiFetch('/products/', {}, token),
        apiFetch('/locations/transfers', {}, token),
      ]);
      setLocations(Array.isArray(locs)  ? locs  : []);
      setProducts(Array.isArray(prods)  ? prods.filter(p=>p.is_active) : []);
      setTransfers(Array.isArray(trans) ? trans : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token]);

  const loadLocStock = useCallback(async (locId) => {
    try {
      const s = await apiFetch(`/locations/${locId}/stock`, {}, token);
      setLocStock(Array.isArray(s) ? s : []);
    } catch(e) { setLocStock([]); }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected) loadLocStock(selected.id); }, [selected, loadLocStock]);

  const handleSaveLoc = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editingLoc) {
        await apiFetch(`/locations/${editingLoc.id}`, { method:'PUT', body: JSON.stringify(locForm) }, token);
      } else {
        await apiFetch('/locations/', { method:'POST', body: JSON.stringify(locForm) }, token);
      }
      showAlert('success', editingLoc ? 'Ubicación actualizada' : 'Ubicación creada');
      setLocModal(false); setLocForm(EMPTY_LOC); setEditingLoc(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleTransfer = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiFetch('/locations/transfers', { method:'POST', body: JSON.stringify(transferForm) }, token);
      showAlert('success', 'Traslado registrado correctamente');
      setTransferModal(false); setTransferForm(EMPTY_TRANSFER);
      load();
      if (selected) loadLocStock(selected.id);
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const filteredStock = locStock.filter(i =>
    !search || i.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Alertas: sala con stock bajo pero bodega con disponible
  const alertasSurtido = [];
  if (selected?.tipo === 'sala') {
    locStock.filter(i => {
      const prod = products.find(p=>p.id===i.product_id);
      return prod && parseFloat(i.cantidad) <= (prod.min_stock||5);
    });
  }

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold mb-0">🏭 Bodegas y Ubicaciones</h4>
            <p className="text-muted small mb-0">Control de stock por ubicación y traslados</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={()=>{ setTransferModal(true); setTransferForm(EMPTY_TRANSFER); }}>
              🔄 Registrar traslado
            </button>
            <button className="btn btn-primary fw-bold" onClick={()=>{ setEditingLoc(null); setLocForm(EMPTY_LOC); setLocModal(true); }}>
              + Nueva ubicación
            </button>
          </div>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2`}>{alert.msg}</div>}

        <ul className="nav nav-tabs mb-4">
          {[['ubicaciones','🏭 Ubicaciones'],['traslados','🔄 Historial traslados']].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* Tab ubicaciones */}
        {tab === 'ubicaciones' && (
          <div className="row g-4">
            {/* Panel izquierdo — lista */}
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold py-2" style={{background:'#1e3a5f',color:'#fff'}}>
                  Ubicaciones ({locations.length})
                </div>
                <div className="list-group list-group-flush">
                  {!locations.length ? (
                    <div className="list-group-item text-muted text-center py-4">Sin ubicaciones</div>
                  ) : locations.map(l=>(
                    <button key={l.id}
                      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selected?.id===l.id?'active':''}`}
                      onClick={()=>setSelected(l)}>
                      <div>
                        <div className="fw-semibold">{tipoIcon(l.tipo)} {l.nombre}</div>
                        <div style={{fontSize:11}} className={selected?.id===l.id?'text-white-50':'text-muted'}>
                          {l.tipo}{l.requiere_temperatura?' · ❄️ Requiere temp.':''}
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{fontSize:10}}
                        onClick={e=>{ e.stopPropagation(); setEditingLoc(l); setLocForm({nombre:l.nombre,tipo:l.tipo,requiere_temperatura:l.requiere_temperatura}); setLocModal(true); }}>
                        ✏️
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel derecho — stock */}
            <div className="col-md-8">
              {!selected ? (
                <div className="text-center text-muted py-5">
                  <div className="fs-2">👈</div>
                  <div>Selecciona una ubicación para ver su stock</div>
                </div>
              ) : (
                <>
                  <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body py-3 d-flex justify-content-between align-items-center">
                      <div>
                        <h5 className="fw-bold mb-0">{tipoIcon(selected.tipo)} {selected.nombre}</h5>
                        {tipoBadge(selected.tipo)}
                        {selected.requiere_temperatura && <span className="badge bg-info ms-1">❄️ Temperatura</span>}
                      </div>
                      <div className="text-end">
                        <div className="fw-bold fs-5">{locStock.length}</div>
                        <div className="text-muted small">productos</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-2">
                    <input className="form-control form-control-sm" placeholder="Buscar producto..."
                      value={search} onChange={e=>setSearch(e.target.value)} />
                  </div>

                  <div className="card border-0 shadow-sm">
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                        <thead className="table-light">
                          <tr><th>Producto</th><th className="text-end">Cantidad</th></tr>
                        </thead>
                        <tbody>
                          {!filteredStock.length ? (
                            <tr><td colSpan="2" className="text-center text-muted py-4">Sin stock en esta ubicación</td></tr>
                          ) : filteredStock.map(i=>(
                            <tr key={i.id}>
                              <td className="fw-semibold">{i.product_name}</td>
                              <td className="text-end fw-bold">{fmtNum(i.cantidad)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab historial traslados */}
        {tab === 'traslados' && (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                <thead className="table-light">
                  <tr><th>Fecha</th><th>Producto</th><th>Desde</th><th>Hacia</th>
                    <th className="text-end">Cantidad</th><th>Motivo</th><th>Registrado por</th></tr>
                </thead>
                <tbody>
                  {!transfers.length ? (
                    <tr><td colSpan="7" className="text-center text-muted py-4">Sin traslados registrados</td></tr>
                  ) : transfers.map(t=>(
                    <tr key={t.id}>
                      <td className="text-muted">{t.created_at?.slice(0,10)}</td>
                      <td className="fw-semibold">{t.product_name}</td>
                      <td className="text-muted">🏭 {t.from_location}</td>
                      <td className="text-muted">📦 {t.to_location}</td>
                      <td className="text-end fw-bold">{fmtNum(t.cantidad)}</td>
                      <td className="text-muted">{t.motivo||'—'}</td>
                      <td className="text-muted">{t.created_by_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal ubicación */}
        {locModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">{editingLoc?'✏️ Editar':'🏭 Nueva'} ubicación</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setLocModal(false)} />
                </div>
                <form onSubmit={handleSaveLoc}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Nombre *</label>
                      <input className="form-control" required value={locForm.nombre}
                        onChange={e=>setLocForm({...locForm,nombre:e.target.value})}
                        placeholder="Ej: Bodega principal, Sala de ventas..." />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Tipo *</label>
                      <select className="form-select" value={locForm.tipo}
                        onChange={e=>setLocForm({...locForm,tipo:e.target.value})}>
                        <option value="bodega">🏭 Bodega</option>
                        <option value="sala">🛒 Sala de ventas</option>
                        <option value="produccion">⚙️ Producción</option>
                        <option value="frio">🧊 Cuarto frío</option>
                      </select>
                    </div>
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="tempCheck"
                        checked={locForm.requiere_temperatura}
                        onChange={e=>setLocForm({...locForm,requiere_temperatura:e.target.checked})} />
                      <label className="form-check-label" htmlFor="tempCheck">
                        ❄️ Requiere control de temperatura
                      </label>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setLocModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={loading}>
                      {loading?'Guardando...':'✅ Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal traslado */}
        {transferModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#166534',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">🔄 Registrar Traslado</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setTransferModal(false)} />
                </div>
                <form onSubmit={handleTransfer}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Producto *</label>
                      <select className="form-select" required value={transferForm.product_id}
                        onChange={e=>setTransferForm({...transferForm,product_id:e.target.value})}>
                        <option value="">— Seleccionar —</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
                      </select>
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">Origen *</label>
                        <select className="form-select" required value={transferForm.from_location_id}
                          onChange={e=>setTransferForm({...transferForm,from_location_id:e.target.value})}>
                          <option value="">— Seleccionar —</option>
                          {locations.map(l=><option key={l.id} value={l.id}>{tipoIcon(l.tipo)} {l.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Destino *</label>
                        <select className="form-select" required value={transferForm.to_location_id}
                          onChange={e=>setTransferForm({...transferForm,to_location_id:e.target.value})}>
                          <option value="">— Seleccionar —</option>
                          {locations.filter(l=>l.id!==parseInt(transferForm.from_location_id)).map(l=>(
                            <option key={l.id} value={l.id}>{tipoIcon(l.tipo)} {l.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Cantidad *</label>
                      <input type="number" className="form-control" required min="0.001" step="1"
                        value={transferForm.cantidad}
                        onChange={e=>setTransferForm({...transferForm,cantidad:e.target.value})} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Motivo</label>
                      <input className="form-control" value={transferForm.motivo}
                        onChange={e=>setTransferForm({...transferForm,motivo:e.target.value})}
                        placeholder="Ej: Surtir góndola, Reposición sala..." />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setTransferModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-success fw-bold" disabled={loading}>
                      {loading?'Guardando...':'✅ Registrar traslado'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Bodegas;