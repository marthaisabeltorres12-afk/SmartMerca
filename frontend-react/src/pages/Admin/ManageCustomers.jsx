import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import ExportButtons from '../../components/ExportButtons';
import { exportClientesPDF, exportClientesExcel } from '../../services/exportService';
import { apiFetch } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
const EMPTY = { doc_type:'CC', doc_number:'', full_name:'', email:'', phone:'', address:'', price_list_id:'' };
const DOC_TYPES = ['CC','CE','NIT','Pasaporte'];

const ManageCustomers = () => {
  const { token } = useAuth();
  const [customers,      setCustomers]      = useState([]);
  const [priceLists,     setPriceLists]     = useState([]);
  const [search,         setSearch]         = useState('');
  const [showModal,      setShowModal]      = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [form,           setForm]           = useState(EMPTY);
  const [alert,          setAlert]          = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState(null);
  const [pointsModal,    setPointsModal]    = useState(null);
  const [pointsInput,    setPointsInput]    = useState('');

  const load = async () => {
    try {
      const [custs, lists] = await Promise.all([
        customerService.getAll(token),
        apiFetch('/price-lists/', {}, token).catch(()=>[]),
      ]);
      setCustomers(custs);
      setPriceLists(Array.isArray(lists) ? lists : []);
    }
    catch(e) { showAlert('danger', e.message); }
  };
  useEffect(() => { load(); }, [token]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),3500); };
  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ doc_type: c.doc_type, doc_number: c.doc_number, full_name: c.full_name,
      email: c.email||'', phone: c.phone||'', address: c.address||'',
      price_list_id: c.price_list_id || '' });
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
    try {
      await customerService.update(c.id, { is_active: !c.is_active }, token);
      load();
    } catch(e) { showAlert('danger', e.message); }
  };

  const handleDelete = async (id) => {
    try {
      await customerService.delete(id, token);
      showAlert('success','Cliente eliminado');
      setConfirmDelete(null);
      load();
    } catch(e) {
      // Si tiene ventas, solo desactivar
      if (e.status === 409 || (e.message && e.message.includes('venta'))) {
        showAlert('warning', e.message);
        setConfirmDelete(prev => prev ? { ...prev, hasSales: true } : null);
      } else {
        showAlert('danger', e.message);
      }
    }
  };

  const handleDeactivate = async (c) => {
    try {
      await customerService.update(c.id, { is_active: false }, token);
      showAlert('success', `${c.full_name} desactivado. Su historial queda intacto.`);
      setConfirmDelete(null);
      load();
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
    c.nid?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPoints = customers.reduce((a,c) => a + c.points, 0);

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>
        <h4 className="fw-bold mb-1">👥 Clientes</h4>
        <p className="text-muted mb-4">Gestión de clientes y puntos de fidelidad</p>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { icon:'👥', label:'Total clientes',  value: customers.length,                            color:'primary' },
            { icon:'✅', label:'Activos',          value: customers.filter(c=>c.is_active).length,     color:'success' },
            { icon:'⭐', label:'Puntos totales',   value: totalPoints.toLocaleString('es-CO'),         color:'warning' },
            { icon:'💰', label:'Valor en puntos',  value: `$${((totalPoints/100)*1000).toLocaleString('es-CO')}`, color:'info' },
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

        {/* Barra */}
        <div className="d-flex gap-2 mb-3">
          <input className="form-control" style={{ maxWidth:320 }}
            placeholder="🔍 Buscar por nombre, cédula o NID..."
            value={search} onChange={e=>setSearch(e.target.value)} />
          
          <button className="btn btn-success ms-auto" onClick={openAdd}>+ Nuevo Cliente</button>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>NID</th>
                  <th>Tipo Doc</th>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Email</th>
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
                      <td><span className="badge bg-secondary">{c.nid}</span></td>
                      <td><span className="badge bg-light text-dark border">{c.doc_type}</span></td>
                      <td className="fw-semibold">{c.doc_number}</td>
                      <td>{c.full_name}</td>
                      <td className="text-muted small">{c.phone || '—'}</td>
                      <td className="text-muted small">{c.email || '—'}</td>
                      <td className="text-center">
                        <span className="badge bg-warning text-dark">⭐ {c.points}</span>
                        <div className="text-muted" style={{ fontSize:'0.7rem' }}>
                          = ${((c.points/100)*1000).toLocaleString('es-CO')}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${c.is_active ? 'bg-success' : 'bg-secondary'}`}>
                          {c.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          <button className="btn btn-warning btn-sm" onClick={() => openEdit(c)}>Editar</button>
                          <button className="btn btn-info btn-sm text-white" onClick={() => { setPointsModal(c); setPointsInput(''); }}>⭐</button>
                          <button className={`btn btn-sm ${c.is_active ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                            onClick={() => handleToggle(c)}>
                            {c.is_active ? 'Desactivar' : 'Activar'}
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(c)}>Eliminar</button>
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
                <div className="modal-header">
                  <h5 className="modal-title">{editing ? '✏️ Editar Cliente' : '+ Nuevo Cliente'}</h5>
                  <button className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label">Tipo documento *</label>
                        <select className="form-select" value={form.doc_type}
                          onChange={e=>setForm({...form,doc_type:e.target.value})}>
                          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Número documento *</label>
                        <input className="form-control" value={form.doc_number}
                          onChange={e=>setForm({...form,doc_number:e.target.value})} required />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Nombre completo *</label>
                        <input className="form-control" value={form.full_name}
                          onChange={e=>setForm({...form,full_name:e.target.value})} required />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Teléfono</label>
                        <input className="form-control" value={form.phone}
                          onChange={e=>setForm({...form,phone:e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Correo electrónico</label>
                        <input className="form-control" type="email" value={form.email}
                          onChange={e=>setForm({...form,email:e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Dirección</label>
                        <input className="form-control" value={form.address}
                          onChange={e=>setForm({...form,address:e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Lista de precios</label>
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
                    <button type="submit" className="btn btn-success" disabled={loading}>
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
                  <h5 className="modal-title">⭐ Agregar Puntos</h5>
                  <button className="btn-close" onClick={() => setPointsModal(null)} />
                </div>
                <div className="modal-body">
                  <p className="fw-semibold">{pointsModal.full_name}</p>
                  <p className="text-muted small">Puntos actuales: <strong>{pointsModal.points}</strong></p>
                  <label className="form-label">Puntos a agregar</label>
                  <input className="form-control" type="number" min="1" value={pointsInput}
                    onChange={e=>setPointsInput(e.target.value)} autoFocus />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setPointsModal(null)}>Cancelar</button>
                  <button className="btn btn-warning fw-bold" onClick={handleAddPoints}>⭐ Agregar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal eliminar / desactivar */}
        <ConfirmModal
          show={!!confirmDelete}
          titulo={confirmDelete?.hasSales ? 'Cliente con historial de ventas' : '¿Eliminar cliente?'}
          tipo={confirmDelete?.hasSales ? 'warning' : 'danger'}
          mensaje={confirmDelete?.hasSales
            ? <><p><strong>{confirmDelete?.full_name}</strong> tiene ventas registradas y no puede eliminarse.</p><p className="text-muted small mb-0">El cliente quedará inactivo y no aparecerá en búsquedas, pero se conserva su historial.</p></>
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