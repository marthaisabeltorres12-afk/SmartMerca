import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');

const MultiCaja = () => {
  const { token } = useAuth();
  const [dashboard, setDashboard]   = useState(null);
  const [loading,   setLoading]     = useState(true);
  const [modalNueva,setModalNueva]  = useState(false);
  const [formNueva, setFormNueva]   = useState({ nombre:'', descripcion:'' });
  const [guardando, setGuardando]   = useState(false);
  const [error,     setError]       = useState('');
  const [tab,       setTab]         = useState('dashboard');

  const cargar = () => {
    apiFetch('/cajas/dashboard', {}, token)
      .then(d => { setDashboard(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 30000); // actualizar cada 30s
    return () => clearInterval(interval);
  }, [token]);

  const handleCrearCaja = async (e) => {
    e.preventDefault();
    if (!formNueva.nombre.trim()) { setError('El nombre es requerido'); return; }
    setGuardando(true); setError('');
    try {
      await apiFetch('/cajas/', { method:'POST', body: JSON.stringify(formNueva) }, token);
      setModalNueva(false);
      setFormNueva({ nombre:'', descripcion:'' });
      cargar();
    } catch(e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleDesactivar = async (cajaId, nombre) => {
    if (!window.confirm(`¿Desactivar "${nombre}"?`)) return;
    try {
      await apiFetch(`/cajas/${cajaId}`, { method:'DELETE' }, token);
      cargar();
    } catch(e) {
      alert(e.message);
    }
  };

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{marginLeft:240,minHeight:'100vh'}}>
        <div className="spinner-border text-primary"/>
      </main>
    </div>
  );

  const { cajas = [], total_dia = 0, cajas_abiertas = 0, cajas_libres = 0 } = dashboard || {};

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{marginLeft:240, background:'#f8fafc', minHeight:'100vh'}}>

        <div className="mb-4 d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-0">🖥️ Multi-Caja</h4>
            <small className="text-muted">Gestión de cajas registradoras simultáneas</small>
          </div>
          <button className="btn btn-primary fw-bold" onClick={() => setModalNueva(true)}>
            + Nueva caja
          </button>
        </div>

        {/* Stats generales */}
        <div className="row g-3 mb-4">
          {[
            ['🖥️ Total cajas',    cajas.length,    'primary'],
            ['🟢 Abiertas',       cajas_abiertas,  'success'],
            ['⚪ Disponibles',    cajas_libres,    'secondary'],
            ['💰 Total del día',  fmt(total_dia),  'warning'],
          ].map(([l,v,c]) => (
            <div key={l} className="col-md-3 col-6">
              <div className={`card border-0 shadow-sm border-start border-${c} border-3`}>
                <div className="card-body py-3">
                  <div className="text-muted small">{l}</div>
                  <div className={`fw-bold fs-4 text-${c}`}>{v}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button className={`nav-link ${tab==='dashboard'?'active fw-bold':''}`}
              onClick={()=>setTab('dashboard')}>📊 Vista en tiempo real</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab==='cajas'?'active fw-bold':''}`}
              onClick={()=>setTab('cajas')}>⚙️ Administrar cajas</button>
          </li>
        </ul>

        {/* Dashboard tiempo real */}
        {tab === 'dashboard' && (
          <div className="row g-3">
            {cajas.map(({ caja, turno_activo, cajero, abierta_desde, ventas_hoy, total_hoy, status }) => (
              <div key={caja.id} className="col-md-4 col-sm-6">
                <div className={`card border-0 shadow-sm h-100 ${status==='ocupada'?'border-success border-2':''}`}>
                  <div className={`card-header d-flex justify-content-between align-items-center
                    ${status==='ocupada'?'bg-success text-white':'bg-light'}`}>
                    <span className="fw-bold">{caja.nombre}</span>
                    <span className={`badge ${status==='ocupada'?'bg-white text-success':'bg-secondary'}`}>
                      {status==='ocupada'?'🟢 Abierta':'⚪ Libre'}
                    </span>
                  </div>
                  <div className="card-body">
                    {turno_activo ? (
                      <>
                        <div className="d-flex align-items-center gap-2 mb-3">
                          <div className="avatar-sm rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                            style={{width:36,height:36,background:'#2563eb',fontSize:16,flexShrink:0}}>
                            {cajero?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="fw-semibold">{cajero}</div>
                            <div className="text-muted" style={{fontSize:11}}>
                              Desde: {abierta_desde?.slice(11,16)}
                            </div>
                          </div>
                        </div>
                        <div className="row g-2">
                          <div className="col-6">
                            <div className="p-2 rounded text-center" style={{background:'#f0fdf4'}}>
                              <div className="text-muted" style={{fontSize:11}}>Ventas</div>
                              <div className="fw-bold text-success">{ventas_hoy}</div>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="p-2 rounded text-center" style={{background:'#eff6ff'}}>
                              <div className="text-muted" style={{fontSize:11}}>Total</div>
                              <div className="fw-bold text-primary" style={{fontSize:13}}>{fmt(total_hoy)}</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 text-center">
                          <span className={`badge ${turno_activo.status==='abierto'?'bg-success':turno_activo.status==='pendiente_cierre'?'bg-warning text-dark':'bg-secondary'}`}>
                            {turno_activo.status==='abierto'?'En turno':turno_activo.status==='pendiente_cierre'?'⏳ Pendiente cierre':'Cerrado'}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-muted py-3">
                        <div style={{fontSize:32}}>🖥️</div>
                        <div className="small mt-1">Caja disponible</div>
                        <div className="small">Sin cajero asignado</div>
                      </div>
                    )}
                  </div>
                  {caja.descripcion && (
                    <div className="card-footer text-muted small">{caja.descripcion}</div>
                  )}
                </div>
              </div>
            ))}

            {!cajas.length && (
              <div className="col-12 text-center py-5 text-muted">
                <div style={{fontSize:48}}>🖥️</div>
                <div className="mt-2">No hay cajas configuradas</div>
                <button className="btn btn-primary mt-3" onClick={()=>setModalNueva(true)}>
                  + Crear primera caja
                </button>
              </div>
            )}
          </div>
        )}

        {/* Administrar cajas */}
        {tab === 'cajas' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold">⚙️ Cajas registradoras</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0" style={{fontSize:13}}>
                <thead className="table-light">
                  <tr><th>Nombre</th><th>Descripción</th><th>Estado</th><th>Cajero actual</th><th>Ventas hoy</th><th></th></tr>
                </thead>
                <tbody>
                  {cajas.map(({ caja, cajero, ventas_hoy, total_hoy, status }) => (
                    <tr key={caja.id}>
                      <td className="fw-bold">{caja.nombre}</td>
                      <td className="text-muted">{caja.descripcion||'—'}</td>
                      <td>
                        <span className={`badge ${status==='ocupada'?'bg-success':'bg-secondary'}`}>
                          {status==='ocupada'?'🟢 Abierta':'⚪ Libre'}
                        </span>
                      </td>
                      <td>{cajero||'—'}</td>
                      <td>
                        {ventas_hoy > 0
                          ? <span>{ventas_hoy} ventas · {fmt(total_hoy)}</span>
                          : <span className="text-muted">Sin ventas</span>}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline-danger"
                          disabled={status==='ocupada'}
                          onClick={()=>handleDesactivar(caja.id, caja.nombre)}
                          title={status==='ocupada'?'No se puede desactivar con turno activo':''}>
                          Desactivar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal nueva caja */}
        {modalNueva && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog modal-sm">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">🖥️ Nueva caja</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setModalNueva(false)}/>
                </div>
                <form onSubmit={handleCrearCaja}>
                  <div className="modal-body">
                    {error && <div className="alert alert-danger py-2 small">{error}</div>}
                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Nombre *</label>
                      <input className="form-control" placeholder="Ej: Caja 1, Caja Express..."
                        value={formNueva.nombre}
                        onChange={e=>setFormNueva(f=>({...f,nombre:e.target.value}))} required/>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Descripción (opcional)</label>
                      <input className="form-control" placeholder="Ej: Caja principal entrada"
                        value={formNueva.descripcion}
                        onChange={e=>setFormNueva(f=>({...f,descripcion:e.target.value}))}/>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary"
                      onClick={()=>setModalNueva(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={guardando}>
                      {guardando?'Creando...':'✅ Crear caja'}
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

export default MultiCaja;