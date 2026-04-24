import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { supplierService } from '../../services/supplierService';
import ConfirmModal from '../../components/ConfirmModal';
import 'bootstrap/dist/css/bootstrap.min.css';

const EMPTY = { company_name:'', name:'', contact_name:'', email:'', phone:'', address:'', nit:'' };

const ManageSuppliers = () => {
  const { token } = useAuth();
  const [suppliers, setSuppliers]         = useState([]);
  const [search, setSearch]               = useState('');
  const [showModal, setShowModal]         = useState(false);
  const [editing, setEditing]             = useState(null);
  const [form, setForm]                   = useState(EMPTY);
  const [alert, setAlert]                 = useState(null);
  const [loading, setLoading]             = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    try { setSuppliers(await supplierService.getAll(token)); }
    catch (e) { showAlert('danger', e.message); }
  };
  useEffect(() => { load(); }, [token]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(() => setAlert(null), 3500); };
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
      nit:          s.nit||''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editing) { await supplierService.update(editing.id, form, token); showAlert('success','Proveedor actualizado'); }
      else         { await supplierService.create(form, token);             showAlert('success','Proveedor creado'); }
      setShowModal(false); load();
    } catch (e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { await supplierService.delete(id, token); showAlert('success','Proveedor eliminado'); setConfirmDelete(null); load(); }
    catch (e) { showAlert('danger', e.message); }
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
        <h4 className="fw-bold mb-4">🏭 Gestión de Proveedores</h4>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        <div className="d-flex gap-2 mb-3">
          <input className="form-control" style={{ maxWidth: 320 }}
            placeholder="🔍 Buscar proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-success" onClick={openAdd}>+ Nuevo Proveedor</button>
        </div>

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Empresa</th>
                  <th>NIT</th>
                  <th>Nombre proveedor</th>
                  <th>Número de Contacto</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Dirección</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="8" className="text-center text-muted py-4">No hay proveedores</td></tr>
                ) : filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i+1}</td>
                    <td className="fw-semibold">{s.company_name || '—'}</td>
                    <td style={{fontFamily:'monospace',fontSize:12}}>{s.nit || <span className="text-muted">—</span>}</td>
                    <td>{s.name || '—'}</td>
                    <td className="text-muted small">{s.contact_name || '—'}</td>
                    <td className="text-muted small">{s.email || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td className="text-muted small">{s.address || '—'}</td>
                    <td>
                     <div className="d-flex align-items-center gap-1">
                   <button className="btn btn-warning btn-sm" onClick={() => openEdit(s)}>
                   ✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(s)}>
               🗑️</button>
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
                  <h5 className="modal-title">{editing ? '✏️ Editar Proveedor' : '+ Nuevo Proveedor'}</h5>
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
                          onChange={e => setForm({...form, phone: e.target.value})} />
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
          mensaje={<>Se eliminará <strong>{confirmDelete?.company_name || confirmDelete?.name}</strong>. Esta acción no se puede deshacer.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => handleDelete(confirmDelete.id)}
          onCancelar={() => setConfirmDelete(null)}
        />
      </main>
    </div>
  );
};
export default ManageSuppliers;