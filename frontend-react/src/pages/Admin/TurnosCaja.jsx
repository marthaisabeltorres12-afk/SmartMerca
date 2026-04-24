import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { shiftService } from '../../services/shiftService';
import { userService } from '../../services/userService';
import { cashCloseService } from '../../services/cashCloseService';
import { exportCierresPDF, exportCierresExcel } from '../../services/exportService';
import { cashAdjustmentService } from '../../services/cashAdjustmentService';

const fmt   = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtDt = s => s ? new Date(s).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

// ══════════════════════════════════════════════
// VISTA CAJERO — solo ve estado de turno y cuenta efectivo al cerrar
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
        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        {!shift ? (
          <div className="card border-0 shadow-sm text-center py-5">
            <div className="fs-2 mb-2">⏳</div>
            <div className="fw-semibold">No tienes turno activo</div>
            <div className="text-muted small mt-1">El administrador abrirá tu turno</div>
          </div>
        ) : (
          <>
            <div className="card border-success border-2 mb-4">
              <div className="card-body text-center py-4">
                <div className="fs-1 mb-1">🟢</div>
                <div className="fw-bold fs-5">Turno activo</div>
                <div className="text-muted small">Desde: {fmtDt(shift.opened_at)}</div>
              </div>
            </div>

            {/* El admin pidió el conteo */}
            {shift.cashier_count_requested && !shift.cash_counted_by_cashier && !submitted && (
              <div className="card border-warning border-2">
                <div className="card-header fw-semibold py-3" style={{ background:'#92400e', color:'#fff' }}>
                  📋 El admin solicita el conteo de caja
                </div>
                <div className="card-body">
                  <p className="text-muted small mb-3">
                    Cuenta todo el dinero físico en caja e ingresa el total.
                    <strong> No verás el total del sistema</strong> — solo ingresa lo que tienes.
                  </p>
                  <form onSubmit={handleSubmitCount}>
                    <div className="mb-4">
                      <label className="form-label fw-semibold">💵 Total efectivo en caja</label>
                      <div className="input-group input-group-lg">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="0" step="1"
                          placeholder="0" value={cashCounted}
                          onChange={e => setCashCounted(e.target.value)} autoFocus required />
                      </div>
                      <div className="form-text text-warning fw-semibold">
                        Cuenta billete por billete y moneda por moneda antes de ingresar
                      </div>
                    </div>
                    <button type="submit" className="btn btn-warning w-100 fw-bold btn-lg">
                      ✅ Enviar conteo al admin
                    </button>
                  </form>
                </div>
              </div>
            )}

            {(submitted || shift.cash_counted_by_cashier) && (
              <div className="card border-success">
                <div className="card-body text-center py-4">
                  <div className="fs-2 mb-2">✅</div>
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
// VISTA ADMIN — control total + cierres diarios
// ══════════════════════════════════════════════
const AdminView = ({ token }) => {
  const [tab,         setTab]         = useState('activos');
  const [shifts,      setShifts]      = useState([]);
  const [closes,      setCloses]      = useState([]);
  const [users,       setUsers]       = useState([]);
  const [branches,    setBranches]    = useState([]);
  const [alert,       setAlert]       = useState(null);
  const [loading,     setLoading]     = useState(false);

  // Abrir turno
  const [baseForm,    setBaseForm]    = useState({ cashier_id:'', base_amount:'', branch_id:'' });

  // Retiro
  const [wdModal,     setWdModal]     = useState(null);
  const [wdAmount,    setWdAmount]    = useState('');
  const [wdReason,    setWdReason]    = useState('');
  const [pinValue,    setPinValue]    = useState('');
  const [pinError,    setPinError]    = useState('');
  const [pinLoading,  setPinLoading]  = useState(false);

  // Cierre de turno
  const [closeModal,  setCloseModal]  = useState(null);

  // Cierres diarios
  const [selected,    setSelected]    = useState(null);
  const [comment,     setComment]     = useState('');
  const [filterClose, setFilterClose] = useState('todos');

  // Ajuste de caja
  const [adjModal,    setAdjModal]    = useState(null); // { cierre } o null
  const [adjTipo,     setAdjTipo]     = useState('ingreso');
  const [adjMonto,    setAdjMonto]    = useState('');
  const [adjMotivo,   setAdjMotivo]   = useState('');
  const [adjLoading,  setAdjLoading]  = useState(false);
  const [adjList,     setAdjList]     = useState([]); // ajustes del cierre seleccionado

  // Historial
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

      // Cargar cajeros por separado para aislar errores
      try {
        const usersData = await userService.getAll(token);
        const allUsers  = Array.isArray(usersData) ? usersData : [];
        const cajeros   = allUsers.filter(u => u.role === 'cajero');
        setUsers(cajeros);
      } catch(ue) {
        console.error('Error cargando usuarios:', ue);
        setUsers([]);
      }

      // Cargar sucursales
      try {
        const { apiFetch } = await import('../../services/api');
        const brs = await apiFetch('/branches/', {}, token);
        setBranches(Array.isArray(brs) ? brs : []);
      } catch(be) { setBranches([]); }

    } catch(e) { console.error(e); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openShifts = shifts.filter(s => s.status === 'abierto');
  const pendientes = closes.filter(c => c.status === 'pendiente').length;

  // ── Abrir turno ──────────────────────────────────────
  const handleOpen = async (e) => {
    e.preventDefault();
    try {
      await shiftService.open({ cashier_id: parseInt(baseForm.cashier_id), base_amount: parseFloat(baseForm.base_amount||0), branch_id: baseForm.branch_id ? parseInt(baseForm.branch_id) : null }, token);
      showAlert('success','Turno abierto correctamente');
      setBaseForm({ cashier_id:'', base_amount:'', branch_id:'' });
      load();
      setTab('activos');
    } catch(e) { showAlert('danger', e.message); }
  };

  // ── Solicitar conteo ─────────────────────────────────
  const handleRequestCount = async (shift) => {
    try {
      await shiftService.requestCount(shift.id, token);
      showAlert('success','Se solicitó el conteo al cajero');
      load();
    } catch(e) { showAlert('danger', e.message); }
  };

  // ── Cerrar turno ─────────────────────────────────────
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

  // ── Retiro con PIN ───────────────────────────────────
  const handleWithdrawal = async () => {
    if (!wdAmount || parseFloat(wdAmount)<=0) { showAlert('danger','Monto inválido'); return; }
    if (!wdReason.trim()) { showAlert('danger','Ingresa el motivo'); return; }
    if (!pinValue.trim()) { setPinError('Ingresa el PIN'); return; }
    setPinLoading(true); setPinError('');
    try {
      const res = await fetch('http://localhost:5000/api/pin/verify', {
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

  // ── Aprobar/Rechazar cierre diario ───────────────────
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

  // ── Abrir modal de ajuste ─────────────────────────────
  const openAdjModal = async (cierre) => {
    setAdjModal(cierre);
    setAdjTipo('ingreso'); setAdjMonto(''); setAdjMotivo('');
    try {
      const lista = await cashAdjustmentService.getAll(token, cierre.id);
      setAdjList(Array.isArray(lista) ? lista : []);
    } catch(e) { setAdjList([]); }
  };

  // ── Registrar ajuste ──────────────────────────────────
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
      // Recargar lista de ajustes
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
    if (s==='aprobado')  return <span className="badge bg-success">✅ Aprobado</span>;
    if (s==='rechazado') return <span className="badge bg-danger">❌ Rechazado</span>;
    return <span className="badge bg-warning text-dark">⏳ Pendiente</span>;
  };

  const cajeros    = [...new Set(shifts.map(s=>s.cashier).filter(Boolean))].sort();
  const filteredH  = shifts.filter(s => (!filterCaj || s.cashier===filterCaj) && (!filterDate || s.opened_at?.slice(0,10)===filterDate));
  const filteredC  = filterClose==='todos' ? closes : closes.filter(c=>c.status===filterClose);

  return (
    <div>
      {alert && <div className={`alert alert-${alert.type} alert-dismissible`}>{alert.msg}</div>}

      {/* KPIs */}
      <div className="row g-3 mb-4">
        {[
          { icon:'🟢', value: openShifts.length,                              label:'Turnos activos',   color:'success' },
          { icon:'⏳', value: pendientes,                                      label:'Cierres pendientes',color:'warning' },
          { icon:'✅', value: closes.filter(c=>c.status==='aprobado').length,  label:'Cierres aprobados',color:'primary' },
          { icon:'❌', value: closes.filter(c=>c.status==='rechazado').length, label:'Cierres rechazados',color:'danger' },
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
          ['activos',  '🟢 Turnos activos',     openShifts.length],
          ['abrir',    '➕ Abrir turno',          0],
          ['historial','📋 Historial turnos',     0],
        ].map(([k,l,badge]) => (
          <li key={k} className="nav-item">
            <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>
              {l}
              {badge > 0 && <span className="badge bg-danger ms-1">{badge}</span>}
            </button>
          </li>
        ))}
      </ul>

      {/* ── TURNOS ACTIVOS ── */}
      {tab === 'activos' && (
        <div>
          {!openShifts.length ? (
            <div className="text-center text-muted py-5">
              <div className="fs-2">📭</div>
              <div>No hay turnos abiertos</div>
              <button className="btn btn-success mt-3" onClick={()=>setTab('abrir')}>➕ Abrir turno</button>
            </div>
          ) : openShifts.map(s => {
            const cashExp = parseFloat(s.base_amount) + parseFloat(s.total_cash) - parseFloat(s.total_withdrawals);
            return (
              <div key={s.id} className="card border-0 shadow-sm mb-4">
                <div className="card-header d-flex align-items-center justify-content-between py-3"
                  style={{ background:'#f0fdf4', borderLeft:'4px solid #22c55e' }}>
                  <div>
                    <span className="fw-bold fs-6">👤 {s.cashier}</span>
                    <span className="text-muted small ms-3">Desde: {fmtDt(s.opened_at)}</span>
                    <span className="badge bg-success ms-2">Activo</span>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-sm btn-outline-warning"
                      onClick={()=>{ setWdModal(s); setWdAmount(''); setWdReason(''); setPinValue(''); setPinError(''); }}>
                      📤 Retiro
                    </button>
                    {!s.cashier_count_requested
                      ? <button className="btn btn-sm btn-outline-info" onClick={()=>handleRequestCount(s)}>
                          📋 Pedir conteo
                        </button>
                      : !s.cash_counted_by_cashier
                        ? <span className="badge bg-warning text-dark align-self-center">⏳ Esperando conteo del cajero</span>
                        : <button className="btn btn-sm btn-danger fw-bold" onClick={()=>setCloseModal(s)}>
                            🔴 Cerrar turno
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

      {/* ── ABRIR TURNO ── */}
      {tab === 'abrir' && (
        <div className="row justify-content-center">
          <div className="col-md-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3" style={{background:'#1e3a5f',color:'#fff',borderRadius:'8px 8px 0 0'}}>
                🟢 Abrir turno para cajero
              </div>
              <div className="card-body">
                <form onSubmit={handleOpen}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Cajero *</label>
                    <select className="form-select" value={baseForm.cashier_id}
                      onChange={e=>setBaseForm({...baseForm,cashier_id:e.target.value})} required>
                      <option value="">— Seleccionar —</option>
                      {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  {branches.length > 0 && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Sucursal</label>
                      <select className="form-select" value={baseForm.branch_id}
                        onChange={e=>setBaseForm({...baseForm,branch_id:e.target.value})}>
                        <option value="">— Sin sucursal asignada —</option>
                        {branches.map(b=><option key={b.id} value={b.id}>🏪 {b.nombre}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">💵 Base inicial en caja</label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text">$</span>
                      <input type="number" className="form-control" min="0" step="1000"
                        placeholder="50000" value={baseForm.base_amount}
                        onChange={e=>setBaseForm({...baseForm,base_amount:e.target.value})} required />
                    </div>
                    <div className="form-text">Dinero físico que pones en la caja del cajero al inicio</div>
                  </div>
                  <button type="submit" className="btn btn-success w-100 fw-bold btn-lg">🟢 Abrir turno</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL DE TURNOS ── */}
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
                  <tr><th>#</th><th>Cajero</th><th>Apertura</th><th>Cierre</th>
                    <th className="text-end">Base</th><th className="text-end">Ventas</th>
                    <th className="text-end">Cajero contó</th><th className="text-end">Diferencia</th>
                    <th>Estado</th><th></th></tr>
                </thead>
                <tbody>
                  {!filteredH.length
                    ? <tr><td colSpan="10" className="text-center text-muted py-4">Sin turnos</td></tr>
                    : filteredH.map(s => {
                      const diff = parseFloat(s.difference ?? 0);
                      const isOpen = s.status === 'abierto';
                      return (
                        <React.Fragment key={s.id}>
                          <tr style={{background: isOpen?'#f0fdf4': diff<0?'#fff5f5':''}}>
                            <td className="text-muted">{s.id}</td>
                            <td className="fw-semibold">👤 {s.cashier}</td>
                            <td className="text-muted">{fmtDt(s.opened_at)}</td>
                            <td className="text-muted">{s.closed_at ? fmtDt(s.closed_at) : <span className="badge bg-success">Abierto</span>}</td>
                            <td className="text-end">{fmt(s.base_amount)}</td>
                            <td className="text-end text-success fw-semibold">{fmt(s.total_sales)}</td>
                            <td className="text-end">{s.cash_counted!=null ? fmt(s.cash_counted) : '—'}</td>
                            <td className="text-end fw-bold">
                              {s.difference!=null
                                ? <span className={diff>=0?'text-success':'text-danger'}>{diff>=0?'+':''}{fmt(diff)}</span>
                                : '—'}
                            </td>
                            <td><span className={`badge ${isOpen?'bg-success':diff<0?'bg-danger':'bg-secondary'}`}>{isOpen?'Abierto':diff<0?'Faltante':'Cerrado'}</span></td>
                            <td>
                              <div className="d-flex gap-1">
                                <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={()=>loadDetail(s.id)}>{expanded===s.id?'▲':'▼'}</button>
                                {!isOpen && s.difference!=null && (
                                  <button className="btn btn-sm btn-outline-success py-0 px-2"
                                    title="Registrar ajuste de caja"
                                    onClick={()=>openAdjModal({
                                      id: s.id,
                                      cashier: s.cashier,
                                      date: s.closed_at ? s.closed_at.slice(0,10) : s.opened_at.slice(0,10),
                                      system_total: s.total_sales,
                                      cash_counted: s.cash_counted,
                                      difference: s.difference,
                                      status: s.status,
                                      _from_shift: true,
                                    })}>
                                    ⚖️
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expanded===s.id && detail[s.id] && (
                            <tr><td colSpan="10" className="p-0">
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

      
      {/* Modal retiro */}
      {wdModal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9999}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#92400e',color:'#fff'}}>
                <h5 className="modal-title fw-bold">📤 Retiro — {wdModal.cashier}</h5>
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
                  <label className="form-label fw-semibold small">🔒 PIN del administrador *</label>
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
                  {pinLoading?'Verificando...':'✅ Registrar retiro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal cerrar turno */}
      {closeModal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9999}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#7f1d1d',color:'#fff'}}>
                <h5 className="modal-title fw-bold">🔴 Cerrar turno — {closeModal.cashier}</h5>
                <button className="btn-close btn-close-white" onClick={()=>setCloseModal(null)} />
              </div>
              <div className="modal-body">
                {(() => {
                  const cashExp  = parseFloat(closeModal.base_amount) + parseFloat(closeModal.total_cash) - parseFloat(closeModal.total_withdrawals);
                  const counted  = parseFloat(closeModal.cash_counted_by_cashier||0);
                  const diff     = counted - cashExp;
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
                        {diff<0 && <div className="text-danger small fw-semibold">⚠️ Faltante de {fmt(Math.abs(diff))}</div>}
                        {diff>0 && <div className="text-success small">✅ Sobrante de {fmt(diff)}</div>}
                        {diff===0 && <div className="text-success small">✅ Cuadrado perfectamente</div>}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setCloseModal(null)}>Cancelar</button>
                <button className="btn btn-danger fw-bold" onClick={handleClose} disabled={loading}>
                  {loading?'Cerrando...':'🔴 Confirmar cierre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal revisar cierre diario */}
      {selected && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">🏧 Cierre — {selected.cashier} · {selected.date}</h5>
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
                    <span className="ms-2 small">{selected.difference>0?'(sobrante)':selected.difference<0?'(faltante)':'(exacto)'}</span>
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
                    placeholder="Ej: Aprobado, diferencia justificada..."
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
                {/* Atajo: abrir ajuste desde modal de cierre */}
                <button className="btn btn-outline-primary ms-auto"
                  onClick={()=>{ const c = selected; setSelected(null); openAdjModal(c); }}>
                  ⚖️ Registrar ajuste
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal ajuste de caja */}
      {adjModal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9999}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                <h5 className="modal-title fw-bold">
                  ⚖️ Ajuste de caja — {adjModal._from_shift ? 'Turno' : 'Cierre'} #{adjModal.id} · {adjModal.cashier} · {adjModal.date}
                </h5>
                <button className="btn-close btn-close-white" onClick={()=>setAdjModal(null)} />
              </div>
              <div className="modal-body">

                {/* Resumen del turno/cierre histórico — solo lectura */}
                <div className="alert alert-info d-flex flex-wrap gap-3 align-items-center py-2 mb-3" style={{fontSize:13}}>
                  <span>🔒 <strong>Histórico intacto:</strong></span>
                  <span>{adjModal._from_shift ? 'Ventas' : 'Sistema'}: <strong>{fmt(adjModal.system_total)}</strong></span>
                  <span>Cajero contó: <strong>{adjModal.cash_counted != null ? fmt(adjModal.cash_counted) : '—'}</strong></span>
                  <span className={parseFloat(adjModal.difference)<0?'text-danger fw-bold':'text-success fw-bold'}>
                    Diferencia: {parseFloat(adjModal.difference??0)>=0?'+':''}{fmt(adjModal.difference??0)}
                  </span>
                </div>

                {/* Formulario nuevo ajuste */}
                <div className="card border-0 bg-light p-3 mb-4">
                  <div className="fw-semibold mb-3 small">➕ Registrar nuevo ajuste</div>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Tipo</label>
                      <div className="d-flex gap-2">
                        {['ingreso','egreso'].map(t => (
                          <button key={t} type="button"
                            className={`btn flex-fill fw-semibold ${adjTipo===t?(t==='ingreso'?'btn-success':'btn-danger'):'btn-outline-secondary'}`}
                            onClick={()=>setAdjTipo(t)}>
                            {t==='ingreso'?'📥 Ingreso':'📤 Egreso'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold small">Monto *</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="1" step="1000"
                          placeholder="20000" value={adjMonto}
                          onChange={e=>setAdjMonto(e.target.value)} />
                      </div>
                    </div>
                    <div className="col-md-4 d-flex align-items-end">
                      <button className="btn btn-primary fw-bold w-100" onClick={handleAdjustment} disabled={adjLoading}>
                        {adjLoading ? '⏳ Guardando...' : '✅ Registrar ajuste'}
                      </button>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold small">
                        Motivo * <span className="text-muted fw-normal">(quedará en auditoría)</span>
                      </label>
                      <input type="text" className="form-control"
                        placeholder="Ej: Se encontró dinero faltante del cierre anterior"
                        value={adjMotivo} onChange={e=>setAdjMotivo(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&handleAdjustment()} />
                    </div>
                  </div>
                </div>

                {/* Lista de ajustes ya registrados para este cierre */}
                <div className="fw-semibold mb-2 small text-muted">
                  Ajustes registrados para {adjModal._from_shift ? 'el turno' : 'el cierre'} #{adjModal.id}:
                </div>
                {!adjList.length ? (
                  <div className="text-center text-muted py-3 border rounded" style={{fontSize:13}}>
                    Sin ajustes registrados aún para este cierre
                  </div>
                ) : (
                  <table className="table table-sm table-bordered mb-0" style={{fontSize:12}}>
                    <thead className="table-light">
                      <tr>
                        <th>Fecha</th><th>Tipo</th>
                        <th className="text-end">Monto</th>
                        <th>Motivo</th><th>Registrado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjList.map(a => (
                        <tr key={a.id}>
                          <td className="text-muted" style={{whiteSpace:'nowrap'}}>
                            {new Date(a.created_at).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                          </td>
                          <td>
                            <span className={`badge ${a.tipo==='ingreso'?'bg-success':'bg-danger'}`}>
                              {a.tipo==='ingreso'?'📥 Ingreso':'📤 Egreso'}
                            </span>
                          </td>
                          <td className={`text-end fw-bold ${a.tipo==='ingreso'?'text-success':'text-danger'}`}>
                            {a.tipo==='ingreso'?'+':'-'}{fmt(a.monto)}
                          </td>
                          <td>{a.motivo}</td>
                          <td className="text-muted">{a.registrado_por_nombre}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="table-light">
                      <tr>
                        <td colSpan="2" className="fw-semibold text-end small">Balance ajustes:</td>
                        <td className="text-end fw-bold">
                          {(() => {
                            const bal = adjList.reduce((acc,a) =>
                              acc + (a.tipo==='ingreso' ? parseFloat(a.monto) : -parseFloat(a.monto)), 0);
                            return <span className={bal>=0?'text-success':'text-danger'}>{bal>=0?'+':''}{fmt(bal)}</span>;
                          })()}
                        </td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
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
        <h4 className="fw-bold mb-1">🔄 {isAdmin ? 'Turnos y Cierres de Caja' : 'Mi Turno'}</h4>
        <p className="text-muted mb-4">
          {isAdmin ? 'Gestión completa de turnos, retiros y cierres' : `Cajero: ${user?.name}`}
        </p>
        {isAdmin
          ? <AdminView token={token} />
          : <CashierView token={token} user={user} />
        }
      </main>
    </div>
  );
};

export default ShiftManager;