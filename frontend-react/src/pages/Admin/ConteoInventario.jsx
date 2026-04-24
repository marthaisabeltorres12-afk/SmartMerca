import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmtNum = n => Number(n||0).toLocaleString('es-CO');

const statusBadge = s => {
  if (s === 'en_progreso')       return <span className="badge bg-primary">🔄 En progreso</span>;
  if (s === 'conteo_terminado')  return <span className="badge bg-warning text-dark">✅ Conteo terminado</span>;
  if (s === 'ajustes_aprobados') return <span className="badge bg-success">✔️ Aprobado</span>;
  return <span className="badge bg-secondary">{s}</span>;
};

const ConteoInventario = () => {
  const { token } = useAuth();
  const [counts,    setCounts]    = useState([]);
  const [productos, setProductos] = useState([]);
  const [selected,  setSelected]  = useState(null); // conteo activo
  const [items,     setItems]     = useState([]);
  const [alert,     setAlert]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState('lista');

  // Form nuevo conteo
  const [newModal,  setNewModal]  = useState(false);
  const [newForm,   setNewForm]   = useState({ nombre:'', seccion:'' });

  // Conteo en progreso
  const [conteos,   setConteos]   = useState({}); // {item_id: cantidad}
  const [searchItem, setSearchItem] = useState('');

  // Aprobación
  const [aprobaciones, setAprobaciones] = useState({}); // {item_id: {status, justificacion}}

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const [cs, prods] = await Promise.all([
        apiFetch('/inventory-counts/', {}, token),
        apiFetch('/products/', {}, token),
      ]);
      setCounts(Array.isArray(cs) ? cs : []);
      setProductos(Array.isArray(prods) ? prods : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token]);

  const loadItems = useCallback(async (countId) => {
    try {
      const its = await apiFetch(`/inventory-counts/${countId}/items`, {}, token);
      setItems(Array.isArray(its) ? its : []);
      // Inicializar conteos con valores actuales
      const c = {};
      its.forEach(i => { c[i.id] = i.cantidad_contada ?? ''; });
      setConteos(c);
      // Inicializar aprobaciones
      const a = {};
      its.forEach(i => { a[i.id] = { status: 'aprobado', justificacion: '' }; });
      setAprobaciones(a);
    } catch(e) { setItems([]); }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selected) loadItems(selected.id); }, [selected, loadItems]);

  const handleCreate = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const c = await apiFetch('/inventory-counts/', { method:'POST', body: JSON.stringify(newForm) }, token);
      showAlert('success', `Conteo "${c.nombre}" iniciado con ${c.total_items} productos`);
      setNewModal(false); setNewForm({ nombre:'', seccion:'' });
      load();
      setSelected(c); setTab('contar');
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    const itemsData = Object.entries(conteos)
      .filter(([,v]) => v !== '' && v !== null)
      .map(([item_id, cantidad_contada]) => ({ item_id: parseInt(item_id), cantidad_contada: parseFloat(cantidad_contada) }));

    if (!itemsData.length) { showAlert('danger','Ingresa al menos una cantidad contada'); return; }
    setLoading(true);
    try {
      await apiFetch(`/inventory-counts/${selected.id}/register`, { method:'POST', body: JSON.stringify({ items: itemsData }) }, token);
      showAlert('success', 'Conteo registrado — revisa las diferencias');
      load();
      loadItems(selected.id);
      setTab('revisar');
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleApprove = async () => {
    const itemsData = items
      .filter(i => i.cantidad_contada !== null && i.diferencia !== null)
      .map(i => ({
        item_id:       i.id,
        status_ajuste: aprobaciones[i.id]?.status || 'aprobado',
        justificacion: aprobaciones[i.id]?.justificacion || '',
      }));
    setLoading(true);
    try {
      await apiFetch(`/inventory-counts/${selected.id}/approve`, { method:'POST', body: JSON.stringify({ items: itemsData }) }, token);
      showAlert('success', 'Ajustes aprobados — stock actualizado');
      setSelected(null); setItems([]);
      load(); setTab('lista');
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const categorias = [...new Set(productos.map(p=>p.category).filter(Boolean))].sort();
  const itemsFiltrados = items.filter(i =>
    !searchItem || i.product_name?.toLowerCase().includes(searchItem.toLowerCase())
  );
  const itemsConDiferencia = items.filter(i => i.cantidad_contada !== null && i.diferencia !== null && parseFloat(i.diferencia) !== 0);

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold mb-0">📋 Conteo Físico de Inventario</h4>
            <p className="text-muted small mb-0">Toma física, reconciliación y ajustes de stock</p>
          </div>
          <button className="btn btn-primary fw-bold" onClick={()=>setNewModal(true)}>
            + Iniciar conteo
          </button>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2`}>{alert.msg}</div>}

        <ul className="nav nav-tabs mb-4">
          {[['lista','📋 Conteos'],
            ...(selected ? [['contar','✏️ Contar'],['revisar','🔍 Revisar diferencias']] : [])
          ].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* Tab lista */}
        {tab === 'lista' && (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                <thead className="table-light">
                  <tr><th>Nombre</th><th>Bodega</th><th>Origen</th><th className="text-center">Productos</th>
                    <th className="text-center">Contados</th><th className="text-center">Diferencias</th>
                    <th>Estado</th><th>Fecha</th><th></th></tr>
                </thead>
                <tbody>
                  {!counts.length ? (
                    <tr><td colSpan="8" className="text-center text-muted py-4">Sin conteos realizados</td></tr>
                  ) : counts.map(c=>(
                    <tr key={c.id}>
                      <td className="fw-semibold">{c.nombre}</td>
                      <td className="text-muted">
                        {c.location_name
                          ? <span className="badge bg-primary" style={{fontSize:11}}>🏪 {c.location_name}</span>
                          : <span className="text-muted small">{c.seccion || 'Completo'}</span>}
                      </td>
                      <td>
                        <span className={`badge ${c.origen==='bodeguero'?'bg-warning text-dark':'bg-secondary'}`} style={{fontSize:10}}>
                          {c.origen==='bodeguero'?'📦 Bodeguero':'⚙️ Admin'}
                        </span>
                      </td>
                      <td className="text-center">{c.total_items}</td>
                      <td className="text-center">{c.contados}</td>
                      <td className="text-center">
                        {c.diferencias > 0
                          ? <span className="badge bg-warning text-dark">{c.diferencias}</span>
                          : <span className="text-muted">0</span>}
                      </td>
                      <td>{statusBadge(c.status)}</td>
                      <td className="text-muted">{c.created_at?.slice(0,10)}</td>
                      <td>
                        {c.status !== 'ajustes_aprobados' && (
                          <button className="btn btn-sm btn-outline-primary py-0 px-2"
                            onClick={()=>{ setSelected(c); setTab('contar'); }}>
                            {c.status === 'en_progreso' ? '✏️ Continuar' : '🔍 Revisar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab contar */}
        {tab === 'contar' && selected && (
          <div>
            <div className="alert alert-info py-2 mb-3 d-flex justify-content-between align-items-center">
              <span>📋 <strong>{selected.nombre}</strong> · {selected.seccion || 'Completo'} · {items.length} productos</span>
              <span className="text-muted small">Ingresa la cantidad física encontrada por producto</span>
            </div>

            <div className="mb-3">
              <input className="form-control" placeholder="🔍 Buscar producto..."
                value={searchItem} onChange={e=>setSearchItem(e.target.value)} />
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                  <thead className="table-light">
                    <tr><th>Producto</th><th>Categoría</th>
                      <th className="text-end">Stock sistema</th>
                      <th className="text-end" style={{width:140}}>Cantidad contada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsFiltrados.map(i=>(
                      <tr key={i.id} style={{background: conteos[i.id]!==''&&conteos[i.id]!==null&&parseFloat(conteos[i.id])!==i.stock_sistema?'#fffbeb':''}}>
                        <td className="fw-semibold">{i.product_name}</td>
                        <td className="text-muted">{i.product_category||'—'}</td>
                        <td className="text-end">{fmtNum(i.stock_sistema)}</td>
                        <td className="text-end">
                          <input type="number" className="form-control form-control-sm text-end"
                            min="0" step="1" style={{width:100}}
                            placeholder="0"
                            value={conteos[i.id] ?? ''}
                            onChange={e=>setConteos(prev=>({...prev,[i.id]:e.target.value}))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-secondary" onClick={()=>setTab('lista')}>← Volver</button>
              <button className="btn btn-success fw-bold" onClick={handleRegister} disabled={loading}>
                {loading ? '⏳ Guardando...' : '✅ Terminar conteo y ver diferencias'}
              </button>
            </div>
          </div>
        )}

        {/* Tab revisar diferencias */}
        {tab === 'revisar' && selected && (
          <div>
            <div className="alert alert-warning py-2 mb-3">
              <strong>{itemsConDiferencia.length} producto(s) con diferencias</strong> — Aprueba o rechaza cada ajuste antes de confirmar.
            </div>

            {!itemsConDiferencia.length ? (
              <div className="card border-0 shadow-sm p-4 text-center text-success">
                <div className="fs-2">✅</div>
                <div className="fw-bold">Todo el inventario cuadra perfectamente</div>
                <button className="btn btn-success mt-3 fw-bold" onClick={handleApprove} disabled={loading}>
                  Confirmar y cerrar conteo
                </button>
              </div>
            ) : (
              <>
                <div className="card border-0 shadow-sm mb-3">
                  <div className="table-responsive">
                    <table className="table align-middle mb-0" style={{fontSize:13}}>
                      <thead className="table-light">
                        <tr><th>Producto</th><th className="text-end">Sistema</th>
                          <th className="text-end">Contado</th><th className="text-end">Diferencia</th>
                          <th style={{width:120}}>Decisión</th><th>Justificación</th></tr>
                      </thead>
                      <tbody>
                        {itemsConDiferencia.map(i=>(
                          <tr key={i.id} style={{background: parseFloat(i.diferencia)<0?'#fff5f5':'#f0fff4'}}>
                            <td className="fw-semibold">{i.product_name}</td>
                            <td className="text-end">{fmtNum(i.stock_sistema)}</td>
                            <td className="text-end">{fmtNum(i.cantidad_contada)}</td>
                            <td className="text-end fw-bold">
                              <span className={parseFloat(i.diferencia)<0?'text-danger':'text-success'}>
                                {parseFloat(i.diferencia)>0?'+':''}{fmtNum(i.diferencia)}
                              </span>
                            </td>
                            <td>
                              <select className="form-select form-select-sm"
                                value={aprobaciones[i.id]?.status || 'aprobado'}
                                onChange={e=>setAprobaciones(prev=>({...prev,[i.id]:{...prev[i.id],status:e.target.value}}))}>
                                <option value="aprobado">✅ Aprobar</option>
                                <option value="rechazado">❌ Rechazar</option>
                              </select>
                            </td>
                            <td>
                              <input className="form-control form-control-sm"
                                placeholder="Motivo..."
                                value={aprobaciones[i.id]?.justificacion || ''}
                                onChange={e=>setAprobaciones(prev=>({...prev,[i.id]:{...prev[i.id],justificacion:e.target.value}}))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="d-flex gap-2 justify-content-end">
                  <button className="btn btn-secondary" onClick={()=>setTab('contar')}>← Volver a contar</button>
                  <button className="btn btn-success fw-bold" onClick={handleApprove} disabled={loading}>
                    {loading ? '⏳ Aplicando...' : `✅ Aprobar ajustes y actualizar stock`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Modal nuevo conteo */}
        {newModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">📋 Iniciar nuevo conteo</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setNewModal(false)} />
                </div>
                <form onSubmit={handleCreate}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Nombre del conteo *</label>
                      <input className="form-control" required value={newForm.nombre}
                        onChange={e=>setNewForm({...newForm,nombre:e.target.value})}
                        placeholder="Ej: Conteo mensual abril 2026" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Sección / categoría</label>
                      <select className="form-select" value={newForm.seccion}
                        onChange={e=>setNewForm({...newForm,seccion:e.target.value})}>
                        <option value="">— Todos los productos —</option>
                        {categorias.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="form-text">Deja vacío para contar todos los productos</div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setNewModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={loading}>
                      {loading ? '⏳ Iniciando...' : '✅ Iniciar conteo'}
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

export default ConteoInventario;