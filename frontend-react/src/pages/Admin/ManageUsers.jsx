import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import 'bootstrap/dist/css/bootstrap.min.css';

const EMPTY = { name:'', email:'', password:'', role:'cajero', is_active:true };

const ManageUsers = () => {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    try { setUsers(await userService.getAll(token)); }
    catch(e) { showAlert('danger', e.message); }
  };

  useEffect(() => { load(); }, [token]);

  const showAlert = (type, msg) => {
    setAlert({type,msg});
    setTimeout(()=>setAlert(null),3000);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name:u.name,
      email:u.email,
      password:'',
      role:u.role,
      is_active:u.is_active
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name:form.name,
      email:form.email,
      role:form.role,
      is_active:form.is_active
    };

    if (form.password) payload.password = form.password;

    try {
      if (editing) {
        await userService.update(editing.id, payload, token);
        showAlert('success','Usuario actualizado');
      } else {
        if (!form.password) {
          showAlert('danger','La contraseña es requerida');
          setLoading(false);
          return;
        }
        await userService.create({ ...payload, password:form.password }, token);
        showAlert('success','Usuario creado');
      }
      setShowModal(false);
      load();
    } catch(e) {
      showAlert('danger', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await userService.update(u.id, { is_active: !u.is_active }, token);
      load();
    } catch(e) {
      showAlert('danger', e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await userService.delete(id, token);
      showAlert('success','Usuario eliminado');
      setConfirmDelete(null);
      load();
    } catch(e) {
      showAlert('danger', e.message);
    }
  };

  const roleBadge = (role) =>
    role === 'admin_tecnico' ? 'badge bg-info' :
    role === 'admin'         ? 'badge bg-primary' :
    role === 'bodeguero'     ? 'badge bg-warning text-dark' :
    role === 'supervisor'    ? 'badge bg-secondary' :
    role === 'contador'      ? 'badge bg-success' :
    role === 'auditor'       ? 'badge bg-dark' :
    'badge bg-light text-dark border';

  const roleLabel = (role) =>
    role === 'admin_tecnico' ? '🛠️ Adm. Técnico' :
    role === 'admin'         ? '⚙️ Administrador' :
    role === 'bodeguero'     ? '📦 Bodeguero' :
    role === 'supervisor'    ? '👁️ Supervisor' :
    role === 'contador'      ? '📊 Contador' :
    role === 'auditor'       ? '🔍 Auditor' :
    '🧾 Cajero';

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>
        
        <h4 className="fw-bold mb-1">👥 Gestión de Usuarios</h4>
        <p className="text-muted mb-4">Administra usuarios del sistema</p>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { label:'Total usuarios', value: users.length, color:'primary' },
            { label:'Inactivos', value: users.filter(u=>!u.is_active).length, color:'secondary' },
          ].map((k,i) => (
            <div key={i} className="col-md-3">
              <div className={`card border-${k.color} border-2 text-center`}>
                <div className="card-body py-3">
                  <div className={`fs-3 fw-bold text-${k.color}`}>{k.value}</div>
                  <div className="text-muted small">{k.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Buscador + botón */}
        <div className="d-flex gap-2 mb-3 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth:280 }}
            placeholder="🔍 Buscar usuario..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
          />
          <button className="btn btn-success ms-auto" onClick={openAdd}>
            + Nuevo Usuario
          </button>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted py-4">
                      No hay usuarios
                    </td>
                  </tr>
                ) : filtered.map((u,i) => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                    <td>{i+1}</td>
                    <td className="fw-semibold">{u.name}</td>
                    <td className="text-muted small">{u.email}</td>
                    <td>
                      <span className={roleBadge(u.role)}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'bg-success' : 'bg-secondary'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="text-muted small">
                      {u.created_at?.slice(0,10)}
                    </td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                          onClick={() => handleToggleActive(u)}
                        >
                          {u.is_active ? 'Desactivar' : 'Activar'}
                        </button>

                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openEdit(u)}
                        >
                          Editar
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setConfirmDelete(u)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal crear/editar */}
        {showModal && (
          <div className="modal d-block" style={{ background:'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <form onSubmit={handleSave}>
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editing ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h5>
                    <button className="btn-close" onClick={() => setShowModal(false)} />
                  </div>

                  <div className="modal-body">
                    <input className="form-control mb-2" placeholder="Nombre"
                      value={form.name}
                      onChange={e=>setForm({...form,name:e.target.value})}
                    />

                    <input className="form-control mb-2" placeholder="Correo"
                      value={form.email}
                      onChange={e=>setForm({...form,email:e.target.value})}
                    />

                    <input type="password" className="form-control mb-2" placeholder="Contraseña"
                      value={form.password}
                      onChange={e=>setForm({...form,password:e.target.value})}
                    />

                    <div className="mb-3">
                      <label className="form-label fw-semibold">Rol *</label>
                      <select className="form-select mb-1"
                        value={form.role}
                        onChange={e=>setForm({...form,role:e.target.value})}>
                        <option value="cajero">🧾 Cajero — Registra ventas y devoluciones</option>
                        <option value="bodeguero">📦 Bodeguero — Recibe mercancía, traslados y conteo</option>
                        <option value="supervisor">👁️ Supervisor — Ve reportes y aprueba descuentos</option>
                        <option value="contador">📊 Contador — Acceso a finanzas, nómina y reportes</option>
                        <option value="auditor">🔍 Auditor externo — Solo lectura, auditoría y reportes</option>
                        <option value="admin">⚙️ Administrador de tienda — Gestión completa</option>
                        <option value="admin_tecnico">🛠️ Administrador técnico — Acceso total al sistema</option>
                      </select>
                      <div className="form-text small text-muted">
                        {form.role === 'bodeguero'   && '📦 Puede recibir pedidos, trasladar stock y hacer conteo físico. No ve finanzas ni ventas.'}
                        {form.role === 'supervisor'  && '👁️ Ve reportes de su sección y puede aprobar descuentos. No modifica configuración.'}
                        {form.role === 'contador'    && '📊 Acceso completo a reportes financieros, nómina y auditoría. No hace ventas.'}
                        {form.role === 'auditor'     && '🔍 Solo puede ver auditoría y reportes. No puede modificar nada.'}
                        {form.role === 'cajero'      && '🧾 Registra ventas, devoluciones y atiende clientes en caja.'}
                        {form.role === 'admin'       && '⚙️ Gestiona productos, inventario, usuarios cajeros y reportes de su tienda.'}
                        {form.role === 'admin_tecnico'&& '🛠️ Acceso completo a todo el sistema incluyendo configuración técnica.'}
                      </div>
                    </div>

                    <div className="form-check form-switch">
                      <input type="checkbox" className="form-check-input"
                        checked={form.is_active}
                        onChange={e=>setForm({...form,is_active:e.target.checked})}
                      />
                      <label className="form-check-label">
                        Activo
                      </label>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={()=>setShowModal(false)}>
                      Cancelar
                    </button>
                    <button className="btn btn-primary" disabled={loading}>
                      {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal eliminar */}
        {confirmDelete && (
          <div className="modal d-block" style={{ background:'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-body">
                  ¿Eliminar a <strong>{confirmDelete.name}</strong>?
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={()=>setConfirmDelete(null)}>
                    Cancelar
                  </button>
                  <button className="btn btn-danger" onClick={()=>handleDelete(confirmDelete.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default ManageUsers;