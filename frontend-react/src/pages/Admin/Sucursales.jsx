import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });

const EMPTY = { nombre:'', direccion:'', ciudad:'', telefono:'', meta_ventas_mensual:'' };
const MEDALLAS = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

const Sucursales = () => {
  const { token } = useAuth();
  const [branches,  setBranches]  = useState([]);
  const [ranking,   setRanking]   = useState([]);
  const [comparison, setComparison] = useState([]);
  const [profit,    setProfit]    = useState(null);
  const [selBranchProfit, setSelBranchProfit] = useState(null);
  const [tab,       setTab]       = useState('sucursales');
  const [profitPeriod, setProfitPeriod] = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  });
  const [alert,     setAlert]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [form,      setForm]      = useState(EMPTY);
  const [period,    setPeriod]    = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  });
  const [filterBranch, setFilterBranch] = useState('');

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const [bs, rk, comp] = await Promise.all([
        apiFetch('/branches/', {}, token),
        apiFetch(`/branches/ranking?period=${period}${filterBranch?`&branch_id=${filterBranch}`:''}`, {}, token),
        apiFetch(`/profitability/comparison?period=${profitPeriod}`, {}, token).catch(()=>[]),
      ]);
      setBranches(Array.isArray(bs) ? bs : []);
      setRanking(Array.isArray(rk) ? rk : []);
      setComparison(Array.isArray(comp) ? comp : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token, period, filterBranch, profitPeriod]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editing) {
        await apiFetch(`/branches/${editing.id}`, { method:'PUT', body: JSON.stringify(form) }, token);
        showAlert('success', 'Sucursal actualizada');
      } else {
        await apiFetch('/branches/', { method:'POST', body: JSON.stringify(form) }, token);
        showAlert('success', 'Sucursal creada');
      }
      setShowModal(false); setForm(EMPTY); setEditing(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold mb-0">🏪 Sucursales y Ranking</h4>
            <p className="text-muted small mb-0">Gestión de puntos de venta y desempeño de cajeros</p>
          </div>
          <button className="btn btn-primary fw-bold"
            onClick={()=>{ setEditing(null); setForm(EMPTY); setShowModal(true); }}>
            + Nueva sucursal
          </button>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2`}>{alert.msg}</div>}

        <ul className="nav nav-tabs mb-4">
          {[['sucursales','🏪 Sucursales'],['ranking','🏆 Ranking cajeros'],['rentabilidad','📈 Rentabilidad']].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* Tab sucursales */}
        {tab === 'sucursales' && (
          <div className="row g-3">
            {!branches.length ? (
              <div className="col-12 text-center text-muted py-5">
                <div className="fs-2">🏪</div>
                <div>No hay sucursales registradas</div>
              </div>
            ) : branches.map(b=>(
              <div key={b.id} className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <h5 className="fw-bold mb-1">🏪 {b.nombre}</h5>
                      <button className="btn btn-sm btn-outline-secondary py-0"
                        onClick={()=>{ setEditing(b); setForm({nombre:b.nombre,direccion:b.direccion||'',ciudad:b.ciudad||'',telefono:b.telefono||'',meta_ventas_mensual:b.meta_ventas_mensual||''}); setShowModal(true); }}>
                        ✏️
                      </button>
                    </div>
                    {b.ciudad && <div className="text-muted small">📍 {b.ciudad}</div>}
                    {b.direccion && <div className="text-muted small">{b.direccion}</div>}
                    {b.telefono && <div className="text-muted small">📞 {b.telefono}</div>}
                    {b.meta_ventas_mensual && (
                      <div className="mt-2 p-2 rounded" style={{background:'#f0fff4',fontSize:12}}>
                        Meta mensual: <strong>{fmt(b.meta_ventas_mensual)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab ranking */}
        {tab === 'ranking' && (
          <div>
            <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
              <input type="month" className="form-control" style={{width:160}}
                value={period} onChange={e=>setPeriod(e.target.value)} />
              <select className="form-select" style={{width:200}} value={filterBranch}
                onChange={e=>setFilterBranch(e.target.value)}>
                <option value="">Todas las sucursales</option>
                {branches.map(b=><option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
              <button className="btn btn-primary" onClick={load}>Consultar</button>
            </div>

            {!ranking.length ? (
              <div className="text-center text-muted py-5">
                <div className="fs-2">🏆</div>
                <div>Sin datos de ranking para este período</div>
              </div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                    <thead className="table-light">
                      <tr>
                        <th className="text-center">#</th>
                        <th>Cajero</th>
                        <th>Sucursal</th>
                        <th className="text-center">Turnos</th>
                        <th className="text-end">Ventas</th>
                        <th className="text-end">Ticket prom.</th>
                        <th className="text-center fw-bold">⭐ Puntos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((r,i)=>(
                        <tr key={r.id} style={{background: i<3?['#fffbeb','#f8fafc','#fff8f1'][i]:''}}>
                          <td className="text-center fs-5">{MEDALLAS[i] || (i+1)}</td>
                          <td className="fw-semibold">👤 {r.user_name}</td>
                          <td className="text-muted">{r.branch_name||'—'}</td>
                          <td className="text-center">{r.total_sales}</td>
                          <td className="text-end">{fmt(r.total_amount)}</td>
                          <td className="text-end">{fmt(r.avg_ticket)}</td>
                          <td className="text-center fw-bold fs-6">
                            <span className="badge bg-warning text-dark px-3 py-1">{r.points_earned} pts</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab rentabilidad */}
        {tab === 'rentabilidad' && (
          <div>
            <div className="d-flex gap-2 mb-3 align-items-center">
              <input type="month" className="form-control" style={{width:160}}
                value={profitPeriod} onChange={e=>setProfitPeriod(e.target.value)} />
              <button className="btn btn-primary" onClick={load}>Consultar</button>
            </div>

            {/* Comparativo */}
            {comparison.length > 0 && (
              <div className="row g-3 mb-4">
                {comparison.map((b,i)=>(
                  <div key={b.branch_id} className="col-md-4">
                    <div className={`card border-0 shadow-sm h-100 ${i===0?'border-success border-2':''}`}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between mb-2">
                          <h6 className="fw-bold mb-0">🏪 {b.branch_name}</h6>
                          {i===0 && <span className="badge bg-success">🥇 Top</span>}
                        </div>
                        <div className="fs-4 fw-bold text-primary">{fmt(b.ventas)}</div>
                        {b.meta > 0 && (
                          <div className="mt-2">
                            <div className="d-flex justify-content-between small mb-1">
                              <span className="text-muted">Meta</span>
                              <span className={`fw-bold ${b.pct_meta>=100?'text-success':b.pct_meta>=70?'text-warning':'text-danger'}`}>
                                {Number(b.pct_meta||0).toFixed(1)}%
                              </span>
                            </div>
                            <div className="progress" style={{height:5}}>
                              <div className={`progress-bar ${b.pct_meta>=100?'bg-success':b.pct_meta>=70?'bg-warning':'bg-danger'}`}
                                style={{width:`${Math.min(100,b.pct_meta||0)}%`}} />
                            </div>
                          </div>
                        )}
                        <button className="btn btn-sm btn-outline-primary mt-2 w-100"
                          onClick={async ()=>{
                            setSelBranchProfit(b.branch_id);
                            try {
                              const p = await apiFetch(`/profitability/branches/${b.branch_id}?period=${profitPeriod}`, {}, token);
                              setProfit(p);
                            } catch(e) { showAlert('danger', e.message); }
                          }}>
                          Ver estado de resultados →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Detalle sucursal seleccionada */}
            {profit && (
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold py-2" style={{background:'#1e3a5f',color:'#fff'}}>
                  📋 Estado de resultados — {profit.branch?.nombre} · {profit.period}
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {[
                      {label:'Ventas brutas',      val:profit.ventas_brutas,       color:'text-primary'},
                      {label:'Ingresos netos',     val:profit.ingresos_netos,      color:'text-primary'},
                      {label:'Ganancia bruta',     val:profit.ganancia_bruta,      color:'text-success'},
                      {label:'Total gastos',       val:-profit.total_gastos,       color:'text-danger'},
                      {label:'Ganancia operativa', val:profit.ganancia_operativa,  color:profit.ganancia_operativa>=0?'text-success':'text-danger'},
                      {label:'Margen operativo',   val:null,                       extra:`${Number(profit.margen_operativo_pct||0).toFixed(1)}%`},
                    ].map((k,i)=>(
                      <div key={i} className="col-md-2">
                        <div className="text-muted small">{k.label}</div>
                        <div className={`fw-bold ${k.color}`}>{k.extra || fmt(k.val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal sucursal */}
        {showModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">{editing?'✏️ Editar':'🏪 Nueva'} sucursal</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setShowModal(false)} />
                </div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Nombre *</label>
                      <input className="form-control" required value={form.nombre}
                        onChange={e=>setForm({...form,nombre:e.target.value})}
                        placeholder="Ej: Sucursal Centro, Punto Norte..." />
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">Ciudad</label>
                        <input className="form-control" value={form.ciudad}
                          onChange={e=>setForm({...form,ciudad:e.target.value})} />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Teléfono</label>
                        <input className="form-control" value={form.telefono}
                          onChange={e=>setForm({...form,telefono:e.target.value})} />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Dirección</label>
                      <input className="form-control" value={form.direccion}
                        onChange={e=>setForm({...form,direccion:e.target.value})} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Meta de ventas mensual</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="0" step="1000"
                          value={form.meta_ventas_mensual}
                          onChange={e=>setForm({...form,meta_ventas_mensual:e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={loading}>
                      {loading?'Guardando...':'✅ Guardar'}
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

export default Sucursales;