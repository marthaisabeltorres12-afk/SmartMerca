import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { exportClientesPDF, exportClientesExcel } from '../../services/exportService';
import { apiFetch } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';

const EMPTY = { doc_type:'CC', doc_number:'', full_name:'', email:'', phone:'', address:'', price_list_id:'' };
const DOC_TYPES = ['CC','CE','NIT','Pasaporte','TI'];

const ManageCustomers = () => {
  const { token } = useAuth();
  const [customers,     setCustomers]     = useState([]);
  const [priceLists,    setPriceLists]    = useState([]);
  const [search,        setSearch]        = useState('');
  const [showModal,     setShowModal]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [form,          setForm]          = useState(EMPTY);
  const [alert,         setAlert]         = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pointsModal,   setPointsModal]   = useState(null);
  const [pointsInput,   setPointsInput]   = useState('');

  const load = async () => {
    try {
      const [custs, lists] = await Promise.all([
        customerService.getAll(token),
        apiFetch('/price-lists/', {}, token).catch(()=>[]),
      ]);
      setCustomers(custs);
      setPriceLists(Array.isArray(lists) ? lists : []);
    } catch(e) { showAlert('danger', e.message); }
  };
  useEffect(() => { load(); }, [token]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),3500); };
  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ doc_type:c.doc_type, doc_number:c.doc_number, full_name:c.full_name,
      email:c.email||'', phone:c.phone||'', address:c.address||'', price_list_id:c.price_list_id||'' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editing) { await customerService.update(editing.id, form, token); showAlert('success','Cliente actualizado'); }
      else         { await customerService.create(form, token);             showAlert('success','Cliente registrado'); }
      setShowModal(false); load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleToggle = async (c) => {
    try { await customerService.update(c.id, { is_active: !c.is_active }, token); load(); }
    catch(e) { showAlert('danger', e.message); }
  };

  const handleDelete = async (id) => {
    try {
      await customerService.delete(id, token);
      showAlert('success','Cliente eliminado'); setConfirmDelete(null); load();
    } catch(e) {
      if (e.status === 409 || (e.message && e.message.includes('venta'))) {
        showAlert('warning', e.message);
        setConfirmDelete(prev => prev ? { ...prev, hasSales: true } : null);
      } else { showAlert('danger', e.message); }
    }
  };

  const handleDeactivate = async (c) => {
    try {
      await customerService.update(c.id, { is_active: false }, token);
      showAlert('success', `${c.full_name} desactivado.`);
      setConfirmDelete(null); load();
    } catch(e) { showAlert('danger', e.message); }
  };

  const handleAddPoints = async () => {
    const pts = parseInt(pointsInput);
    if (!pts || pts <= 0) { showAlert('danger','Ingresa puntos válidos'); return; }
    try {
      await customerService.addPoints(pointsModal.id, pts, token);
      showAlert('success', `+${pts} puntos agregados`);
      setPointsModal(null); setPointsInput(''); load();
    } catch(e) { showAlert('danger', e.message); }
  };

  const filtered = customers.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.doc_number?.includes(search) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.nid?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPoints = customers.reduce((a,c) => a + (c.points||0), 0);

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>
        <h4 className="fw-bold mb-1">
  <i className="bi bi-people me-2"></i>
  Clientes
</h4>
        <p className="text-muted mb-4">Gestión de clientes y puntos de fidelidad</p>

        {alert && (
          <div className={`alert alert-${alert.type}`} style={{
            position:'fixed', top:'20px', left:'50%', transform:'translateX(-50%)',
            zIndex:99999, minWidth:'350px', maxWidth:'500px', textAlign:'center',
            borderRadius:'12px', padding:'14px 20px', color:'#000',
            animation:'slideDown 0.4s ease',
            boxShadow: alert.type==='success' ? '0 8px 25px rgba(34,197,94,0.4)'
                     : alert.type==='warning' ? '0 8px 25px rgba(234,179,8,0.4)'
                     : alert.type==='info'    ? '0 8px 25px rgba(59,130,246,0.4)'
                     : '0 8px 25px rgba(220,74,74,0.4)',
          }}>
            {alert.msg}
          </div>
        )}

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { icon: <i className="bi bi-people"></i>, label:'Total clientes',  value: customers.length,                       color:'primary' },
            { icon: <i className="bi bi-person-check"></i>, label:'Activos',          value: customers.filter(c=>c.is_active).length, color:'success' },
            {  icon: <i className="bi-star-fill" style={{ color: '#f59e0b' }}></i>, label:'Puntos totales',   value: totalPoints.toLocaleString('es-CO'),    color:'warning' },
            {icon: <i className="bi bi-cash-stack"></i>, label:'Valor en puntos',  value: `$${((totalPoints/100)*1000).toLocaleString('es-CO')}`, color:'info' },
          ].map((k,i) => (
            <div key={i} className="col-md-3">
              <div className={`card border-${k.color} border-2 text-center`}>
                <div className="card-body py-3">
                  <div style={{ fontSize:'1.8rem' }}>{k.icon}</div>
                  <div className={`fs-4 fw-bold text-${k.color}`}>{k.value}</div>
                  <div className="text-muted small">{k.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

    <div className="d-flex gap-2 mb-3 align-items-center">
  <div className="input-group flex-grow-1" style={{ maxWidth: 420 }}>
    <span className="input-group-text bg-white border-end-0">
      <i className="bi bi-search text-muted"></i>
    </span>
    <input
      className="form-control border-start-0 ps-0"
      style={{ fontSize: 15 }}
      placeholder="Nombre, cédula, teléfono o correo..."
      value={search}
      onChange={e => setSearch(e.target.value)}
    />
  </div>
  <div className="ms-auto d-flex gap-2">
    <button className="btn btn-success fw-bold" onClick={openAdd}>
      + Nuevo Cliente
    </button>
  </div>
</div>
        {/* Tabla */}
        <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{fontSize:16}}>
              <thead className="table-light">
                <tr>
                  <th>Tipo Doc</th>
                  <th>Documento</th>
                  <th>Nombre completo</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
                  <th className="text-center">Puntos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan="9" className="text-center text-muted py-4">No hay clientes</td></tr>
                  : filtered.map(c => (
                    <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.6 }}>
                      <td><span className="badge bg-light text-dark border">{c.doc_type}</span></td>
                      <td className="fw-semibold">{c.doc_number}</td>
                      <td className="fw-semibold">{c.full_name}</td>
                      <td className="text-muted small">{c.phone || '—'}</td>
                      <td className="text-muted small">{c.email || '—'}</td>
                      <td className="text-muted small" style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.address || '—'}</td>
                      <td className="text-center">
                        <span  className="badge bg-warning text-dark"> <i className="bi bi-star"></i>,  {c.points||0}</span>
                      </td>
                      <td>
  <span className={`badge ${c.is_active ? 'bg-success' : 'bg-secondary'}`}>
    {c.is_active ? 'Activo' : 'Inactivo'}
  </span>
</td>

<td>
  <div className="d-flex gap-1">
    <button className="btn btn-warning btn-sm" onClick={() => openEdit(c)} title="Editar"><i className="bi bi-pencil"></i></button>
    <button className="btn btn-info btn-sm text-white" onClick={() => { setPointsModal(c); setPointsInput('');}}title="Puntos">
      <i className="bi bi-star"></i>
    </button>
    <button className={`btn btn-sm ${c.is_active
          ? 'btn-outline-secondary'
          : 'btn-outline-success'
      }`}
      onClick={() => handleToggle(c)}
      title={c.is_active ? 'Desactivar' : 'Activar'}>
      <i className={`bi ${c.is_active ? 'bi-x-circle' : 'bi-check-circle'}`}></i></button>
     <button className="btn btn-danger btn-sm"
      onClick={() => setConfirmDelete(c)}
      title="Eliminar">
      <i className="bi bi-trash"></i></button>
                 </div>
                   </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal crear/editar */}
        {showModal && (
          <div className="modal d-block" style={{ background:'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f'}}>
                  <h5 className="modal-title text-white ">{editing ? ' Editar Cliente' : '+ Nuevo Cliente'}</h5>
                  <button className="btn-close btn-close-white" onClick={() => setShowModal(false)} />
                </div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Tipo documento *</label>
                        <select className="form-select" value={form.doc_type}
                          onChange={e=>setForm({...form,doc_type:e.target.value})}>
                          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Número documento *</label>
                        <input className="form-control" placeholder="Ej: 1012345678"
                          value={form.doc_number}
                          onChange={e=>setForm({...form,doc_number:e.target.value})} required />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Nombre completo *</label>
                        <input className="form-control" placeholder="Ej: Juan Pérez"
                          value={form.full_name}
                          onChange={e=>setForm({...form,full_name:e.target.value})} required />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Teléfono</label>
                        <input className="form-control" placeholder="Ej: 3001234567"
                          value={form.phone}
                          onChange={e=>setForm({...form,phone:e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Correo electrónico</label>
                        <input className="form-control" type="email" placeholder="Ej: juan@email.com"
                          value={form.email}
                          onChange={e=>setForm({...form,email:e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Dirección</label>
                        <input className="form-control" placeholder="Ej: Calle 10 # 5-20"
                          value={form.address}
                          onChange={e=>setForm({...form,address:e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label fw-semibold">Lista de precios</label>
                        <select className="form-select" value={form.price_list_id}
                          onChange={e=>setForm({...form, price_list_id: e.target.value})}>
                          <option value="">— Precio normal —</option>
                          {priceLists.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-success fw-bold" disabled={loading}>
                      {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Registrar Cliente'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal puntos */}
        {pointsModal && (
          <div className="modal d-block" style={{ background:'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-star"></i>,  Agregar Puntos</h5>
                  <button className="btn-close" onClick={() => setPointsModal(null)} />
                </div>
                <div className="modal-body">
                  <p className="fw-semibold">{pointsModal.full_name}</p>
                  <p className="text-muted small">Puntos actuales: <strong>{pointsModal.points||0}</strong></p>
                  <label className="form-label">Puntos a agregar</label>
                  <input className="form-control" type="number" min="1" value={pointsInput}
                    onChange={e=>setPointsInput(e.target.value)} autoFocus />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setPointsModal(null)}>Cancelar</button>
                  <button className="btn btn-warning fw-bold" onClick={handleAddPoints}><i className="bi bi-star"></i>,  Agregar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          show={!!confirmDelete}
          titulo={confirmDelete?.hasSales ? 'Cliente con historial de ventas' : '¿Eliminar cliente?'}
          tipo={confirmDelete?.hasSales ? 'warning' : 'danger'}
          mensaje={confirmDelete?.hasSales
            ? <><p><strong>{confirmDelete?.full_name}</strong> tiene ventas y no puede eliminarse.</p><p className="text-muted small mb-0">Quedará inactivo conservando su historial.</p></>
            : <>Se eliminará <strong>{confirmDelete?.full_name}</strong>. Esta acción no se puede deshacer.</>
          }
          txtConfirmar={confirmDelete?.hasSales ? 'Desactivar cliente' : 'Sí, eliminar'}
          onConfirmar={() => confirmDelete?.hasSales ? handleDeactivate(confirmDelete) : handleDelete(confirmDelete.id)}
          onCancelar={() => setConfirmDelete(null)}
        />
      </main>
    </div>
  );
};
export default ManageCustomers;