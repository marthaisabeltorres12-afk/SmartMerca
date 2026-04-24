import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { productService } from '../../services/productService';
import 'bootstrap/dist/css/bootstrap.min.css';
const TechAdminDashboard = () => {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    Promise.all([userService.getAll(token), productService.getAll(token)])
      .then(([u, p]) => { setUsers(u); setProducts(p); })
      .catch(console.error);
  }, [token]);

  const roleCount = (role) => users.filter(u => u.role === role).length;

  const statCards = [
    { value: roleCount('admin_tecnico'), label: 'Adm. Técnicos', color: 'secondary' },
    {  value: roleCount('admin'),          label: 'Adm. Tienda',   color: 'primary'   },
    {  value: roleCount('cajero'),         label: 'Cajeros',       color: 'success'   },
    {  value: products.length,             label: 'Productos',     color: 'warning'   },
  ];

  const quickLinks = [
    { to: '/admin/usuarios',    icon: '👥', label: 'Gestionar Usuarios'    },
    { to: '/admin/productos',   icon: '📦', label: 'Gestionar Productos'   },
    { to: '/admin/proveedores', icon: '🏭', label: 'Gestionar Proveedores' },
    { to: '/admin',             icon: '📊', label: 'Ver Dashboard'         },
  ];

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-1"> Panel Administrador Técnico</h4>
        <p className="text-muted mb-4">Bienvenido, <strong>{user?.name}</strong></p>

        <div className="row g-3 mb-4">
          {statCards.map((s, i) => (
            <div key={i} className="col-6 col-md-3">
              <div className={`card border-${s.color} border-2 h-100`}>
                <div className="card-body d-flex align-items-center gap-3">
                  <span style={{ fontSize: '2rem' }}>{s.icon}</span>
                  <div>
                    <div className={`fs-3 fw-bold text-${s.color}`}>{s.value}</div>
                    <div className="text-muted small">{s.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header fw-semibold"> Acceso rápido</div>
          <div className="card-body">
            <div className="row g-3">
              {quickLinks.map(l => (
                <div key={l.to} className="col-6 col-md-3">
                  <Link to={l.to} className="btn btn-outline-secondary w-100 py-3 d-flex flex-column align-items-center gap-2 text-decoration-none">
                    <span style={{ fontSize: '1.8rem' }}>{l.icon}</span>
                    <span style={{ fontSize: '0.82rem' }}>{l.label}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
export default TechAdminDashboard;