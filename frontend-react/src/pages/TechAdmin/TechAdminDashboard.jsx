import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');

const PLANES = {
  basico:    { label:'Básico',    color:'secondary', features:['1 caja','1 sucursal','Inventario','Reportes básicos'] },
  estandar:  { label:'Estándar',  color:'primary',   features:['3 cajas','2 sucursales','Domicilios','Cupones','Análisis ventas'] },
  premium:   { label:'Premium',   color:'warning',   features:['Cajas ilimitadas','Sucursales ilimitadas','DIAN','Exportación PDF/Excel','Soporte prioritario'] },
};

const TechAdminDashboard = () => {
  const { token, user } = useAuth();
  const [negocio,   setNegocio]   = useState(null);
  const [config,    setConfig]    = useState(null);
  const [stats,     setStats]     = useState(null);
  const [auditoria, setAuditoria] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [alert,     setAlert]     = useState(null);
  const [editMode,  setEditMode]  = useState(false);
  const [negocioForm, setNegocioForm] = useState({});
  const [planForm,    setPlanForm]    = useState({});
  const [saving,    setSaving]    = useState(false);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const [neg, cfg, aud, users, products] = await Promise.all([
        apiFetch('/policy/',        {}, token).catch(()=>({})),
        apiFetch('/system-config/', {}, token).catch(()=>({})),
        apiFetch('/audit/',         {}, token).catch(()=>[]),
        apiFetch('/users/',         {}, token).catch(()=>[]),
        apiFetch('/products/',      {}, token).catch(()=>[]),
      ]);
      setNegocio(neg);
      setConfig(cfg);
      setAuditoria(Array.isArray(aud) ? aud : aud?.logs || []);
      setNegocioForm({
        business_name:    neg.business_name    || '',
        business_nit:     neg.business_nit     || '',
        business_phone:   neg.business_phone   || '',
        business_address: neg.business_address || '',
      });
      setPlanForm({
        plan_actual:    cfg.plan_actual    || 'basico',
        plan_vence:     cfg.plan_vence     || '',
        plan_cliente:   cfg.plan_cliente   || '',
      });
      const u = Array.isArray(users) ? users : [];
      const p = Array.isArray(products) ? products : [];
      setStats({
        admins:     u.filter(x=>x.role==='admin').length,
        cajeros:    u.filter(x=>x.role==='cajero').length,
        usuarios:   u.length,
        productos:  p.length,
        stockBajo:  p.filter(x=>x.stock<=(x.min_stock||5)).length,
        hoy:        (Array.isArray(aud)?aud:aud?.logs||[]).filter(a=>a.fecha_hora?.slice(0,10)===new Date().toISOString().slice(0,10)).length,
      });
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const saveNegocio = async () => {
    setSaving(true);
    try {
      await apiFetch('/policy/', { method:'PUT', body:JSON.stringify(negocioForm) }, token);
      showAlert('success', 'Datos del negocio guardados');
      setEditMode(false); load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setSaving(false); }
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      await apiFetch('/system-config/', { method:'PUT', body:JSON.stringify(planForm) }, token);
      showAlert('success', 'Plan actualizado');
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="d-flex"><Navbar/>
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{marginLeft:240,minHeight:'100vh'}}>
        <div className="spinner-border text-primary"/>
      </main>
    </div>
  );

  const planActual = PLANES[config?.plan_actual] || PLANES.basico;

  return (
    <div className="d-flex">
      <Navbar/>
      <main className="flex-grow-1 p-4" style={{marginLeft:240, background:'#f8fafc', minHeight:'100vh'}}>

        {/* Toast */}
        {alert && (
          <div style={{
            position:'fixed', bottom:28, right:28, zIndex:99999,
            minWidth:340, borderRadius:12, padding:'14px 20px', fontWeight:600, fontSize:15,
            background: alert.type==='success'?'#f0fdf4':'#fef2f2',
            color: alert.type==='success'?'#166534':'#991b1b',
            border:`1.5px solid ${alert.type==='success'?'#86efac':'#fca5a5'}`,
            boxShadow:'0 4px 20px rgba(0,0,0,0.15)', animation:'slideDown 0.3s ease',
          }}>
            <i className={`bi me-2 ${alert.type==='success'?'bi-check-circle-fill':'bi-x-circle-fill'}`}></i>
            {alert.msg}
          </div>
        )}
        <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Header */}
        <div className="mb-4 d-flex justify-content-between align-items-start">
          <div>
            <h4 className="fw-bold mb-0">
              <i className="bi bi-tools me-2 text-primary"></i>Panel Administrador Técnico
            </h4>
            <small className="text-muted">
              Bienvenido, <strong>{user?.name}</strong> — Instalación: <strong>{negocio?.business_name || 'Sin configurar'}</strong>
            </small>
          </div>
          <span className={`badge bg-${planActual.color} fs-6 px-3 py-2`}>
            <i className="bi bi-award me-1"></i>Plan {planActual.label}
          </span>
        </div>

        <div className="row g-4">
          {/* Columna izquierda */}
          <div className="col-lg-8">

            {/* Stats */}
            <div className="row g-3 mb-4">
              {[
                { label:'Administradores', val:stats?.admins,    icon:'bi-person-gear',    color:'primary'   },
                { label:'Cajeros',         val:stats?.cajeros,   icon:'bi-person-badge',   color:'success'   },
                { label:'Productos',       val:stats?.productos, icon:'bi-box-seam',        color:'info'      },
                { label:'Stock bajo',      val:stats?.stockBajo, icon:'bi-exclamation-triangle', color:'danger' },
              ].map((s,i) => (
                <div key={i} className="col-6 col-md-3">
                  <div className={`card border-0 shadow-sm h-100 border-start border-${s.color} border-3`}>
                    <div className="card-body py-3">
                      <div className={`text-${s.color} mb-1`}><i className={`bi ${s.icon} fs-5`}></i></div>
                      <div className={`fs-3 fw-bold text-${s.color}`}>{s.val ?? '—'}</div>
                      <div className="text-muted small">{s.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Datos del negocio */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header fw-semibold d-flex justify-content-between align-items-center py-3"
                style={{background:'#1e3a5f', color:'#fff'}}>
                <span><i className="bi bi-building me-2"></i>Datos del negocio</span>
                <button className="btn btn-sm btn-light" onClick={()=>setEditMode(!editMode)}>
                  <i className={`bi ${editMode?'bi-x':'bi-pencil'} me-1`}></i>{editMode?'Cancelar':'Editar'}
                </button>
              </div>
              <div className="card-body">
                {editMode ? (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Nombre del negocio *</label>
                      <input className="form-control" value={negocioForm.business_name}
                        onChange={e=>setNegocioForm({...negocioForm,business_name:e.target.value})}/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">NIT / RUT</label>
                      <input className="form-control" value={negocioForm.business_nit}
                        onChange={e=>setNegocioForm({...negocioForm,business_nit:e.target.value})}/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Teléfono</label>
                      <input className="form-control" value={negocioForm.business_phone}
                        onChange={e=>setNegocioForm({...negocioForm,business_phone:e.target.value})}/>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Dirección</label>
                      <input className="form-control" value={negocioForm.business_address}
                        onChange={e=>setNegocioForm({...negocioForm,business_address:e.target.value})}/>
                    </div>
                    <div className="col-12">
                      <button className="btn btn-success fw-bold" onClick={saveNegocio} disabled={saving}>
                        {saving ? <span className="spinner-border spinner-border-sm me-2"/> : <i className="bi bi-check2 me-2"></i>}
                        Guardar datos
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="row g-3">
                    {[
                      { label:'Nombre',    val:negocio?.business_name    || 'Sin configurar', icon:'bi-shop' },
                      { label:'NIT / RUT', val:negocio?.business_nit     || '—',             icon:'bi-file-text' },
                      { label:'Teléfono',  val:negocio?.business_phone   || '—',             icon:'bi-telephone' },
                      { label:'Dirección', val:negocio?.business_address || '—',             icon:'bi-geo-alt' },
                    ].map((f,i) => (
                      <div key={i} className="col-md-6">
                        <div className="small text-muted mb-1"><i className={`bi ${f.icon} me-1`}></i>{f.label}</div>
                        <div className="fw-semibold">{f.val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Últimas acciones */}
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold d-flex justify-content-between align-items-center py-3"
                style={{background:'#1e3a5f', color:'#fff'}}>
                <span><i className="bi bi-shield-check me-2"></i>Últimas acciones del sistema</span>
                <Link to="/tecnico/auditoria" className="btn btn-sm btn-light">Ver todas →</Link>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0" style={{fontSize:12}}>
                  <thead className="table-light">
                    <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Descripción</th></tr>
                  </thead>
                  <tbody>
                    {auditoria.slice(0,8).map((a,i) => (
                      <tr key={i}>
                        <td className="text-muted">{a.fecha_hora?.slice(0,16).replace('T',' ')}</td>
                        <td className="fw-semibold">{a.usuario_nombre||'—'}</td>
                        <td><span className={`badge ${
                          a.accion==='eliminar'?'bg-danger':
                          a.accion==='crear'?'bg-success':
                          a.accion==='editar'?'bg-warning text-dark':'bg-secondary'
                        }`} style={{fontSize:10}}>{a.accion||'—'}</span></td>
                        <td className="text-muted" style={{maxWidth:250,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {a.descripcion||'—'}
                        </td>
                      </tr>
                    ))}
                    {!auditoria.length && <tr><td colSpan={4} className="text-center text-muted py-3">Sin registros</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Columna derecha */}
          <div className="col-lg-4">

            {/* Plan activo */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header fw-semibold py-3" style={{background:'#1e3a5f', color:'#fff'}}>
                <i className="bi bi-award me-2"></i>Plan y suscripción
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Plan activo</label>
                  <select className="form-select" value={planForm.plan_actual}
                    onChange={e=>setPlanForm({...planForm,plan_actual:e.target.value})}>
                    <option value="basico">Básico</option>
                    <option value="estandar">Estándar</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Vence el</label>
                  <input type="date" className="form-control" value={planForm.plan_vence||''}
                    onChange={e=>setPlanForm({...planForm,plan_vence:e.target.value})}/>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Cliente / Contacto</label>
                  <input className="form-control" placeholder="Nombre del cliente o contacto"
                    value={planForm.plan_cliente||''}
                    onChange={e=>setPlanForm({...planForm,plan_cliente:e.target.value})}/>
                </div>
                <button className="btn btn-primary w-100 fw-bold" onClick={savePlan} disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm me-2"/> : <i className="bi bi-check2 me-2"></i>}
                  Guardar plan
                </button>

                {/* Características del plan */}
                <hr/>
                <div className="small fw-semibold mb-2">
                  <span className={`badge bg-${PLANES[planForm.plan_actual]?.color} me-2`}>
                    {PLANES[planForm.plan_actual]?.label}
                  </span>
                  incluye:
                </div>
                <ul className="list-unstyled mb-0">
                  {PLANES[planForm.plan_actual]?.features.map((f,i) => (
                    <li key={i} className="small text-muted mb-1">
                      <i className="bi bi-check-circle-fill text-success me-2"></i>{f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Acceso rápido */}
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3" style={{background:'#1e3a5f', color:'#fff'}}>
                <i className="bi bi-lightning-charge me-2"></i>Acceso rápido
              </div>
              <div className="card-body p-2">
                {[
                  { to:'/tecnico/usuarios',    icon:'bi-people',          label:'Usuarios'          },
                  { to:'/tecnico/productos',   icon:'bi-box-seam',        label:'Productos'         },
                  { to:'/tecnico/proveedores', icon:'bi-truck',           label:'Proveedores'       },
                  { to:'/tecnico/clientes',    icon:'bi-person-heart',    label:'Clientes'          },
                  { to:'/tecnico/auditoria',   icon:'bi-shield-check',    label:'Auditoría'         },
                  { to:'/tecnico/politicas',   icon:'bi-building',        label:'Políticas'         },
                  { to:'/tecnico/config',      icon:'bi-gear',            label:'Configuración'     },
                  { to:'/tecnico/backup',      icon:'bi-cloud-download',  label:'Backup'            },
                ].map(l => (
                  <Link key={l.to} to={l.to}
                    className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none text-dark rounded mb-1"
                    style={{transition:'background 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='#f1f5f9'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <i className={`bi ${l.icon} text-primary`}></i>
                    <span className="small fw-semibold">{l.label}</span>
                    <i className="bi bi-chevron-right ms-auto text-muted" style={{fontSize:10}}></i>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TechAdminDashboard;