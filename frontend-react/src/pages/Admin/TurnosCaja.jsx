import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { shiftService } from '../../services/shiftService';
import { userService } from '../../services/userService';
import { cashCloseService } from '../../services/cashCloseService';
// eslint-disable-next-line no-unused-vars
import { exportCierresPDF, exportCierresExcel } from '../../services/exportService';
import { cashAdjustmentService } from '../../services/cashAdjustmentService';
import { apiFetch } from '../../services/api';

const fmt   = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtDt = s => s ? new Date(s).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

// ══════════════════════════════════════════════
// VISTA CAJERO
// ══════════════════════════════════════════════
const CashierView = ({ token, user }) => {
  const [shift,       setShift]       = useState(undefined);
  const [loading,     setLoading]     = useState(true);
  const [cashCounted, setCashCounted] = useState('');
  const [submitted,   setSubmitted]   = useState(false);
  const [alert,       setAlert]       = useState(null);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4500); };

  const load = useCallback(async () => {
    try { setShift(await shiftService.getActive(token)); }
    catch(e) {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitCount = async (e) => {
    e.preventDefault();
    if (!cashCounted) { showAlert('danger','Ingresa el total de efectivo'); return; }
    try {
      await shiftService.submitCashierCount(shift.id, { cash_counted: parseFloat(cashCounted) }, token);
      setSubmitted(true);
      showAlert('success','Conteo enviado al administrador');
      load();
    } catch(e) { showAlert('danger', e.message); }
  };

  if (loading) return <div className="text-center py-5"><div className="spinner-border"/></div>;

  return (
    <div className="row justify-content-center">
      <div className="col-md-5">
        {alert && (
          <div style={{
            position:'fixed', bottom:28, right:28, zIndex:99999,
            minWidth:350, borderRadius:12, padding:'14px 20px',
            fontWeight:600, fontSize:15,
            background: alert.type==='success'?'#f0fdf4':'#fef2f2',
            color: alert.type==='success'?'#166534':'#991b1b',
            border: `1.5px solid ${alert.type==='success'?'#86efac':'#fca5a5'}`,
            boxShadow: alert.type==='success'?'0 4px 20px rgba(34,197,94,0.35)':'0 4px 20px rgba(239,68,68,0.35)',
            animation:'slideDown 0.3s ease',
          }}>
            <i className={`bi me-2 ${alert.type==='success'?'bi-check-circle-fill':'bi-x-circle-fill'}`}></i>
            {alert.msg}
          </div>
        )}
        {!shift ? (
          <div className="card border-0 shadow-sm text-center py-5">
            <div className="fs-2 mb-2"><i className="bi bi-clock-history me-2"></i></div>
            <div className="fw-semibold">No tienes turno activo</div>
            <div className="text-muted small mt-1">El administrador abrirá tu turno</div>
          </div>
        ) : (
          <>
            <div className="card border-success border-2 mb-4">
              <div className="card-body text-center py-4">
                <div className="fs-1 mb-1"><i className="bi bi-check-circle-fill text-success"></i></div>
                <div className="fw-bold fs-5">Turno activo</div>
                {shift.cash_register && (
                  <div className="badge bg-primary mb-1"><i className="bi bi-display me-1"></i>{shift.cash_register}</div>
                )}
                <div className="text-muted small">Desde: {fmtDt(shift.opened_at)}</div>
              </div>
            </div>
            {shift.cashier_count_requested && !shift.cash_counted_by_cashier && !submitted && (
              <div className="card border-warning border-2">
                <div className="card-header fw-semibold py-3" style={{ background:'#92400e', color:'#fff' }}>
                  <i className="bi bi-clipboard-data me-2"></i> El admin solicita el conteo de caja
                </div>
                <div className="card-body">
                  <p className="text-muted small mb-3">
                    Cuenta todo el dinero físico en caja e ingresa el total.
                    <strong> No verás el total del sistema</strong> — solo ingresa lo que tienes.
                  </p>
                  <form onSubmit={handleSubmitCount}>
                    <div className="mb-4">
                      <label className="form-label fw-semibold"><i className="bi bi-currency-dollar me-2"></i> Total efectivo en caja</label>
                      <div className="input-group input-group-lg">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="0" step="1"
                          placeholder="0" value={cashCounted}
                          onChange={e => setCashCounted(e.target.value)} autoFocus required />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-warning w-100 fw-bold btn-lg">
                      <i className="bi bi-send me-2"></i> Enviar conteo al admin
                    </button>
                  </form>
                </div>
              </div>
            )}
            {(submitted || shift.cash_counted_by_cashier) && (
              <div className="card border-success">
                <div className="card-body text-center py-4">
                  <div className="fs-2 mb-2"><i className="bi bi-check-circle-fill text-success"></i></div>
                  <div className="fw-bold">Conteo enviado</div>
                  <div className="text-muted small">El administrador revisará y cerrará el turno</div>
                </div>
              </div>
            )}
            {!shift.cashier_count_requested && (
              <div className="card border-0 shadow-sm">
                <div className="card-body text-center py-3 text-muted small">
                  Cuando el administrador solicite el conteo, aparecerá el formulario aquí
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════
// PANEL MULTI-CAJA (dentro de AdminView)
// ══════════════════════════════════════════════
const PanelCajas = ({ token, cajas, users, onRefresh, branches = [] }) => {
  const [modalNueva, setModalNueva] = useState(false);
  const [modalEditar,setModalEditar]= useState(null);
  const [formNueva,  setFormNueva]  = useState({ nombre:'', descripcion:'', cajero_ids:[], base_amount:'', branch_id:'' });
  const [guardando,  setGuardando]  = useState(false);
  const [error,      setError]      = useState('');

  const toggleCajero = (form, setForm, id) => {
    const ids = form.cajero_ids.includes(id)
      ? form.cajero_ids.filter(x => x !== id)
      : [...form.cajero_ids, id];
    setForm(f => ({...f, cajero_ids: ids}));
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!formNueva.nombre.trim()) { setError('El nombre es requerido'); return; }
    setGuardando(true); setError('');
    try {
      await apiFetch('/cajas/', { method:'POST', body: JSON.stringify({
        nombre:      formNueva.nombre,
        descripcion: formNueva.descripcion,
        cajero_ids:  formNueva.cajero_ids,
        base_amount: parseFloat(formNueva.base_amount||0),
        branch_id:   formNueva.branch_id ? parseInt(formNueva.branch_id) : null,
      }) }, token);
      setModalNueva(false);
      setFormNueva({ nombre:'', descripcion:'', cajero_ids:[], base_amount:'', branch_id:'' });
      onRefresh();
    } catch(e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    setGuardando(true); setError('');
    try {
      await apiFetch(`/cajas/${modalEditar.caja.id}`, { method:'PUT', body: JSON.stringify({
        nombre:      modalEditar.nombre,
        descripcion: modalEditar.descripcion,
        cajero_ids:  modalEditar.cajero_ids,
        base_amount: parseFloat(modalEditar.base_amount||0),
        branch_id:   modalEditar.branch_id ? parseInt(modalEditar.branch_id) : null,
      }) }, token);
      setModalEditar(null);
      onRefresh();
    } catch(e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  const handleDesactivar = async (id, nombre) => {
    if (!window.confirm(`¿Desactivar "${nombre}"?`)) return;
    try { await apiFetch(`/cajas/${id}`, { method:'DELETE' }, token); onRefresh(); }
    catch(e) { alert(e.message); }
  };

  const FormCajeros = ({ form, setForm }) => (
    <div className="mb-3">
      <label className="form-label fw-semibold small">Cajeros autorizados</label>
      <div className="border rounded p-2" style={{maxHeight:160, overflowY:'auto'}}>
        {users.length === 0 && <div className="text-muted small">No hay cajeros registrados</div>}
        {users.map(u => (
          <div key={u.id} className="form-check">
            <input className="form-check-input" type="checkbox"
              id={`caj-${u.id}`}
              checked={form.cajero_ids.includes(u.id)}
              onChange={() => toggleCajero(form, setForm, u.id)}/>
            <label className="form-check-label small" htmlFor={`caj-${u.id}`}>
              {u.name}
            </label>
          </div>
        ))}
      </div>
      <div className="form-text">
        Cualquiera de estos cajeros puede abrir turno en esta caja al iniciar sesión
      </div>
    </div>
  );

  const totalDia = cajas.reduce((a,c) => a + (c.total_hoy||0), 0);

  return (
    <div>
      {/* Resumen */}
      <div className="row g-3 mb-4">
        {[
          ['Total cajas',  cajas.length,                                    'primary'],
['Abiertas',     cajas.filter(c=>c.status==='ocupada').length,    'success'],
['Disponibles',  cajas.filter(c=>c.status==='disponible').length, 'secondary'],
['Total del día',fmt(totalDia),                                    'warning'],
        ].map(([l,v,c]) => (
          <div key={l} className="col-md-3 col-6">
            <div className={`card border-0 shadow-sm border-start border-${c} border-3`}>
              <div className="card-body py-3">
                <div className="text-muted small">{l}</div>
                <div className={`fw-bold fs-5 text-${c}`}>{v}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Estado en tiempo real</h6>
        <button className="btn btn-primary btn-sm fw-bold" onClick={() => setModalNueva(true)}>
          + Nueva caja
        </button>
      </div>

      {/* Tarjetas de cajas */}
      <div className="row g-3 mb-4">
        {cajas.map(({ caja, cajero_actual, cajeros_auth, abierta_desde, ventas_hoy, total_hoy, status, turno_activo }) => (
          <div key={caja.id} className="col-md-4 col-sm-6">
            <div className={`card border-0 shadow-sm h-100 ${status==='ocupada'?'border-success border-2':''}`}>
              <div className={`card-header d-flex justify-content-between align-items-center
                ${status==='ocupada'?'bg-success text-white':'bg-light'}`}>
                <span className="fw-bold"><i className="bi bi-display" style={{fontSize:28}}></i> {caja.nombre}</span>
                <span className={`badge ${status==='ocupada'?'bg-white text-success':'bg-secondary'}`}>
                  {status==='ocupada'
  ? <><i className="bi bi-circle-fill me-1" style={{fontSize:8}}></i>Abierta</>
  : <><i className="bi bi-circle me-1" style={{fontSize:8}}></i>Libre</>}

                </span>
              </div>
              <div className="card-body">
                {turno_activo ? (
                  <>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                        style={{width:36,height:36,background:'#2563eb',fontSize:16,flexShrink:0}}>
                        {cajero_actual?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-semibold">{cajero_actual}</div>
                        <div className="text-muted" style={{fontSize:11}}>Desde: {abierta_desde?.slice(11,16)}</div>
                      </div>
                    </div>
                    <div className="row g-2">
                      <div className="col-6">
                        <div className="p-2 rounded text-center" style={{background:'#f0fdf4'}}>
                          <div className="text-muted" style={{fontSize:11}}>Ventas</div>
                          <div className="fw-bold text-success">{ventas_hoy||0}</div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-2 rounded text-center" style={{background:'#eff6ff'}}>
                          <div className="text-muted" style={{fontSize:11}}>Total</div>
                          <div className="fw-bold text-primary" style={{fontSize:12}}>{fmt(total_hoy||0)}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <span className={`badge ${turno_activo.status==='abierto'?'bg-success':turno_activo.status==='pendiente_cierre'?'bg-warning text-dark':'bg-secondary'}`}>
                        {turno_activo.status==='abierto'?'En turno':turno_activo.status==='pendiente_cierre'?' Pendiente cierre':'Cerrado'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted py-2">
                    <div style={{fontSize:28}}><i className="bi bi-display" style={{fontSize:48}}></i></div>
                    <div className="small mt-1">Sin turno activo</div>
                    {cajeros_auth?.length > 0 && (
                      <div className="mt-2">
                        <div className="text-muted" style={{fontSize:11}}>Cajeros autorizados:</div>
                        <div className="d-flex flex-wrap gap-1 justify-content-center mt-1">
                          {cajeros_auth.map(c => (
                            <span key={c.id} className="badge bg-light text-dark border" style={{fontSize:10}}>
                              👤 {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {caja.descripcion && (
                <div className="card-footer text-muted small">{caja.descripcion}</div>
              )}
              <div className="card-footer d-flex justify-content-between py-1">
                <button className="btn btn-sm btn-outline-primary py-0"
                  onClick={()=>setModalEditar({
                    caja,
                    nombre:      caja.nombre,
                    descripcion: caja.descripcion||'',
                    cajero_ids:  caja.cajero_ids||[],
                    base_amount: caja.base_amount||0,
                    branch_id:   caja.branch_id ? String(caja.branch_id) : ''
                  })}>
                  <i className="bi bi-pencil"></i> Editar
                </button>
                <button className="btn btn-sm btn-outline-danger py-0"
                  disabled={status==='ocupada'}
                  onClick={()=>handleDesactivar(caja.id, caja.nombre)}>
                  <i className="bi bi-trash"></i> Desactivar
                </button>
              </div>
            </div>
          </div>
        ))}
        {!cajas.length && (
          <div className="col-12 text-center py-5 text-muted">
            <div style={{fontSize:48}}><i className="bi bi-display" style={{fontSize:48}}></i></div>
            <div className="mt-2">No hay cajas configuradas</div>
            <button className="btn btn-primary mt-3" onClick={()=>setModalNueva(true)}>
              <i className="bi bi-plus"></i> Crear primera caja
            </button>
          </div>
        )}
      </div>

      {modalNueva && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                <h5 className="modal-title fw-bold"><i className="bi bi-display" style={{fontSize:28}}></i> Nueva caja</h5>
                <button className="btn-close btn-close-white" onClick={()=>setModalNueva(false)}/>
              </div>
              <form onSubmit={handleCrear}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Nombre *</label>
                    <input className="form-control" placeholder="Ej: Caja 1, Caja Express..."
                      value={formNueva.nombre}
                      onChange={e=>setFormNueva(f=>({...f,nombre:e.target.value}))} required/>
                  </div>
                  <FormCajeros form={formNueva} setForm={setFormNueva} />
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">💵 Base inicial</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input type="number" className="form-control" min="0" step="1000" placeholder="50000"
                        value={formNueva.base_amount}
                        onChange={e=>setFormNueva(f=>({...f,base_amount:e.target.value}))}/>
                    </div>
                  </div>
                  {branches.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold small"><i className="bi bi-geo-alt me-1"></i>Sucursal</label>
                    <select className="form-select" value={formNueva.branch_id}
                      onChange={e=>setFormNueva(f=>({...f,branch_id:e.target.value}))}>
                      <option value="">— Sin sucursal —</option>
                      {branches.map(b=><option key={b.id} value={String(b.id)}>{b.nombre}</option>)}
                    </select>
                  </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Descripción (opcional)</label>
                    <input className="form-control" placeholder="Ej: Caja entrada principal"
                      value={formNueva.descripcion}
                      onChange={e=>setFormNueva(f=>({...f,descripcion:e.target.value}))}/>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={()=>setModalNueva(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary fw-bold" disabled={guardando}>
                    {guardando?'Creando...':'✅ Crear caja'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar caja */}
      {modalEditar && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                <h5 className="modal-title fw-bold">✏️ Editar {modalEditar.caja.nombre}</h5>
                <button className="btn-close btn-close-white" onClick={()=>setModalEditar(null)}/>
              </div>
              <form onSubmit={handleEditar}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Nombre *</label>
                    <input className="form-control" value={modalEditar.nombre}
                      onChange={e=>setModalEditar(m=>({...m,nombre:e.target.value}))} required/>
                  </div>
                  <FormCajeros form={modalEditar} setForm={setModalEditar} />
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">💵 Base inicial</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input type="number" className="form-control" min="0" step="1000"
                        value={modalEditar.base_amount}
                        onChange={e=>setModalEditar(m=>({...m,base_amount:e.target.value}))}/>
                    </div>
                  </div>
                  {branches.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold small"><i className="bi bi-geo-alt me-1"></i>Sucursal</label>
                    <select className="form-select" value={modalEditar.branch_id||''}
                      onChange={e=>setModalEditar(m=>({...m,branch_id:e.target.value}))}>
                      <option value="">— Sin sucursal —</option>
                      {branches.map(b=><option key={b.id} value={String(b.id)}>{b.nombre}</option>)}
                    </select>
                  </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Descripción</label>
                    <input className="form-control" value={modalEditar.descripcion}
                      onChange={e=>setModalEditar(m=>({...m,descripcion:e.target.value}))}/>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={()=>setModalEditar(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary fw-bold" disabled={guardando}>
                    {guardando?'Guardando...':'✅ Guardar cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
// VISTA ADMIN
// ══════════════════════════════════════════════
const AdminView = ({ token }) => {
  const [tab,         setTab]         = useState('cajas');
  const [shifts,      setShifts]      = useState([]);
  const [closes,      setCloses]      = useState([]);
  const [users,       setUsers]       = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [branches,    setBranches]    = useState([]);
  const [cajas,       setCajas]       = useState([]);
  const [alert,       setAlert]       = useState(null);
  const [loading,     setLoading]     = useState(false);

  const [baseForm,    setBaseForm]    = useState({ cashier_id:'', base_amount:'', branch_id:'', cash_register_id:'' });
  const [wdModal,     setWdModal]     = useState(null);
  const [wdAmount,    setWdAmount]    = useState('');
  const [wdReason,    setWdReason]    = useState('');
  const [pinValue,    setPinValue]    = useState('');
  const [pinError,    setPinError]    = useState('');
  const [pinLoading,  setPinLoading]  = useState(false);
  const [closeModal,  setCloseModal]  = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [comment,     setComment]     = useState('');
  // eslint-disable-next-line no-unused-vars
  const [filterClose, setFilterClose] = useState('todos');
  const [adjModal,    setAdjModal]    = useState(null);
  const [adjTipo,     setAdjTipo]     = useState('ingreso');
  const [adjMonto,    setAdjMonto]    = useState('');
  const [adjMotivo,   setAdjMotivo]   = useState('');
  const [adjLoading,  setAdjLoading]  = useState(false);
  const [adjList,     setAdjList]     = useState([]);
  const [filterCaj,   setFilterCaj]   = useState('');
  const [filterDate,  setFilterDate]  = useState('');
  const [expanded,    setExpanded]    = useState(null);
  const [detail,      setDetail]      = useState({});

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4500); };

  const load = useCallback(async () => {
    try {
      const [allShifts, allCloses] = await Promise.all([
        shiftService.getAll(token),
        cashCloseService.getAll(token),
      ]);
      setShifts(Array.isArray(allShifts) ? allShifts : []);
      setCloses(Array.isArray(allCloses) ? allCloses : []);

      try {
        const cajeros = await apiFetch('/cajas/cajeros', {}, token);
        setUsers(Array.isArray(cajeros) ? cajeros : []);
      } catch(e) {
        // fallback al endpoint de usuarios
        try {
          const usersData = await userService.getAll(token);
          setUsers((Array.isArray(usersData) ? usersData : []).filter(u => u.role === 'cajero'));
        } catch(e2) { setUsers([]); }
      }

      try {
        const brs = await apiFetch('/branches/', {}, token);
        setBranches(Array.isArray(brs) ? brs : []);
      } catch(e) { setBranches([]); }

      // Cargar cajas
      try {
        const dashCajas = await apiFetch('/cajas/dashboard', {}, token);
        setCajas(dashCajas.cajas || []);
      } catch(e) { setCajas([]); }

    } catch(e) { console.error(e); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh cajas cada 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const d = await apiFetch('/cajas/dashboard', {}, token);
        setCajas(d.cajas || []);
      } catch(e) {}
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const openShifts = shifts.filter(s => s.status === 'abierto');
  const pendientes = closes.filter(c => c.status === 'pendiente').length;

  // eslint-disable-next-line no-unused-vars
  const handleOpen = async (e) => {
    e.preventDefault();
    try {
      await shiftService.open({
        cashier_id:       parseInt(baseForm.cashier_id),
        base_amount:      parseFloat(baseForm.base_amount||0),
        branch_id:        baseForm.branch_id ? parseInt(baseForm.branch_id) : null,
        cash_register_id: baseForm.cash_register_id ? parseInt(baseForm.cash_register_id) : null,
      }, token);
      showAlert('success','Turno abierto correctamente');
      setBaseForm({ cashier_id:'', base_amount:'', branch_id:'', cash_register_id:'' });
      load();
      setTab('activos');
    } catch(e) { showAlert('danger', e.message); }
  };

  const handleRequestCount = async (shift) => {
    try {
      await shiftService.requestCount(shift.id, token);
      showAlert('success','Se solicitó el conteo al cajero');
      load();
    } catch(e) { showAlert('danger', e.message); }
  };

  const handleClose = async () => {
    setLoading(true);
    try {
      await shiftService.close({ shift_id: closeModal.id }, token);
      showAlert('success','Turno cerrado correctamente');
      setCloseModal(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleWithdrawal = async () => {
    if (!wdAmount || parseFloat(wdAmount)<=0) { showAlert('danger','Monto inválido'); return; }
    if (!wdReason.trim()) { showAlert('danger','Ingresa el motivo'); return; }
    if (!pinValue.trim()) { setPinError('Ingresa el PIN'); return; }
    setPinLoading(true); setPinError('');
    try {
      const res = await fetch('/api/pin/verify', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token },
        body: JSON.stringify({ pin:pinValue, action:'retiro_efectivo', detail:`Retiro $${wdAmount} — ${wdReason}` }),
      });
      const data = await res.json();
      if (!res.ok) { setPinError(data.message||'PIN incorrecto'); return; }
      await shiftService.addWithdrawal({ shift_id:wdModal.id, amount:parseFloat(wdAmount), reason:wdReason, authorized_by:data.admin_id }, token);
      showAlert('success',`Retiro registrado. Autorizado por ${data.admin_name}`);
      setWdModal(null); setWdAmount(''); setWdReason(''); setPinValue('');
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setPinLoading(false); }
  };

  const handleReview = async (status) => {
    setLoading(true);
    try {
      await cashCloseService.review(selected.id, { status, admin_comment: comment }, token);
      showAlert('success', status==='aprobado' ? 'Cierre aprobado' : 'Cierre rechazado');
      setSelected(null); setComment('');
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const openAdjModal = async (cierre) => {
    setAdjModal(cierre);
    setAdjTipo('ingreso'); setAdjMonto(''); setAdjMotivo('');
    try {
      const lista = await cashAdjustmentService.getAll(token, cierre.id);
      setAdjList(Array.isArray(lista) ? lista : []);
    } catch(e) { setAdjList([]); }
  };

  const handleAdjustment = async () => {
    if (!adjMonto || parseFloat(adjMonto) <= 0) { showAlert('danger', 'Ingresa un monto válido'); return; }
    if (!adjMotivo.trim()) { showAlert('danger', 'El motivo es obligatorio'); return; }
    setAdjLoading(true);
    try {
      await cashAdjustmentService.create({
        tipo:                    adjTipo,
        monto:                   parseFloat(adjMonto),
        motivo:                  adjMotivo.trim(),
        relacionado_a_cierre_id: adjModal._from_shift ? null : adjModal.id,
        relacionado_a_turno_id:  adjModal._from_shift ? adjModal.id : null,
      }, token);
      showAlert('success', `Ajuste de ${adjTipo} registrado correctamente`);
      const lista = await cashAdjustmentService.getAll(token, adjModal._from_shift ? null : adjModal.id);
      setAdjList(Array.isArray(lista) ? lista : []);
      setAdjMonto(''); setAdjMotivo(''); setAdjTipo('ingreso');
    } catch(e) { showAlert('danger', e.message || 'Error al registrar ajuste'); }
    finally { setAdjLoading(false); }
  };

  const loadDetail = async (id) => {
    if (expanded===id) { setExpanded(null); return; }
    if (!detail[id]) {
      try { const d = await shiftService.getDetail(id, token); setDetail(p=>({...p,[id]:d})); }
      catch(e) {}
    }
    setExpanded(id);
  };

  const statusBadge = s => {
    if (s==='aprobado')  return <span className="badge bg-success"><i className="bi bi-check-circle-fill"></i> Aprobado</span>;
    if (s==='rechazado') return <span className="badge bg-danger"><i className="bi bi-x-circle"></i> Rechazado</span>;
    return <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split"></i> Pendiente</span>;
  };

  const cajeros   = [...new Set(shifts.map(s=>s.cashier).filter(Boolean))].sort();
  const filteredH = shifts.filter(s => (!filterCaj || s.cashier===filterCaj) && (!filterDate || s.opened_at?.slice(0,10)===filterDate));
  // eslint-disable-next-line no-unused-vars
  const filteredC = filterClose==='todos' ? closes : closes.filter(c=>c.status===filterClose);

  return (
    <div>
      {alert && (
        <div style={{
          position:'fixed', bottom:28, right:28, zIndex:99999,
          minWidth:350, borderRadius:12, padding:'14px 20px',
          fontWeight:600, fontSize:15,
          background: alert.type==='success'?'#f0fdf4':alert.type==='warning'?'#fffbeb':'#fef2f2',
          color: alert.type==='success'?'#166534':alert.type==='warning'?'#854d0e':'#991b1b',
          border: `1.5px solid ${alert.type==='success'?'#86efac':alert.type==='warning'?'#fde047':'#fca5a5'}`,
          boxShadow: alert.type==='success'?'0 4px 20px rgba(34,197,94,0.35)':alert.type==='warning'?'0 4px 20px rgba(234,179,8,0.35)':'0 4px 20px rgba(239,68,68,0.35)',
          animation:'slideDown 0.3s ease',
        }}>
          <i className={`bi me-2 ${alert.type==='success'?'bi-check-circle-fill':alert.type==='warning'?'bi-exclamation-triangle-fill':'bi-x-circle-fill'}`}></i>
          {alert.msg}
        </div>
      )}
      <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* KPIs */}
      <div className="row g-3 mb-4">
        {[
          { icon:<i className="bi bi-display"></i>,            value: cajas.filter(c=>c.status==='ocupada').length + '/' + cajas.length, label:'Cajas abiertas', color:'success' },
          { icon:<i className="bi bi-circle-fill"></i>, value: openShifts.length,                              label:'Turnos activos',    color:'primary' },
          { icon:<i className="bi bi-hourglass-split"></i>, value: pendientes,                                      label:'Cierres pendientes',color:'warning' },
          { icon:<i className="bi bi-check-circle fill"></i>, value: closes.filter(c=>c.status==='aprobado').length,  label:'Cierres aprobados', color:'secondary' },
        ].map((k,i) => (
          <div key={i} className="col-6 col-md-3">
            <div className={`card border-${k.color} border-2 text-center`}>
              <div className="card-body py-2">
                <div className="fs-4">{k.icon}</div>
                <div className={`fs-3 fw-bold text-${k.color}`}>{k.value}</div>
                <div className="text-muted small">{k.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
       {[
  { k:'cajas',     l: <><i className="bi bi-display me-1"></i>Cajas</>,        badge: cajas.filter(c=>c.status==='ocupada').length },
  { k:'activos',   l: <><i className="bi bi-circle-fill me-1" style={{fontSize:10,color:'#22c55e'}}></i>Turnos activos</>, badge: openShifts.length },
  { k:'historial', l: <><i className="bi bi-clock-history me-1"></i>Historial</>, badge: 0 },
].map(({k,l,badge}) => (
          <li key={k} className="nav-item">
            <button className={`nav-link ${tab===k?'active fw-bold':''}`} onClick={()=>setTab(k)}>
              {l}
              {badge > 0 && <span className="badge bg-success ms-1">{badge}</span>}
            </button>
          </li>
        ))}
      </ul>

      {/* ── CAJAS (MULTI-CAJA) ── */}
      {tab === 'cajas' && (
        <PanelCajas token={token} cajas={cajas} users={users} onRefresh={load} branches={branches} />
      )}

      {/* ── TURNOS ACTIVOS ── */}
      {tab === 'activos' && (
        <div>
          {!openShifts.length ? (
            <div className="text-center text-muted py-5">
              <div className="fs-2"><i className="bi bi-inbox" style={{fontSize:40}}></i></div>
              <div>No hay turnos abiertos</div>
              <div className="small mt-1">Los cajeros abren turno automáticamente al iniciar sesión</div>
            </div>
          ) : openShifts.map(s => {
            const cashExp = parseFloat(s.base_amount) + parseFloat(s.total_cash) - parseFloat(s.total_withdrawals);
            return (
              <div key={s.id} className="card border-0 shadow-sm mb-4">
                <div className="card-header d-flex align-items-center justify-content-between py-3"
                  style={{ background:'#f0fdf4', borderLeft:'4px solid #22c55e' }}>
                  <div>
                    <span className="fw-bold fs-6"><i className="bi bi-person me-1"></i> {s.cashier}</span>
                    {s.cash_register && <span className="badge bg-primary ms-2"><i className="bi bi-display me-1"></i> {s.cash_register}</span>}
                    <span className="text-muted small ms-3">Desde: {fmtDt(s.opened_at)}</span>
                    <span className="badge bg-success ms-2">Activo</span>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-sm btn-outline-warning"
                      onClick={()=>{ setWdModal(s); setWdAmount(''); setWdReason(''); setPinValue(''); setPinError(''); }}>
                      <i className="bi bi-box-arrow-up me-1"></i> Retiro
                    </button>
                    {!s.cashier_count_requested
                      ? <button className="btn btn-sm btn-outline-info" onClick={()=>handleRequestCount(s)}>
                          <i className="bi bi-clipboard-check me-1"></i> Pedir conteo
                        </button>
                      : !s.cash_counted_by_cashier
                        ? <span className="badge bg-warning text-dark align-self-center"><i className="bi bi-hourglass-split me-1"></i> Esperando conteo del cajero</span>
                        : <button className="btn btn-sm btn-danger fw-bold" onClick={()=>setCloseModal(s)}>
                           <i className="bi bi-stop-circle me-1"></i>
                          </button>
                    }
                  </div>
                </div>
                <div className="card-body">
                  <div className="row g-3 text-center mb-2">
                    {[
                      ['Base inicial',      s.base_amount,      'secondary'],
                      ['Total ventas',       s.total_sales,      'success'],
                      ['Efectivo ventas',    s.total_cash,       'success'],
                      ['Tarjeta',           s.total_card,       'primary'],
                      ['Nequi',             s.total_nequi,      'secondary'],
                      ['Retiros',           s.total_withdrawals,'danger'],
                      ['Efectivo esperado', cashExp,            'dark'],
                    ].map(([label,val,color],i) => (
                      <div key={i} className="col-6 col-md-3">
                        <div className="text-muted" style={{fontSize:11}}>{label}</div>
                        <div className={`fw-bold text-${color}`}>{fmt(val)}</div>
                      </div>
                    ))}
                    {s.cash_counted_by_cashier && (
                      <div className="col-6 col-md-3">
                        <div className="text-muted" style={{fontSize:11}}>Cajero contó</div>
                        <div className="fw-bold text-warning">{fmt(s.cash_counted_by_cashier)}</div>
                      </div>
                    )}
                  </div>
                  {s.withdrawals?.length > 0 && (
                    <div className="border-top pt-2 mt-2">
                      <div className="small text-muted fw-semibold mb-1">Retiros:</div>
                      {s.withdrawals.map(w => (
                        <div key={w.id} className="d-flex gap-2 align-items-center p-2 rounded mb-1" style={{background:'#fff5f5',fontSize:12}}>
                          <span className="text-danger fw-bold">-{fmt(w.amount)}</span>
                          <span className="text-muted">·</span>
                          <span>{w.reason}</span>
                          {w.authorizer && <span className="badge bg-secondary">Auth: {w.authorizer}</span>}
                          <span className="ms-auto text-muted">{fmtDt(w.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {tab === 'historial' && (
        <div>
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Cajero</label>
                  <select className="form-select" value={filterCaj} onChange={e=>setFilterCaj(e.target.value)}>
                    <option value="">Todos</option>
                    {cajeros.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Fecha</label>
                  <input type="date" className="form-control" value={filterDate} onChange={e=>setFilterDate(e.target.value)} />
                </div>
                <div className="col-auto">
                  <button className="btn btn-secondary" onClick={()=>{setFilterCaj('');setFilterDate('');}}>Limpiar</button>
                </div>
              </div>
            </div>
          </div>
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                <thead className="table-light">
                  <tr><th>#</th><th>Cajero</th><th>Caja</th><th>Sucursal</th><th>Apertura</th><th>Cierre</th>
                    <th className="text-end">Base</th><th className="text-end">Ventas</th>
                    <th className="text-end">Cajero contó</th><th className="text-end">Diferencia</th>
                    <th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {!filteredH.length
                    ? <tr><td colSpan="12" className="text-center text-muted py-4">Sin turnos</td></tr>
                    : filteredH.map(s => {
                      const diff         = parseFloat(s.difference ?? 0);
                      const ajustesIngreso = parseFloat(s.ajustes_ingreso ?? 0);
                      const diffReal       = diff + ajustesIngreso; // faltante real tras ajustes
                      const isOpen = s.status === 'abierto';
                      const saldado = diff < 0 && diffReal >= 0;
                      return (
                        <React.Fragment key={s.id}>
                          <tr style={{background: isOpen?'#f0fdf4': diff<0&&saldado?'#fefce8': diff<0?'#fff5f5':''}}>
                            <td className="text-muted">{s.id}</td>
                            <td className="fw-semibold"><i className="bi bi-person me-1"></i>{s.cashier}</td>
<td className="text-muted">{s.cash_register ? <><i className="bi bi-display me-1"></i>{s.cash_register}</> : '—'}</td>
<td className="text-muted">{s.branch_name ? <><i className="bi bi-geo-alt me-1"></i>{s.branch_name}</> : <span className="text-muted">—</span>}</td>

                            <td className="text-muted">{fmtDt(s.opened_at)}</td>
                            <td className="text-muted">{s.closed_at ? fmtDt(s.closed_at) : <span className="badge bg-success">Abierto</span>}</td>
                            <td className="text-end">{fmt(s.base_amount)}</td>
                            <td className="text-end text-success fw-semibold">{fmt(s.total_sales)}</td>
                            <td className="text-end">{s.cash_counted!=null ? fmt(s.cash_counted) : '—'}</td>
                            <td className="text-end fw-bold">
                              {s.difference!=null
                                ? <span className={diff>=0?'text-success':saldado?'text-success':'text-danger'}>{diff>=0?'+':''}{fmt(diff)}{saldado?' ✓':''}</span>
                                : '—'}
                            </td>
                            <td><span className={`badge ${isOpen?'bg-success':diff<0&&!saldado?'bg-danger':diff<0&&saldado?'bg-warning text-dark':'bg-secondary'}`}>{isOpen?'Abierto':diff<0&&saldado?'✓ Saldado':diff<0?'Faltante':'Cerrado'}</span></td>
                            <td>
                              <div className="d-flex gap-1">
                                <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={()=>loadDetail(s.id)}>{expanded===s.id?'▲':'▼'}</button>
                                {!isOpen && s.difference!=null && (
                                  <button className="btn btn-sm btn-outline-success py-0 px-2"
                                    onClick={()=>openAdjModal({ id:s.id, cashier:s.cashier, date:s.closed_at?s.closed_at.slice(0,10):s.opened_at.slice(0,10), system_total:s.total_sales, cash_counted:s.cash_counted, difference:s.difference, status:s.status, _from_shift:true })}>
                                    <i className="bi bi-sliders"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expanded===s.id && detail[s.id] && (
                            <tr><td colSpan="11" className="p-0">
                              <div className="bg-light p-3">
                                <div className="d-flex gap-2 flex-wrap mb-2">
                                  {[['Efectivo',detail[s.id].total_cash,'success'],['Tarjeta',detail[s.id].total_card,'primary'],
                                    ['Nequi',detail[s.id].total_nequi,'secondary'],['Transferencia',detail[s.id].total_transfer,'warning'],
                                    ['Crédito',detail[s.id].total_credit,'danger'],
                                  ].filter(([,v])=>parseFloat(v||0)>0).map(([label,val,color])=>(
                                    <span key={label} className={`badge bg-${color} px-2 py-1`}>{label}: {fmt(val)}</span>
                                  ))}
                                </div>
                                {detail[s.id].withdrawals?.length>0 && (
                                  <div className="small text-muted">
                                    <strong>Retiros:</strong> {detail[s.id].withdrawals.map(w=>`-${fmt(w.amount)} (${w.reason})`).join(' | ')}
                                  </div>
                                )}
                                <div className="small text-muted mt-1">{detail[s.id].sales_count} venta(s) en este turno</div>
                              </div>
                            </td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modales — sin cambios */}
      {wdModal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9999}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#92400e',color:'#fff'}}>
                <h5 className="modal-title fw-bold"><i className="bi bi-arrow-down-circle me-2"></i> Retiro — {wdModal.cashier}</h5>
                <button className="btn-close btn-close-white" onClick={()=>setWdModal(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold">Monto *</label>
                  <div className="input-group"><span className="input-group-text">$</span>
                    <input type="number" className="form-control" min="0" placeholder="0"
                      value={wdAmount} onChange={e=>setWdAmount(e.target.value)} autoFocus />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Motivo *</label>
                  <input className="form-control" placeholder="Ej: Pago a proveedor..."
                    value={wdReason} onChange={e=>setWdReason(e.target.value)} />
                </div>
                <div className="mb-2 p-3 rounded" style={{background:'#fef9c3',border:'1px solid #fde68a'}}>
                  <label className="form-label fw-semibold small"><i className="bi bi-lock-fill me-1"></i> PIN del administrador *</label>
                  <input type="password"
                    className={`form-control form-control-lg text-center ${pinError?'is-invalid':''}`}
                    placeholder="• • • •" maxLength={6}
                    value={pinValue} onChange={e=>{setPinValue(e.target.value);setPinError('');}}
                    onKeyDown={e=>e.key==='Enter'&&handleWithdrawal()}
                    style={{letterSpacing:8,fontSize:22}} />
                  {pinError && <div className="invalid-feedback d-block">{pinError}</div>}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setWdModal(null)}>Cancelar</button>
                <button className="btn btn-warning fw-bold" onClick={handleWithdrawal} disabled={pinLoading}>
                  {pinLoading ? 'Verificando...' : <><i className="bi bi-check-circle me-1"></i>Registrar retiro</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {closeModal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9999}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#7f1d1d',color:'#fff'}}>
                <h5 className="modal-title fw-bold"><i className="bi bi-stop-circle me-2"></i>Cerrar turno — {closeModal.cashier}</h5>
                <button className="btn-close btn-close-white" onClick={()=>setCloseModal(null)} />
              </div>
              <div className="modal-body">
                {(() => {
                  const cashExp = parseFloat(closeModal.base_amount) + parseFloat(closeModal.total_cash) - parseFloat(closeModal.total_withdrawals);
                  const counted = parseFloat(closeModal.cash_counted_by_cashier||0);
                  const diff    = counted - cashExp;
                  return (
                    <div>
                      <div className="row g-3 mb-3">
                        {[
                          ['Base inicial',     closeModal.base_amount,      'secondary'],
                          ['Ventas efectivo',  closeModal.total_cash,       'success'],
                          ['Total ventas',     closeModal.total_sales,      'success'],
                          ['Retiros',          closeModal.total_withdrawals,'danger'],
                          ['Efectivo esperado',cashExp,                     'primary'],
                          ['Cajero contó',     counted,                     diff<0?'danger':'success'],
                        ].map(([label,val,color],i)=>(
                          <div key={i} className="col-4 text-center">
                            <div className="text-muted" style={{fontSize:11}}>{label}</div>
                            <div className={`fw-bold text-${color}`}>{fmt(val)}</div>
                          </div>
                        ))}
                      </div>
                      <div className={`p-3 rounded text-center ${diff===0?'bg-success bg-opacity-10':diff>0?'bg-success bg-opacity-10':'bg-danger bg-opacity-10'}`}>
                        <div className="text-muted small">Diferencia</div>
                        <div className={`fs-3 fw-bold ${diff>=0?'text-success':'text-danger'}`}>{diff>=0?'+':''}{fmt(diff)}</div>
                        {diff<0 && <div className="text-danger small fw-semibold"><i className="bi bi-exclamation-triangle me-1"></i>Faltante de {fmt(Math.abs(diff))}</div>}
{diff>0 && <div className="text-success small"><i className="bi bi-check-circle me-1"></i>Sobrante de {fmt(diff)}</div>}
{diff===0 && <div className="text-success small"><i className="bi bi-check-circle me-1"></i>Cuadrado perfectamente</div>}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setCloseModal(null)}>Cancelar</button>
                <button className="btn btn-danger fw-bold" onClick={handleClose} disabled={loading}>
                  {loading ? 'Cerrando...' : <><i className="bi bi-stop-circle me-1"></i>Confirmar cierre</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="bi bi-cash me-2"></i> Cierre — {selected.cashier} · {selected.date}</h5>
                <button className="btn-close" onClick={()=>setSelected(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <div className="p-3 rounded text-center" style={{background:'#f0fff4'}}>
                      <div className="text-muted small">Sistema</div>
                      <div className="fw-bold text-success">{fmt(selected.system_total)}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 rounded text-center" style={{background:'#f0f9ff'}}>
                      <div className="text-muted small">Contado</div>
                      <div className="fw-bold">{fmt(selected.cash_counted)}</div>
                    </div>
                  </div>
                </div>
                <div className={`p-3 rounded text-center mb-3 ${selected.difference>=0?'bg-success bg-opacity-10':'bg-danger bg-opacity-10'}`}>
                  <div className="text-muted small">Diferencia</div>
                  <div className={`fw-bold fs-5 ${selected.difference>=0?'text-success':'text-danger'}`}>
                    {selected.difference>=0?'+':''}{fmt(selected.difference)}
                  </div>
                </div>
                {selected.observations && (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Observaciones del cajero</label>
                    <p className="border rounded p-2 text-muted small">{selected.observations}</p>
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label fw-semibold">Comentario del admin</label>
                  <textarea className="form-control" rows={3}
                    value={comment} onChange={e=>setComment(e.target.value)}
                    disabled={selected.status!=='pendiente'} />
                </div>
                <div className="text-center">Estado: {statusBadge(selected.status)}</div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setSelected(null)}>Cerrar</button>
                {selected.status==='pendiente' && (
                  <>
                    <button className="btn btn-danger" disabled={loading} onClick={()=>handleReview('rechazado')}>❌ Rechazar</button>
                    <button className="btn btn-success" disabled={loading} onClick={()=>handleReview('aprobado')}>✅ Aprobar</button>
                  </>
                )}
                <button className="btn btn-outline-primary ms-auto"
                  onClick={()=>{ const c = selected; setSelected(null); openAdjModal(c); }}>
                  <i className="bi bi-scale me-1"></i> Registrar ajuste
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {adjModal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9999}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-scale me-2"></i> Ajuste — {adjModal._from_shift?'Turno':'Cierre'} #{adjModal.id} · {adjModal.cashier}
                </h5>
                <button className="btn-close btn-close-white" onClick={()=>setAdjModal(null)} />
              </div>
              <div className="modal-body">
                <div className="alert alert-info d-flex flex-wrap gap-3 align-items-center py-2 mb-3" style={{fontSize:13}}>
                  <span><i className="bi bi-info-circle me-1"></i> <strong>Histórico intacto:</strong></span>
                  <span>Ventas: <strong>{fmt(adjModal.system_total)}</strong></span>
                  <span>Cajero contó: <strong>{adjModal.cash_counted!=null?fmt(adjModal.cash_counted):'—'}</strong></span>
                  <span className={parseFloat(adjModal.difference)<0?'text-danger fw-bold':'text-success fw-bold'}>
                    Diferencia: {parseFloat(adjModal.difference??0)>=0?'+':''}{fmt(adjModal.difference??0)}
                  </span>
                </div>
                <div className="card border-0 bg-light p-3 mb-4">
                  <div className="fw-semibold mb-3 small"><i className="bi bi-plus-circle me-1"></i> Registrar nuevo ajuste</div>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Tipo</label>
                      <div className="d-flex gap-2">
                        {['ingreso','egreso'].map(t => (
                          <button key={t} type="button"
                            className={`btn flex-fill fw-semibold ${adjTipo===t?(t==='ingreso'?'btn-success':'btn-danger'):'btn-outline-secondary'}`}
                            onClick={()=>setAdjTipo(t)}>
                            {t==='ingreso'
  ? <><i className="bi bi-box-arrow-in-down me-1"></i>Ingreso</>
  : <><i className="bi bi-box-arrow-up me-1"></i>Egreso</>}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Monto *</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="1" step="1000"
                          placeholder="20000" value={adjMonto} onChange={e=>setAdjMonto(e.target.value)} />
                      </div>
                    </div>
                    <div className="col-md-4 d-flex align-items-end">
                      <button className="btn btn-primary fw-bold w-100" onClick={handleAdjustment} disabled={adjLoading}>
                        {adjLoading ? <><i className="bi bi-hourglass-split me-1"></i>Guardando...</> : <><i className="bi bi-check-circle me-1"></i>Registrar</>}
                      </button>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">Motivo *</label>
                      <input type="text" className="form-control"
                        placeholder="Ej: Se encontró dinero faltante del cierre anterior"
                        value={adjMotivo} onChange={e=>setAdjMotivo(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&handleAdjustment()} />
                    </div>
                  </div>
                </div>
                {!adjList.length ? (
                  <div className="text-center text-muted py-3 border rounded" style={{fontSize:13}}>Sin ajustes registrados</div>
                ) : (
                  <table className="table table-sm table-bordered mb-0" style={{fontSize:12}}>
                    <thead className="table-light">
                      <tr><th>Fecha</th><th>Tipo</th><th className="text-end">Monto</th><th>Motivo</th><th>Por</th></tr>
                    </thead>
                    <tbody>
                      {adjList.map(a => (
                        <tr key={a.id}>
                          <td className="text-muted">{new Date(a.created_at).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                          <td><span className={`badge ${a.tipo==='ingreso'?'bg-success':'bg-danger'}`}><i className={`bi ${a.tipo==='ingreso'?'bi-box-arrow-in-down':'bi-box-arrow-up'} me-1`}></i>{a.tipo}</span></td>
                          <td className={`text-end fw-bold ${a.tipo==='ingreso'?'text-success':'text-danger'}`}>{a.tipo==='ingreso'?'+':'-'}{fmt(a.monto)}</td>
                          <td>{a.motivo}</td>
                          <td className="text-muted">{a.registrado_por_nombre}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setAdjModal(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
// COMPONENTE RAÍZ
// ══════════════════════════════════════════════
const ShiftManager = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_tecnico';
  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <h4 className="fw-bold mb-1"><i className="bi bi-arrow-repeat me-2"></i> {isAdmin ? 'Turnos, Cajas y Cierres' : 'Mi Turno'}</h4>
        <p className="text-muted mb-4">
          {isAdmin ? 'Gestión completa de cajas, turnos, retiros y cierres' : `Cajero: ${user?.name}`}
        </p>
        {isAdmin ? <AdminView token={token} /> : <CashierView token={token} user={user} />}
      </main>
    </div>
  );
};

export default ShiftManager;