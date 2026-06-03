import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { categoryService } from '../../services/categoryService';
import ConfirmModal from '../../components/ConfirmModal';
import 'bootstrap/dist/css/bootstrap.min.css';
const EMPTY = {
  name: '',
  is_active: true
};
const Categorias = () => {
  const { token } = useAuth();
  const [categorias,        setCategorias]        = useState([]);
  const [search,           setSearch]           = useState('');
  const [showModal,        setShowModal]        = useState(false);
  const [editing,          setEditing]          = useState(null);
  const [form,             setForm]             = useState(EMPTY);
  const [alert,            setAlert]            = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [confirmDelete,    setConfirmDelete]    = useState(null);
  const [deactivatedModal, setDeactivatedModal] = useState(null);

  const load = async () => {
    try { setCategorias(await categoryService.getAll(token)); }
    catch (e) { showAlertMsg('danger', e.message); }
  };
  useEffect(() => { load(); }, [token]);

  const showAlertMsg = (type, msg) => { setAlert({type,msg}); setTimeout(() => setAlert(null), 3500); };

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
  setForm({
  name: s.name || '',
  is_active: s.is_active !== false
});
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editing) { await categoryService.update(editing.id, form, token); showAlertMsg('success','Categoría actualizada'); }
      else         { await categoryService.create(form, token);             showAlertMsg('success','Categoría creada'); }
      setShowModal(false); load();
    } catch (e) { showAlertMsg('danger', e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await categoryService.delete(id, token);
      setConfirmDelete(null);
      if (res?.action === 'deactivated') {
        setDeactivatedModal({
          titulo: 'Categoría con historial',
          mensaje: res.message,
          detalle: res.detail,
        });
      } else {
        showAlertMsg('success','Categoría eliminada');
      }
      load();
    } catch (e) { showAlertMsg('danger', e.message); }
  };

  const handleToggle = async (s) => {
    try {
      const updated = await categoryService.update(s.id, { ...s, is_active: !s.is_active }, token);
      setCategorias(prev => prev.map(x => x.id === (updated?.id || s.id)
        ? { ...x, is_active: !s.is_active } : x));
    } catch(e) { showAlertMsg('danger', e.message); }
  };

  const filtered = categorias.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );
  


  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-4">Gestión de Categorías</h4>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        <div className="d-flex gap-2 mb-3 ">
          <input className="form-control " style={{ maxWidth: 320 }}
            placeholder=" Buscar categoría..." value={search}
            onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-success ms-auto" onClick={openAdd}>+ Nueva Categoría</button>
        </div>

        <p className="text-muted small mb-2">
          Mostrando <strong>{filtered.length}</strong> de <strong>{categorias.length}</strong> categorías
        </p>

        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th><th>Nombre</th>
                  <th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="10" className="text-center text-muted py-4">No hay categorías</td></tr>
                ) : filtered.map((c, i) => (
                  <tr key={c.id} style={{opacity: c.is_active !== false ? 1 : 0.5}}>
                    <td>{i+1}</td>
                    <td className="fw-semibold">{c.name || '—'}</td>
                    <td>
                      <span className={`badge ${c.is_active !== false ? 'bg-success' : 'bg-secondary'}`}>
                        {c.is_active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="text-nowrap">
                      <div className="d-flex align-items-center gap-1">
                        <button
                          className={`btn btn-sm ${c.is_active !== false ? 'btn-outline-secondary' : 'btn-outline-success'}`}
                          onClick={() => handleToggle(c)}
                          title={c.is_active !== false ? 'Desactivar' : 'Activar'}>
                          {c.is_active !== false ? '❌' : '✅'}
                        </button>
                        <button className="btn btn-warning btn-sm" onClick={() => openEdit(c)}><i className="bi-pencil-square"></i></button>
                        <button
  className="btn btn-danger btn-sm"
  onClick={() => setConfirmDelete(c)}
>
  🗑️
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
                  <h5 className="modal-title bi-pencil-square">{editing ? ' Editar Categoría' : ' Nueva Categoría'}</h5>
                  <button className="btn-close" onClick={() => setShowModal(false)} />
                </div>
                <form onSubmit={handleSave}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-8">
                        <label className="form-label">Nombre </label>
                        <input className="form-control" placeholder="Ej: Lácteos"
                          value={form.name}
                          onChange={e => setForm({...form, name: e.target.value})} required />
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
          titulo="¿Eliminar categoría?"
          mensaje={<>Se eliminará <strong>{confirmDelete?.name}</strong>. Si tiene órdenes de compra será desactivado.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => handleDelete(confirmDelete.id)}
          onCancelar={() => setConfirmDelete(null)}
        />

        {/* Modal categoría con historial */}
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
export default Categorias;