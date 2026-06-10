import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { usePlan } from '../../context/PlanContext';
import { useAuth } from '../../context/AuthContext';
import { supplierService } from '../../services/supplierService';
import ConfirmModal from '../../components/ConfirmModal';
import 'bootstrap/dist/css/bootstrap.min.css';

const EMPTY = { company_name:'', name:'', contact_name:'', email:'', phone:'', address:'', nit:'', is_active: true };

const ManageSuppliers = () => {
  const { token } = useAuth();
  const { soloLectura } = usePlan();
  const [suppliers,        setSuppliers]        = useState([]);
  const [search,           setSearch]           = useState('');
  const [showModal,        setShowModal]        = useState(false);
  const [editing,          setEditing]          = useState(null);
  const [form,             setForm]             = useState(EMPTY);
  const [alert,            setAlert]            = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [confirmDelete,    setConfirmDelete]    = useState(null);
  const [deactivatedModal, setDeactivatedModal] = useState(null);

  const load = async () => {
    try { setSuppliers(await supplierService.getAll(token)); }
    catch (e) { showAlertMsg('danger', e.message); }
  };
  useEffect(() => { load(); }, [token]);

  const showAlertMsg = (type, msg) => { setAlert({type,msg}); setTimeout(() => setAlert(null), 3500); };

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      company_name: s.company_name||'',
      name:         s.name||'',
      contact_name: s.contact_name||'',
      email:        s.email||'',
      phone:        s.phone||'',
      address:      s.address||'',
      nit:          s.nit||'',
      is_active:    s.is_active !== false,
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Validar campos obligatorios
    if (!form.company_name?.trim()) { showAlertMsg('danger', 'El nombre de la empresa es obligatorio'); return; }
    if (!form.name?.trim())         { showAlertMsg('danger', 'El nombre del proveedor es obligatorio'); return; }
    if (!editing && form.nit?.trim()) {
      const existe = suppliers.find(s => s.nit?.trim() === form.nit.trim());
      if (existe) { showAlertMsg('danger', 'NIT ya registrado en: ' + (existe.company_name || existe.name)); return; }
    }
    setLoading(true);
    try {
      if (editing) { await supplierService.update(editing.id, form, token); showAlertMsg('success','Proveedor actualizado'); }
      else         { await supplierService.create(form, token);             showAlertMsg('success','Proveedor creado'); }
      setShowModal(false); load();
    } catch (e) {
      showAlertMsg('danger', e.message.replace(/^Error \d+:\s*/, ''));
    }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await supplierService.delete(id, token);
      setConfirmDelete(null);
      if (res?.action === 'deactivated') {
        setDeactivatedModal({
          titulo:  'Proveedor con historial de compras',
          mensaje: res.message,
          detalle: res.detail,
        });
      } else {
        showAlertMsg('success','Proveedor eliminado');
      }
      load();
    } catch (e) { showAlertMsg('danger', e.message); }
  };

  const handleToggle = async (s) => {
    try {
      const updated = await supplierService.update(s.id, { ...s, is_active: !s.is_active }, token);
      setSuppliers(prev => prev.map(x => x.id === (updated?.id || s.id)
        ? { ...x, is_active: !s.is_active } : x));
    } catch(e) { showAlertMsg('danger', e.message); }
  };

  const filtered = suppliers.filter(s =>
    s.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.nit?.includes(search)
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-4"><i className="bi bi-truck me-2"></i>Gestión de Proveedores</h4>

        {/* Toast estándar fijo */}
        {alert && (
          <div style={{
            position:'fixed', bottom:28, right:28, zIndex:9999,
            minWidth:350, borderRadius:12, padding:'14px 20px',
            fontWeight:600, fontSize:15,
            boxShadow: alert.type==='success' ? '0 4px 20px rgba(34,197,94,0.35)' : '0 4px 20px rgba(239,68,68,0.35)',
            background: alert.type==='success' ? '#f0fdf4' : '#fef2f2',
            color: alert.type==='success' ? '#166534' : '#991b1b',
            border: `1.5px solid ${alert.type==='success' ? '#86efac' : '#fca5a5'}`,
            animation:'slideDown 0.3s ease',
          }}>
            <i className={`bi me-2 ${alert.type==='success' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
            {alert.msg}
          </div>
        )}
        <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>

        {/* Barra búsqueda + botón crear */}
        <div className="d-flex justify-content-between align-items-center mb-2 gap-3">
          <div className="input-group" style={{ maxWidth: 320 }}>
            <span className="input-group-text bg-white border-end-0">
              <i className="bi bi-search text-muted"></i>
            </span>
            <input className="form-control border-start-0 ps-0"
              placeholder="Buscar proveedor..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-success fw-bold" onClick={openAdd}>
            <i className="bi bi-plus-circle me-2"></i>Nuevo Proveedor
          </button>
        </div>

        <p className="text-muted small mb-2">
          Mostrando <strong>{filtered.length}</strong> de <strong>{suppliers.length}</strong> proveedores
        </p>

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th><th>Empresa</th><th>NIT</th><th>Nombre proveedor</th>
                  <th>Contacto</th><th>Email</th><th>Teléfono</th><th>Dirección</th>
                  <th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="10" className="text-center text-muted py-4">No hay proveedores</td></tr>
                ) : filtered.map((s, i) => (
                  <tr key={s.id} style={{opacity: s.is_active !== false ? 1 : 0.5}}>
                    <td>{i+1}</td>
                    <td className="fw-semibold">{s.company_name || '—'}</td>
                    <td style={{fontFamily:'monospace',fontSize:12}}>{s.nit || <span className="text-muted">—</span>}</td>
                    <td>{s.name || '—'}</td>
                    <td className="text-muted small">{s.contact_name || '—'}</td>
                    <td className="text-muted small">{s.email || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td className="text-muted small">{s.address || '—'}</td>
                    <td>
                      <span className={`badge ${s.is_active !== false ? 'bg-success' : 'bg-secondary'}`}>
                        {s.is_active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="text-nowrap">
                      <div className="d-flex align-items-center gap-1">
  <button
    className={`btn btn-sm ${s.is_active !== false ? 'btn-outline-secondary' : 'btn-outline-success'}`}
    onClick={() => handleToggle(s)}
    title={s.is_active !== false ? 'Desactivar' : 'Activar'}>
    <i className={`bi ${s.is_active !== false ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
  </button>
  <button className="btn btn-warning btn-sm" onClick={() => openEdit(s)} title="Editar">
    <i className="bi bi-pencil"></i>
  </button>
  <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(s)} title="Eliminar">
    <i className="bi bi-trash"></i>
  </button>
</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Agregar/Editar */}
        {showModal && (
          <div className="modal d-block" style={{ background: 'rgba(0,0,0,.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                 <h5 className="modal-title">
  {editing
    ? <><i className="bi bi-pencil me-2"></i>Editar Proveedor</>
    : <><i className="bi bi-plus-circle me-2"></i>Nuevo Proveedor</>}
</h5>
                  <button className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-8">
                        <label className="form-label">Nombre de la empresa *</label>
                        <input className="form-control" placeholder="Ej: Distribuidora El Sol"
                          value={form.company_name}
                          onChange={e => setForm({...form, company_name: e.target.value})} required />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">NIT</label>
                        <input className="form-control" placeholder="Ej: 900123456-7"
                          value={form.nit}
                          onChange={e => setForm({...form, nit: e.target.value})} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Nombre del proveedor *</label>
                        <input className="form-control" placeholder="Ej: Juan Pérez"
                          value={form.name}
                          onChange={e => setForm({...form, name: e.target.value})} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Contacto</label>
                        <input className="form-control" placeholder="Ej: 3101234567"
                          value={form.contact_name}
                          onChange={e => setForm({...form, contact_name: e.target.value})} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Email</label>
                        <input className="form-control" type="email" placeholder="correo@empresa.com"
                          value={form.email}
                          onChange={e => setForm({...form, email: e.target.value})} />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Teléfono</label>
                        <input className="form-control" placeholder="Ej: 3001234567"
                          value={form.phone}
                          onKeyPress={(e) => { if (!/[0-9+\s\-]/.test(e.key)) e.preventDefault(); }}
                          onChange={e => setForm({...form, phone: e.target.value.replace(/[^0-9+\s\-]/g,'')})} />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Dirección</label>
                        <textarea className="form-control" rows={2} placeholder="Ej: Cra 10 #20-30, Bogotá"
                          value={form.address}
                          onChange={e => setForm({...form, address: e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-success" disabled={loading}>
                      {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal Confirmar Eliminar */}
        <ConfirmModal
          show={!!confirmDelete}
          titulo="¿Eliminar proveedor?"
          mensaje={<>Se eliminará <strong>{confirmDelete?.company_name || confirmDelete?.name}</strong>. Si tiene órdenes de compra será desactivado.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => handleDelete(confirmDelete.id)}
          onCancelar={() => setConfirmDelete(null)}
        />

        {/* Modal proveedor con historial */}
        {deactivatedModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{maxWidth:440,width:'90%',margin:'auto',background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
              <div style={{background:'#fef3c7',padding:'16px 20px'}}>
               <h5 style={{margin:0,fontWeight:700,color:'#92400e'}}>
  <i className="bi bi-exclamation-triangle-fill me-2"></i>{deactivatedModal.titulo}
</h5>
              </div>
              <div style={{padding:'20px'}}>
                <p style={{fontWeight:600}}>{deactivatedModal.mensaje}</p>
                <p style={{color:'#6b7280',fontSize:14,margin:0}}>{deactivatedModal.detalle}</p>
              </div>
              <div style={{padding:'0 20px 20px',textAlign:'center'}}>
                <button style={{background:'#f59e0b',color:'#fff',border:'none',borderRadius:8,padding:'10px 40px',fontWeight:700,cursor:'pointer'}}
                  onClick={() => setDeactivatedModal(null)}>Entendido</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};
export default ManageSuppliers;