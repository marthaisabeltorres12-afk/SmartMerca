import { usePlan } from '../../context/PlanContext';
import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import 'bootstrap/dist/css/bootstrap.min.css';

// Activar mensajes de validación del navegador en español
const setValidationMessages = () => {
  document.querySelectorAll('input[required]').forEach(input => {
    input.addEventListener('invalid', () => {
      if (!input.value) {
        input.setCustomValidity('Por favor rellene este campo');
      } else if (input.type === 'email') {
        input.setCustomValidity('Ingrese un correo válido (ej: usuario@email.com)');
      } else if (input.minLength && input.value.length < input.minLength) {
        input.setCustomValidity(`Mínimo ${input.minLength} caracteres`);
      }
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
  });
};

const EMPTY = { name:'', email:'', password:'', role:'cajero', phone:'', address:'', doc_type:'CC', doc_number:'', is_active:true };

const ManageUsers = () => {
  const { token, user: me } = useAuth();
  const { hasFeature } = usePlan();
  const esAdminTecnico = me?.role === 'admin_tecnico' || me?.role === 'admin_tech';
  const soloLectura     = me?.role === 'auditor'; // Auditor: solo puede ver, no editar
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete,    setConfirmDelete]    = useState(null);
  const [deactivatedModal, setDeactivatedModal] = useState(null);

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
    setTimeout(setValidationMessages, 100);
  };


    
  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name:u.name,
      email:u.email,
      password:'',
      role:u.role,
      phone:u.phone||'',
      address:u.address||'',
      doc_type:u.doc_type||'CC',
      doc_number:u.doc_number||'',
      is_active:u.is_active
    });
    setShowModal(true);
    setTimeout(setValidationMessages, 100);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      name:form.name,
      email:form.email,
      role:form.role,
      phone:form.phone,
      address:form.address,
      doc_type:form.doc_type,
      doc_number:form.doc_number,
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
    if (id === me.id) {
      showAlert('danger', 'No puedes eliminar tu propio usuario');
      setConfirmDelete(null);
      return;
    }
    try {
      const res = await userService.delete(id, token);
      setConfirmDelete(null);
      if (res?.action === 'deactivated') {
        setDeactivatedModal({
          titulo:  'Usuario con historial',
          mensaje: res.message,
          detalle: res.detail,
        });
      } else {
        showAlert('success','Usuario eliminado');
      }
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
  role === 'admin_tecnico' ? <><i className="bi bi-wrench-adjustable me-1"></i>Adm. Técnico</> :
  role === 'admin'         ? <><i className="bi bi-gear-fill me-1"></i>Administrador</> :
  role === 'bodeguero'     ? <><i className="bi bi-box-seam me-1"></i>Bodeguero</> :
  role === 'supervisor'    ? <><i className="bi bi-eye-fill me-1"></i>Supervisor</> :
  role === 'contador'      ? <><i className="bi bi-bar-chart-fill me-1"></i>Contador</> :
  role === 'auditor'       ? <><i className="bi bi-search me-1"></i>Auditor</> :
  <><i className="bi bi-receipt me-1"></i>Cajero</>;

  const filtered = users
  .filter(u => {
    if (!esAdminTecnico && u.role === 'admin_tecnico') return false;

    const coincideBusqueda =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());

    const coincideRol =
      roleFilter === '' || u.role === roleFilter;

    return coincideBusqueda && coincideRol;
  });

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>
        
       <h4 className="fw-bold mb-1">
  <i className="bi bi-people-fill me-2"></i>
  {soloLectura ? "Usuarios — Solo lectura" : "Gestión de Usuarios"}
</h4>
        {soloLectura && <div className="alert alert-info py-2 mb-3 small"><i className="bi bi-lock-fill me-1"></i>Estás en modo lectura. El auditor puede ver usuarios pero no crear ni modificarlos.</div>}

        <p className="text-muted mb-4">Administra usuarios del sistema</p>

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
       <div className="d-flex gap-2 mb-3">
  <input
    className="form-control me-auto shadow-sm w-25"
    placeholder="Buscar usuario..."
    value={search}
    onChange={e => setSearch(e.target.value)}
  />

  <select
    className="form-select"
    style={{ maxWidth: '220px' }}
    value={roleFilter}
    onChange={e => setRoleFilter(e.target.value)}
  >
    <option value="">Todos los roles</option>
    <option value="admin">Administrador</option>
    <option value="admin_tecnico">Administrador Técnico</option>
    <option value="cajero">Cajero</option>
    <option value="bodeguero" disabled={!hasFeature('bodeguero')}>Bodeguero{!hasFeature('bodeguero') ? ' 🔒' : ''}</option>
    <option value="supervisor" disabled={!hasFeature('supervisor')}>Supervisor{!hasFeature('supervisor') ? ' 🔒' : ''}</option>
    <option value="contador" disabled={!hasFeature('contador')}>Contador{!hasFeature('contador') ? ' 🔒 Plan Premium' : ''}</option>
    <option value="auditor" disabled={!hasFeature('auditor')}>Auditor{!hasFeature('auditor') ? ' 🔒 Plan Premium' : ''}</option>
  </select>

  {!soloLectura && (
    <button className="btn btn-success" onClick={openAdd}>
      <i className="bi bi-plus-circle me-1"></i> Nuevo Usuario
    </button>
  )}
</div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Documento</th>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th>Dirección</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  {!soloLectura && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center text-muted py-4">
                      No hay usuarios
                    </td>
                  </tr>
                ) : filtered.map((u,i) => (
                  <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.6 }}>
                    <td>{i+1}</td>
                    <td className="text-muted small">{u.doc_type} {u.doc_number||'—'}</td>
                    <td className="fw-semibold">{u.name}</td>
                    <td className="text-muted small">{u.phone||'—'}</td>
                    <td className="text-muted small">{u.email}</td>
                    <td className="text-muted small" style={{maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.address||'—'}</td>
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
                    {!soloLectura && (
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <button
  className={`btn btn-sm ${u.is_active ? 'btn-outline-secondary' : 'btn-outline-success'}`}
  onClick={() => handleToggleActive(u)}
  title={u.is_active ? 'Desactivar' : 'Activar'}>
  <i className={`bi ${u.is_active ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
</button>
<button className="btn btn-warning btn-sm" onClick={() => openEdit(u)} title="Editar">
  <i className="bi bi-pencil"></i>
</button>
<button className="btn btn-danger btn-sm" onClick={() => { if (u.id === me.id) { showAlert('danger', 'No puedes eliminar tu propio usuario'); return; } setConfirmDelete(u); }} title="Eliminar">
  <i className="bi bi-trash"></i>
</button>
                      </div>
                    </td>
                    )}
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
                <form onSubmit={handleSave} autoComplete="off">
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {editing ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h5>
                    <button className="btn-close" onClick={() => setShowModal(false)} />
                  </div>

                  <div className="modal-body">
                    {/* Campos trampa para evitar autocompletado del navegador */}
                    <input type="text"     name="fake_user" style={{display:'none'}} readOnly />
                    <input type="password" name="fake_pass" style={{display:'none'}} readOnly />
                    <input className="form-control mb-2" placeholder="Nombre *"
                      value={form.name}
                      onChange={e=>setForm({...form,name:e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,"")})}
                      required
                    />

                    <input type="email" className="form-control mb-2" placeholder="Correo *"
                      value={form.email}
                      onChange={e=>setForm({...form,email:e.target.value})}
                      required
                    />

                    <input type="password" className="form-control mb-2"
                      placeholder={editing ? "Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}
                      value={form.password}
                      onChange={e=>setForm({...form,password:e.target.value})}
                      autoComplete="new-password"
                      name="new-password"
                      required={!editing}
                      minLength={6}
                    />
                    <div className="row g-2 mt-1">
                      <div className="col-md-4">
                        <select className="form-select form-select-sm" value={form.doc_type}
                          onChange={e=>setForm({...form,doc_type:e.target.value})}>
                          <option value="CC">CC</option>
                          <option value="CE">CE</option>
                          <option value="NIT">NIT</option>
                          <option value="Pasaporte">Pasaporte</option>
                          <option value="TI">TI</option>
                        </select>
                      </div>
                      <div className="col-md-8">
                        <input className="form-control form-control-sm" placeholder="Número documento"
                          value={form.doc_number}
                          onChange={e=>setForm({...form,doc_number:e.target.value})}/>
                      </div>
                      <div className="col-md-6">
                        <input className="form-control form-control-sm" placeholder="Teléfono"
                          value={form.phone}
                          onChange={e=>setForm({...form,phone:e.target.value})}/>
                      </div>
                      <div className="col-md-6">
                        <input className="form-control form-control-sm" placeholder="Dirección"
                          value={form.address}
                          onChange={e=>setForm({...form,address:e.target.value})}/>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold">Rol *</label>
                      <select className="form-select mb-1"
                        value={form.role}
                        onChange={e=>setForm({...form,role:e.target.value})}>
                        <option value="cajero">Cajero — Registra ventas y devoluciones</option>
<option value="bodeguero" disabled={!hasFeature('bodeguero')}>
                          Bodeguero — Recibe mercancía{!hasFeature('bodeguero') ? ' 🔒 Plan Estándar' : ''}
                        </option>
                        <option value="supervisor" disabled={!hasFeature('supervisor')}>
                          Supervisor — Ve reportes{!hasFeature('supervisor') ? ' 🔒 Plan Estándar' : ''}
                        </option>
<option value="contador" disabled={!hasFeature('contador')}>
                          Contador — Acceso a finanzas{!hasFeature('contador') ? ' 🔒 Plan Premium' : ''}
                        </option>
<option value="auditor" disabled={!hasFeature('auditor')}>
                          Auditor externo — Solo lectura{!hasFeature('auditor') ? ' 🔒 Plan Premium' : ''}
                        </option>
<option value="admin">Administrador de tienda — Gestión completa</option>
{esAdminTecnico && (
  <option value="admin_tecnico">Administrador técnico — Acceso total al sistema</option>
)}
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

      {/* ── Modal historial ── */}
      {deactivatedModal && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',position:'fixed',inset:0,zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{maxWidth:440,width:'90%',margin:'auto',background:'#fff',borderRadius:14,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
            <div style={{background:'#fef3c7',padding:'16px 20px'}}>
              <h5 style={{margin:0,fontWeight:700,color:'#92400e'}}>⚠️ {deactivatedModal.titulo}</h5>
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

export default ManageUsers;