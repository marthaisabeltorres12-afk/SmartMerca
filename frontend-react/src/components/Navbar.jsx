import React, { useState, useRef, useEffect } from "react";
import { useNotifications } from "../hooks/useNotifications";
import NotificationToasts from "./NotificationToasts";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

const adminLinks = [
  { path: "/admin", icon: "bi-speedometer2", label: "Dashboard" },

  // 📦 INVENTARIO
  {
    group: true, label: "Inventario", icon: "bi-archive", key: "inventario",
    children: [
      { path: "/admin/productos",      icon: "bi-box",          label: "Productos" },
      { path: "/admin/importar",       icon: "bi-upload", label: "Importar/Exportar" },
      { path: "/admin/inventario",     icon: "bi-archive",      label: "Inventario" },
      { path: "/admin/proveedores",    icon: "bi-truck",        label: "Proveedores" },
      { path: "/admin/presentaciones", icon: "bi-boxes",        label: "Presentaciones" },
      { path: "/admin/lineas",         icon: "bi-grid-3x3-gap", label: "Líneas/Categorías" },
      { path: "/admin/bodegas",        icon: "bi-building",     label: "Bodegas" },
      { path: "/admin/conteo",         icon: "bi-clipboard-check", label: "Conteo Físico" },
      { path: "/admin/merma",          icon: "bi-exclamation-triangle", label: "Merma" },
      { path: "/admin/ordenes-compra", icon: "bi-cart-plus",    label: "Órdenes de Compra" },
    ]
  },

  // 👥 CLIENTES
  {
    group: true, label: "Clientes", icon: "bi-people", key: "clientes",
    children: [
      { path: "/admin/clientes",         icon: "bi-person-heart",      label: "Clientes" },
      { path: "/admin/reporte-clientes", icon: "bi-person-lines-fill", label: "Reporte Clientes" },
      { path: "/admin/cartera",          icon: "bi-credit-card-2-front", label: "Cartera" },
    ]
  },

  // 💰 FINANZAS
  {
    group: true, label: "Finanzas", icon: "bi-cash-stack", key: "finanzas",
    children: [
      { path: "/admin/cuentas-pagar", icon: "bi-receipt",      label: "Cuentas x Pagar" },
      { path: "/admin/nomina",        icon: "bi-person-badge", label: "Nómina" },
    ]
  },

  // ⚙️ OPERACIONES
  {
    group: true, label: "Operaciones", icon: "bi-gear", key: "operaciones",
    children: [
      { path: "/admin/usuarios",   icon: "bi-person-badge",    label: "Usuarios" },
      { path: "/admin/sucursales", icon: "bi-shop",            label: "Sucursales" },
      { path: "/admin/turno",      icon: "bi-toggle-on",       label: "Turnos y Cierres" },
      { path: "/admin/promociones",icon: "bi-gift-fill",       label: "Promociones" },
      { path: "/admin/catalogo",   icon: "bi-shop-window",     label: "Catálogo en línea" },
      { path: "/admin/etiquetas",  icon: "bi-tag",             label: "Etiquetas" },
      { path: "/admin/pin",        icon: "bi-shield-lock",     label: "Mi PIN" },
      { path: "/admin/politicas",  icon: "bi-clipboard-check", label: "Políticas" },
    ]
  },

  // 📊 REPORTES
  {
    group: true, label: "Reportes", icon: "bi-bar-chart", key: "reportes",
    children: [
      { path: "/admin/reportes",        icon: "bi-bar-chart",       label: "Reportes" },
      { path: "/admin/analisis-ventas", icon: "bi-graph-up-arrow",  label: "Análisis Ventas" },
      { path: "/admin/finanzas",        icon: "bi-currency-dollar", label: "Finanzas" },
      { path: "/admin/auditoria",       icon: "bi-clipboard-data",  label: "Auditoría" },
      { path: "/admin/alertas",         icon: "bi-bell",            label: "Alertas" },
    ]
  },
];

const cajeroLinks = [
  { path: "/cajero/ventas",       icon: "bi-cart",              label: "Punto de Venta" },
  { separator: true, label: "HISTORIAL" },
  { path: "/cajero/historial",    icon: "bi-receipt",           label: "Historial Tickets" },
  { separator: true, label: "OPERACIONES" },
  { path: "/cajero/devoluciones", icon: "bi-arrow-return-left", label: "Devoluciones" },
  { path: "/cajero/turno",        icon: "bi-toggle-on",         label: "Mi Turno / Cierre" },
];

const tecnicoLinks = [
  { path: "/tecnico",              icon: "bi-speedometer2",    label: "Dashboard" },
  { separator: true, label: "USUARIOS" },
  { path: "/tecnico/usuarios",     icon: "bi-people",          label: "Usuarios" },
  { separator: true, label: "INVENTARIO" },
  { path: "/tecnico/productos",    icon: "bi-box",             label: "Productos" },
  { path: "/tecnico/proveedores",  icon: "bi-truck",           label: "Proveedores" },
  { separator: true, label: "CLIENTES" },
  { path: "/tecnico/clientes",     icon: "bi-person-heart",    label: "Clientes" },
  { separator: true, label: "SISTEMA" },
  { path: "/tecnico/auditoria",    icon: "bi-shield-check",    label: "Auditoría" },
  { path: "/tecnico/politicas",    icon: "bi-building",        label: "Políticas negocio" },
  { path: "/tecnico/config",       icon: "bi-gear",            label: "Configuración" },
  { path: "/tecnico/backup",       icon: "bi-cloud-download",  label: "Backup" },
  { path: "/tecnico/lineas",       icon: "bi-grid-3x3-gap",    label: "Líneas/Categorías" },
];

const bodegueroLinks = [
  { path: "/admin/inventario",     icon: "bi-archive",         label: "Inventario" },
  { separator: true, label: "OPERACIONES" },
  { path: "/admin/ordenes-compra", icon: "bi-cart-plus",       label: "Órdenes de Compra" },
  { path: "/admin/conteo",         icon: "bi-clipboard-check", label: "Conteo Físico" },
  { path: "/admin/bodegas",        icon: "bi-building",        label: "Bodegas" },
  { separator: true, label: "PRODUCTOS" },
  { path: "/admin/productos",      icon: "bi-box",             label: "Productos" },
  { path: "/admin/proveedores",    icon: "bi-truck",           label: "Proveedores" },
];

const supervisorLinks = [
  { path: "/supervisor",           icon: "bi-speedometer2",   label: "Dashboard" },
  { separator: true, label: "VENTAS" },
  { path: "/supervisor/ventas",    icon: "bi-receipt",        label: "Ventas del día" },
  { path: "/supervisor/analisis",  icon: "bi-graph-up-arrow", label: "Análisis de ventas" },
  { separator: true, label: "OPERACIONES" },
  { path: "/supervisor/alertas",   icon: "bi-bell",           label: "Alertas de stock" },
  { path: "/supervisor/productos", icon: "bi-box",            label: "Productos" },
  { separator: true, label: "CLIENTES" },
  { path: "/supervisor/clientes",  icon: "bi-people",         label: "Clientes" },
];

const contadorLinks = [
  { path: "/contador",             icon: "bi-speedometer2",    label: "Dashboard" },
  { separator: true, label: "FINANZAS" },
  { path: "/contador/finanzas",    icon: "bi-cash-stack",      label: "Finanzas" },
  { path: "/contador/ventas",      icon: "bi-receipt",         label: "Ventas" },
  { path: "/contador/cuentas",     icon: "bi-credit-card",     label: "Cuentas por pagar" },
  { separator: true, label: "NÓMINA" },
  { path: "/contador/nomina",      icon: "bi-person-badge",    label: "Nómina" },
  { separator: true, label: "AUDITORÍA" },
  { path: "/contador/auditoria",   icon: "bi-shield-check",    label: "Auditoría" },
];

const auditorLinks = [
  { path: "/auditor",              icon: "bi-speedometer2",   label: "Dashboard" },
  { separator: true, label: "AUDITORÍA" },
  { path: "/auditor/logs",         icon: "bi-shield-check",   label: "Logs del sistema" },
  { separator: true, label: "REPORTES" },
  { path: "/auditor/ventas",       icon: "bi-receipt",        label: "Ventas (lectura)" },
  { path: "/auditor/inventario",   icon: "bi-archive",        label: "Movimientos" },
];

const Navbar = () => {
  const { user, logout, token } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed,    setCollapsed]    = useState(false);
  const [bellOpen,     setBellOpen]     = useState(false);
  const [openGroups,   setOpenGroups]   = useState({});
  const [closedByUser, setClosedByUser] = useState({});

  const toggleGroup = (key) => {
    const isCurrentlyOpen = openGroups[key] || (activeGroupKey === key && !closedByUser[key]);
    if (isCurrentlyOpen) {
      setClosedByUser(c => ({ ...c, [key]: true }));
      setOpenGroups(g => ({ ...g, [key]: false }));
    } else {
      setClosedByUser(c => ({ ...c, [key]: false }));
      setOpenGroups(g => ({ ...g, [key]: true }));
    }
  };

  const activeGroupKey = adminLinks.find(l => l.group && l.children?.some(c => c.path === location.pathname))?.key;
  const isGroupOpen = (key) => openGroups[key] || (activeGroupKey === key && !closedByUser[key]);
  const bellRef = useRef();
  const canSeeBell = ['admin','admin_tecnico','supervisor','contador','auditor'].includes(user?.role);
  const { notifications, unread, toasts, markAllRead, dismissToast, resolverNotif, resolverTodas } = useNotifications(token, canSeeBell);

  useEffect(() => {
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const links = user?.role === 'admin_tecnico' ? tecnicoLinks
    : user?.role === 'admin'      ? adminLinks
    : user?.role === 'cajero'     ? cajeroLinks
    : user?.role === 'bodeguero'  ? bodegueroLinks
    : user?.role === 'supervisor' ? supervisorLinks
    : user?.role === 'contador'   ? contadorLinks
    : user?.role === 'auditor'    ? auditorLinks
    : cajeroLinks;

  const roleLabel = {
    admin_tecnico: '🔧 Admin Técnico',
    admin:         '⚙️ Administrador',
    cajero:        '🖥️ Cajero',
    bodeguero:     '📦 Bodeguero',
    supervisor:    '👁️ Supervisor',
    contador:      '📊 Contador',
    auditor:       '🔍 Auditor',
  }[user?.role] || user?.role;

  const initial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <>
      <style>{`
        .sidebar {
          position: fixed; left: 0; top: 0; height: 100vh;
          width: ${collapsed ? "70px" : "240px"};
          background: linear-gradient(160deg, #020617, #0f172a);
          color: white; transition: 0.3s; z-index: 1000;
          display: flex; flex-direction: column;
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .brand { display:flex; align-items:center; gap:10px; padding:20px; font-weight:700; font-size:18px; }
        .brand-icon {
          width:36px; height:36px; display:flex; align-items:center; justify-content:center;
          border-radius:10px; background:linear-gradient(135deg,#3b82f6,#1d4ed8); flex-shrink:0;
        }
        .nav-links { flex:1; padding:10px; overflow-y:auto; }
        .nav-link-sm {
          display:flex; align-items:center; gap:12px; padding:11px 14px; border-radius:10px;
          color:#cbd5f5; text-decoration:none; font-size:15px;
        }
        .nav-link-sm:hover { background:rgba(255,255,255,0.07); color:white; }
        .nav-link-sm.active { background:rgba(59,130,246,0.18); color:#60a5fa; }
        .icon-box {
          width:34px; height:34px; display:flex; align-items:center; justify-content:center;
          font-size:18px; border-radius:8px; background:rgba(255,255,255,0.07); flex-shrink:0;
        }
        .footer { padding:15px; border-top:1px solid rgba(255,255,255,0.05); position:sticky; bottom:0; background:#0f172a; }
        .avatar {
          width:35px; height:35px; border-radius:50%; display:flex; align-items:center; justify-content:center;
          background:linear-gradient(135deg,#3b82f6,#1d4ed8); font-weight:700; flex-shrink:0;
        }
        .logout-btn { width:100%; margin-top:10px; }
        .toggle {
          position:absolute; top:15px; right:-12px; background:#1e293b; border:none;
          width:25px; height:25px; border-radius:50%; color:white; cursor:pointer; z-index:1001;
        }
        .role-badge {
          font-size:10px; padding:2px 8px; border-radius:20px;
          background:rgba(59,130,246,0.2); color:#93c5fd; font-weight:600; display:inline-block;
        }
      `}</style>

      <div className="sidebar">
        <button className="toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "›" : "‹"}
        </button>

        <div className="brand">
          <div className="brand-icon">🛒</div>
          {!collapsed && "SmartMerca"}
        </div>

        <div className="nav-links">

          <button onClick={toggleDarkMode} title={darkMode?'Modo claro':'Modo oscuro'}
            style={{ background:'none', border:'none', color:'#cbd5e1', cursor:'pointer', padding:'8px 10px', fontSize:18 }}
            onMouseEnter={e=>e.currentTarget.style.color='#fff'}
            onMouseLeave={e=>e.currentTarget.style.color='#cbd5e1'}>
            {darkMode ? '☀️' : '🌙'}
          </button>

          {canSeeBell && (
            <div ref={bellRef} style={{ position:'relative', padding:'8px 10px' }}>
              <button onClick={() => { setBellOpen(o=>!o); if(!bellOpen) markAllRead(); }}
                style={{ background:'none', border:'none', color:'#cbd5f5', cursor:'pointer', position:'relative', padding:4 }}
                title="Notificaciones">
                <i className="bi bi-bell-fill" style={{ fontSize:18 }}></i>
                {unread > 0 && (
                  <span style={{ position:'absolute', top:-2, right:-2, background:'#ef4444', color:'#fff',
                    borderRadius:'50%', width:17, height:17, fontSize:10, fontWeight:700,
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div style={{ position:'absolute', left:collapsed?60:0, top:'100%', zIndex:1000,
                  background:'#1e293b', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8,
                  width:320, maxHeight:420, overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)',
                    fontWeight:700, fontSize:13, color:'#f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>🔔 Notificaciones</span>
                    <span style={{ fontSize:11, color:'#64748b' }}>{notifications.length} activas</span>
                  </div>
                  {!notifications.length ? (
                    <div style={{ padding:'24px 16px', textAlign:'center', color:'#64748b', fontSize:13 }}>
                      <div style={{ fontSize:24, marginBottom:8 }}>✅</div>Todo en orden
                    </div>
                  ) : (
                    <>
                      {notifications.map(n => {
                        const tipoColor = { stock_bajo:'#f59e0b', vencimiento:'#ef4444', cierre_turno:'#8b5cf6',
                          producto_faltante:'#3b82f6', producto_danado:'#ef4444',
                          conteo_diferencia:'#f59e0b', otro:'#64748b' }[n.tipo]||'#64748b';
                        const tipoIcon = { stock_bajo:'bi-graph-down', vencimiento:'bi-calendar-x', cierre_turno:'bi-lock',
                          producto_faltante:'bi-box', producto_danado:'bi-exclamation-triangle',
                          conteo_diferencia:'bi-calculator', otro:'bi-bell' }[n.tipo]||'bi-bell';
                        return (
                          <div key={n.id} style={{ display:'flex', gap:10, padding:'10px 16px',
                            borderBottom:'1px solid rgba(255,255,255,0.05)', alignItems:'flex-start' }}>
                            <i className={`bi ${tipoIcon}`} style={{ color:tipoColor, fontSize:16, marginTop:1, flexShrink:0 }}></i>
                            <div style={{ flex:1 }}>
                              <div style={{ color:'#f1f5f9', fontSize:12, fontWeight:600 }}>{n.titulo}</div>
                              <div style={{ color:'#94a3b8', fontSize:11, marginTop:2 }}>{n.mensaje}</div>
                              {n.creado_por_nombre && <div style={{ color:'#64748b', fontSize:10, marginTop:2 }}>Por: {n.creado_por_nombre}</div>}
                            </div>
                            <button onClick={() => resolverNotif(n.id)}
                              style={{ background:'none', border:'1px solid #334155', borderRadius:4,
                                color:'#94a3b8', cursor:'pointer', fontSize:11, padding:'2px 6px', flexShrink:0 }}>✓</button>
                          </div>
                        );
                      })}
                      <div style={{ padding:'8px 16px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
                        <button onClick={() => resolverTodas()}
                          style={{ width:'100%', background:'#1e3a5f', border:'none', borderRadius:6,
                            color:'#fff', padding:'6px', fontSize:12, cursor:'pointer', fontWeight:700 }}>
                          ✓ Resolver todas
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {links.map((link, i) =>
            link.group ? (
              <div key={link.key}>
                <button onClick={() => toggleGroup(link.key)}
                  style={{ width:'100%', background:'none', border:'none', color:'rgba(255,255,255,0.7)',
                    display:'flex', alignItems:'center', gap:10, padding:collapsed?'11px 0':'11px 16px',
                    justifyContent:collapsed?'center':'space-between', cursor:'pointer',
                    borderTop:i>0?'1px solid rgba(255,255,255,0.06)':'none', marginTop:i>0?4:0 }}
                  title={collapsed?link.label:''}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <i className={`bi ${link.icon}`} style={{ fontSize:19, color:isGroupOpen(link.key)?'#818cf8':'rgba(255,255,255,0.6)', flexShrink:0 }}></i>
                    {!collapsed && <span style={{ fontSize:14, fontWeight:700 }}>{link.label}</span>}
                  </div>
                  {!collapsed && <i className={`bi bi-chevron-${isGroupOpen(link.key)?'up':'down'}`} style={{ fontSize:10, opacity:0.5 }}></i>}
                </button>
                {isGroupOpen(link.key) && !collapsed && (
                  <div style={{ background:'rgba(0,0,0,0.2)', borderLeft:'2px solid rgba(129,140,248,0.3)', marginLeft:16 }}>
                    {link.children.map(child => (
                      <Link key={child.path} to={child.path}
                        className={`nav-link-sm ${location.pathname===child.path?'active':''}`}
                        style={{ paddingLeft:14, fontSize:13 }}>
                        <div className="icon-box" style={{ width:26, height:26, fontSize:15 }}>
                          <i className={`bi ${child.icon}`}></i>
                        </div>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
                {collapsed && isGroupOpen(link.key) && (
                  <div>
                    {link.children.map(child => (
                      <Link key={child.path} to={child.path}
                        className={`nav-link-sm ${location.pathname===child.path?'active':''}`}
                        style={{ justifyContent:'center', padding:'6px 0' }} title={child.label}>
                        <i className={`bi ${child.icon}`} style={{ fontSize:15 }}></i>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : link.separator ? (
              !collapsed && (
                <div key={i} style={{ padding:"10px 16px 4px", fontSize:"0.65rem", fontWeight:700,
                  letterSpacing:"0.08em", color:"rgba(255,255,255,0.35)", textTransform:"uppercase",
                  borderTop:i>0?"1px solid rgba(255,255,255,0.08)":"none", marginTop:i>0?6:0 }}>
                  {link.label}
                </div>
              )
            ) : (
              <Link key={link.path} to={link.path}
                className={`nav-link-sm ${location.pathname===link.path?"active":""}`}>
                <div className="icon-box"><i className={`bi ${link.icon}`}></i></div>
                {!collapsed && link.label}
              </Link>
            )
          )}
        </div>

        <div className="footer">
          <div className="d-flex align-items-center gap-2">
            <div className="avatar">{initial}</div>
            {!collapsed && (
              <div>
                <div style={{ fontSize:"14px", fontWeight:600 }}>{user?.name||"Usuario"}</div>
                <span className="role-badge">{roleLabel}</span>
              </div>
            )}
          </div>
          <button className="btn btn-danger btn-sm logout-btn" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right"></i>
            {!collapsed && " Cerrar sesión"}
          </button>
        </div>
      </div>
      <NotificationToasts toasts={toasts} onDismiss={dismissToast} />
    </>
  );
};

export default Navbar;