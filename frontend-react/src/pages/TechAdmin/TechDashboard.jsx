import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { productService } from '../../services/productService';
import { apiFetch } from '../../services/api';
import 'bootstrap/dist/css/bootstrap.min.css';

const TechAdminDashboard = () => {
  const { token, user } = useAuth();
  const [users,    setUsers]    = useState([]);
  const [products, setProducts] = useState([]);
  const [auditoria,setAuditoria]= useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      userService.getAll(token).catch(() => []),
      productService.getAll(token).catch(() => []),
      apiFetch('/audit/', {}, token).catch(() => []),
    ]).then(([u, p, a]) => {
      setUsers(Array.isArray(u) ? u : []);
      setProducts(Array.isArray(p) ? p : []);
      setAuditoria(Array.isArray(a) ? a : a.logs || []);
      setLoading(false);
    });
  }, [token]);

  const roleCount = (role) => users.filter(u => u.role === role).length;
  const hoy = new Date().toISOString().slice(0,10);

  const statCards = [
    { value: roleCount('admin_tecnico'), label: 'Adm. Técnicos', color: 'secondary', icon: '🔧' },
    { value: roleCount('admin'),         label: 'Adm. Tienda',   color: 'primary',   icon: '⚙️' },
    { value: roleCount('cajero'),        label: 'Cajeros',       color: 'success',   icon: '🖥️' },
    { value: roleCount('bodeguero'),     label: 'Bodegueros',    color: 'info',      icon: '📦' },
    { value: products.length,           label: 'Productos',     color: 'warning',   icon: '🛒' },
    { value: products.filter(p=>p.stock<=(p.min_stock||5)).length, label: 'Stock bajo', color: 'danger', icon: '⚠️' },
    { value: users.length,              label: 'Total usuarios', color: 'dark',      icon: '👥' },
    { value: auditoria.filter(a=>a.fecha_hora?.slice(0,10)===hoy).length, label: 'Acciones hoy', color: 'primary', icon: '📋' },
  ];

  const quickLinks = [
    { to: '/tecnico/usuarios',   icon: '👥', label: 'Usuarios',        color: 'primary'   },
    { to: '/tecnico/productos',  icon: '📦', label: 'Productos',       color: 'success'   },
    { to: '/tecnico/proveedores',icon: '🚚', label: 'Proveedores',     color: 'info'      },
    { to: '/tecnico/clientes',   icon: '🧑', label: 'Clientes',        color: 'warning'   },
    { to: '/tecnico/auditoria',  icon: '🔍', label: 'Auditoría',       color: 'secondary' },
    { to: '/tecnico/config',     icon: '⚙️', label: 'Configuración',   color: 'dark'      },
    { to: '/tecnico/politicas',  icon: '🏪', label: 'Políticas',       color: 'primary'   },
    { to: '/tecnico/backup',     icon: '💾', label: 'Backup',          color: 'danger'    },
  ];

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{marginLeft:240,minHeight:'100vh'}}>
        <div className="spinner-border text-primary"/>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>
        <div className="mb-4 d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-0">🔧 Panel Administrador Técnico</h4>
            <small className="text-muted">Bienvenido, <strong>{user?.name}</strong> — Acceso total al sistema</small>
          </div>
          <span className="badge bg-dark fs-6">🔧 Admin Técnico</span>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          {statCards.map((s, i) => (
            <div key={i} className="col-6 col-md-3">
              <div className={`card border-0 shadow-sm border-start border-${s.color} border-3`}>
                <div className="card-body py-3 d-flex align-items-center gap-3">
                  <span style={{ fontSize:'1.8rem' }}>{s.icon}</span>
                  <div>
                    <div className={`fs-3 fw-bold text-${s.color}`}>{s.value}</div>
                    <div className="text-muted small">{s.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Acceso rápido */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header fw-semibold">⚡ Acceso rápido</div>
          <div className="card-body">
            <div className="row g-3">
              {quickLinks.map(l => (
                <div key={l.to} className="col-6 col-md-3">
                  <Link to={l.to} className={`btn btn-outline-${l.color} w-100 py-3 d-flex flex-column align-items-center gap-2 text-decoration-none`}>
                    <span style={{ fontSize:'1.8rem' }}>{l.icon}</span>
                    <span style={{ fontSize:'0.82rem', fontWeight:600 }}>{l.label}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Últimos logs */}
        <div className="card border-0 shadow-sm">
          <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
            <span>🔍 Últimas acciones del sistema</span>
            <Link to="/tecnico/auditoria" className="btn btn-sm btn-outline-secondary">Ver todos →</Link>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0" style={{fontSize:13}}>
              <thead className="table-light">
                <tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Descripción</th></tr>
              </thead>
              <tbody>
                {auditoria.slice(0,8).map((a,i) => (
                  <tr key={i}>
                    <td className="text-muted">{a.fecha_hora?.slice(0,16).replace('T',' ')}</td>
                    <td className="fw-semibold">{a.usuario_nombre||'—'}</td>
                    <td><span className="badge bg-secondary" style={{fontSize:10}}>{a.rol||'—'}</span></td>
                    <td><span className={`badge ${a.accion==='eliminar'?'bg-danger':a.accion==='crear'?'bg-success':a.accion==='editar'?'bg-warning text-dark':'bg-secondary'}`}>{a.accion||'—'}</span></td>
                    <td className="text-muted">{a.descripcion||'—'}</td>
                  </tr>
                ))}
                {!auditoria.length && <tr><td colSpan={5} className="text-center text-muted py-3">Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TechAdminDashboard;