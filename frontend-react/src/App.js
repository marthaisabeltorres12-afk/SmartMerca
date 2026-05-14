import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import NotifBanner           from './components/NotifBanner';
import Login                 from './pages/Login';
import ForgotPassword        from './pages/ForgotPassword';
import ResetPassword         from './pages/ResetPassword';


// ── Roles ──
import SupervisorDashboard from './pages/Roles/SupervisorDashboard';
import ContadorDashboard   from './pages/Roles/ContadorDashboard';
import AuditorDashboard    from './pages/Roles/AuditorDashboard';

// ── Admin ──
import DashboardPredictivo from './pages/Admin/DashboardPredictivo';
import AdminDashboard        from './pages/Admin/AdminDashboard';
import CuentasPagar          from './pages/Admin/CuentasPagar';
import Merma                 from './pages/Admin/Merma';
import OrdenesCompra         from './pages/Admin/OrdenesCompra';
import ConteoInventario      from './pages/Admin/ConteoInventario';
import Bodegas               from './pages/Admin/Bodegas';
import Sucursales            from './pages/Admin/Sucursales';
import Nomina                from './pages/Admin/Nomina';
import ManageProducts        from './pages/Admin/ManageProducts';
import Inventory             from './pages/Admin/Inventory';
import ManageSuppliers       from './pages/Admin/ManageSuppliers';
import ManageUsers           from './pages/Admin/ManageUsers';
import Alerts                from './pages/Admin/Alerts';
import Reports               from './pages/Admin/Reports';
import ManageCustomers       from './pages/Admin/ManageCustomers';
import AuditLogs             from './pages/Admin/AuditLogs';
import AdminPinSetup         from './pages/Admin/AdminPinSetup';
import Cartera               from './pages/Admin/Cartera';
import ManagePresentations   from './pages/Admin/ManagePresentations';
import LinesOverview         from './pages/Admin/LinesOverview';
import LineDashboard         from './pages/Admin/LineDashboard';
import ShiftManager          from './pages/Admin/TurnosCaja';
import Promotions            from './pages/Admin/Promotions';
import Catalogo              from './pages/Admin/Catalogo';
import Etiquetas             from './pages/Admin/Etiquetas';
import CustomerReport        from './pages/Admin/CustomerReport';
import SalesAnalysis         from './pages/Admin/SalesAnalysis';
import AdvancedFinance       from './pages/Admin/AdvancedFinance';
import BusinessPolicy        from './pages/Admin/BusinessPolicy';
import ImportarProductos from './pages/Admin/ImportarProductos';
// ── Cajero ──
import Sales                 from './pages/Cashier/Sales';
import SalesHistory          from './pages/Cashier/SalesHistory';
import Returns               from './pages/Cashier/Returns';
import CashierShift          from './pages/Cashier/ShiftManager';

// ── Admin Técnico ──
import TechAdminDashboard    from './pages/TechAdmin/TechAdminDashboard';
import TechDashboard         from './pages/TechAdmin/TechDashboard';
import TechProducts          from './pages/TechAdmin/TechProducts';
import TechSuppliers         from './pages/TechAdmin/TechSuppliers';
import TechUsers             from './pages/TechAdmin/TechUsers';
import TechConfig            from './pages/TechAdmin/TechConfig';

import './App.css';

const PrivateRoute = ({ children, roles }) => {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <NotifBanner />
          <Routes>

            {/* ── Públicas ── */}
            <Route path="/login"           element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            
            {/* ── Supervisor ── */}
            <Route path="/supervisor"           element={<PrivateRoute roles={['supervisor']}><SupervisorDashboard /></PrivateRoute>} />
            <Route path="/supervisor/ventas"    element={<PrivateRoute roles={['supervisor']}><SupervisorDashboard /></PrivateRoute>} />
            <Route path="/supervisor/productos" element={<PrivateRoute roles={['supervisor']}><SupervisorDashboard /></PrivateRoute>} />
            <Route path="/supervisor/clientes"  element={<PrivateRoute roles={['supervisor']}><SupervisorDashboard /></PrivateRoute>} />
            <Route path="/supervisor/alertas"   element={<PrivateRoute roles={['supervisor']}><SupervisorDashboard /></PrivateRoute>} />
            <Route path="/supervisor/analisis"  element={<PrivateRoute roles={['supervisor']}><SupervisorDashboard /></PrivateRoute>} />

            {/* ── Contador ── */}
            <Route path="/contador"             element={<PrivateRoute roles={['contador']}><ContadorDashboard /></PrivateRoute>} />
            <Route path="/contador/finanzas"    element={<PrivateRoute roles={['contador']}><ContadorDashboard /></PrivateRoute>} />
            <Route path="/contador/ventas"      element={<PrivateRoute roles={['contador']}><ContadorDashboard /></PrivateRoute>} />
            <Route path="/contador/nomina"      element={<PrivateRoute roles={['contador']}><ContadorDashboard /></PrivateRoute>} />
            <Route path="/contador/cuentas"     element={<PrivateRoute roles={['contador']}><ContadorDashboard /></PrivateRoute>} />
            <Route path="/contador/auditoria"   element={<PrivateRoute roles={['contador']}><ContadorDashboard /></PrivateRoute>} />

            {/* ── Auditor ── */}
            <Route path="/auditor"              element={<PrivateRoute roles={['auditor']}><AuditorDashboard /></PrivateRoute>} />
            <Route path="/auditor/logs"         element={<PrivateRoute roles={['auditor']}><AuditorDashboard /></PrivateRoute>} />
            <Route path="/auditor/ventas"       element={<PrivateRoute roles={['auditor']}><AuditorDashboard /></PrivateRoute>} />
            <Route path="/auditor/inventario"   element={<PrivateRoute roles={['auditor']}><AuditorDashboard /></PrivateRoute>} />

            {/* ── Admin ── */}
            <Route path="/admin"                   element={<PrivateRoute roles={['admin','admin_tecnico']}><AdminDashboard /></PrivateRoute>} />
            <Route path="/admin/productos"         element={<PrivateRoute roles={['admin','admin_tecnico','bodeguero']}><ManageProducts /></PrivateRoute>} />
            <Route path="/admin/inventario"        element={<PrivateRoute roles={['admin','admin_tecnico','bodeguero']}><Inventory /></PrivateRoute>} />
            <Route path="/admin/proveedores"       element={<PrivateRoute roles={['admin','admin_tecnico','bodeguero']}><ManageSuppliers /></PrivateRoute>} />
            <Route path="/admin/usuarios"          element={<PrivateRoute roles={['admin','admin_tecnico']}><ManageUsers /></PrivateRoute>} />
            <Route path="/admin/clientes"          element={<PrivateRoute roles={['admin','admin_tecnico']}><ManageCustomers /></PrivateRoute>} />
            <Route path="/admin/alertas"           element={<PrivateRoute roles={['admin','admin_tecnico']}><Alerts /></PrivateRoute>} />
            <Route path="/admin/reportes"          element={<PrivateRoute roles={['admin','admin_tecnico']}><Reports /></PrivateRoute>} />
            <Route path="/admin/auditoria"         element={<PrivateRoute roles={['admin','admin_tecnico']}><AuditLogs /></PrivateRoute>} />
            <Route path="/admin/pin"               element={<PrivateRoute roles={['admin','admin_tecnico']}><AdminPinSetup /></PrivateRoute>} />
            <Route path="/admin/cartera"           element={<PrivateRoute roles={['admin','admin_tecnico']}><Cartera /></PrivateRoute>} />
            <Route path="/admin/presentaciones"    element={<PrivateRoute roles={['admin','admin_tecnico']}><ManagePresentations /></PrivateRoute>} />
            <Route path="/admin/lineas"            element={<PrivateRoute roles={['admin','admin_tecnico']}><LinesOverview /></PrivateRoute>} />
            <Route path="/admin/lineas/:categoria" element={<PrivateRoute roles={['admin','admin_tecnico']}><LineDashboard /></PrivateRoute>} />
            <Route path="/admin/turno"             element={<PrivateRoute roles={['admin','admin_tecnico']}><ShiftManager /></PrivateRoute>} />
            <Route path="/admin/promociones"       element={<PrivateRoute roles={['admin','admin_tecnico']}><Promotions /></PrivateRoute>} />
            <Route path="/admin/catalogo"          element={<PrivateRoute roles={['admin','admin_tecnico']}><Catalogo /></PrivateRoute>} />
            <Route path="/admin/etiquetas"         element={<PrivateRoute roles={['admin','admin_tecnico']}><Etiquetas /></PrivateRoute>} />
            <Route path="/admin/reporte-clientes"  element={<PrivateRoute roles={['admin','admin_tecnico']}><CustomerReport /></PrivateRoute>} />
            <Route path="/admin/analisis-ventas"   element={<PrivateRoute roles={['admin','admin_tecnico']}><SalesAnalysis /></PrivateRoute>} />
            <Route path="/admin/finanzas"          element={<PrivateRoute roles={['admin','admin_tecnico']}><AdvancedFinance /></PrivateRoute>} />
            <Route path="/admin/cuentas-pagar"     element={<PrivateRoute roles={['admin','admin_tecnico']}><CuentasPagar /></PrivateRoute>} />
            <Route path="/admin/merma"             element={<PrivateRoute roles={['admin','admin_tecnico']}><Merma /></PrivateRoute>} />
            <Route path="/admin/ordenes-compra"    element={<PrivateRoute roles={['admin','admin_tecnico','bodeguero']}><OrdenesCompra /></PrivateRoute>} />
            <Route path="/admin/conteo"            element={<PrivateRoute roles={['admin','admin_tecnico','bodeguero']}><ConteoInventario /></PrivateRoute>} />
            <Route path="/admin/bodegas"           element={<PrivateRoute roles={['admin','admin_tecnico','bodeguero']}><Bodegas /></PrivateRoute>} />
            <Route path="/admin/sucursales"        element={<PrivateRoute roles={['admin','admin_tecnico']}><Sucursales /></PrivateRoute>} />
            <Route path="/admin/nomina"            element={<PrivateRoute roles={['admin','admin_tecnico']}><Nomina /></PrivateRoute>} />
            <Route path="/admin/politicas"         element={<PrivateRoute roles={['admin','admin_tecnico']}><BusinessPolicy /></PrivateRoute>} />
            <Route path="/admin/importar" element={<PrivateRoute roles={['admin','admin_tecnico']}><ImportarProductos /></PrivateRoute>} />
            <Route path="/admin/predicciones" element={<PrivateRoute roles={['admin','admin_tecnico']}><DashboardPredictivo /></PrivateRoute>} />
            {/* ── Cajero ── */}
            <Route path="/cajero/ventas"       element={<PrivateRoute roles={['cajero']}><Sales /></PrivateRoute>} />
            <Route path="/cajero/historial"    element={<PrivateRoute roles={['cajero']}><SalesHistory /></PrivateRoute>} />
            <Route path="/cajero/devoluciones" element={<PrivateRoute roles={['cajero']}><Returns /></PrivateRoute>} />
            <Route path="/cajero/turno"        element={<PrivateRoute roles={['cajero']}><CashierShift /></PrivateRoute>} />
            <Route path="/cajero"              element={<Navigate to="/cajero/ventas" />} />

            {/* ── Admin Técnico ── */}
            <Route path="/tecnico"             element={<PrivateRoute roles={['admin_tecnico']}><TechAdminDashboard /></PrivateRoute>} />
            <Route path="/tecnico/dashboard"   element={<PrivateRoute roles={['admin_tecnico']}><TechDashboard /></PrivateRoute>} />
            <Route path="/tecnico/productos"   element={<PrivateRoute roles={['admin_tecnico']}><TechProducts /></PrivateRoute>} />
            <Route path="/tecnico/proveedores" element={<PrivateRoute roles={['admin_tecnico']}><TechSuppliers /></PrivateRoute>} />
            <Route path="/tecnico/usuarios"    element={<PrivateRoute roles={['admin_tecnico']}><TechUsers /></PrivateRoute>} />
            <Route path="/tecnico/config"      element={<PrivateRoute roles={['admin_tecnico']}><TechConfig /></PrivateRoute>} />
            <Route path="/tecnico/clientes"    element={<PrivateRoute roles={['admin_tecnico']}><ManageCustomers /></PrivateRoute>} />
            <Route path="/tecnico/auditoria"   element={<PrivateRoute roles={['admin_tecnico']}><AuditLogs /></PrivateRoute>} />
            <Route path="/tecnico/politicas"   element={<PrivateRoute roles={['admin_tecnico']}><BusinessPolicy /></PrivateRoute>} />
            <Route path="/tecnico/backup"      element={<PrivateRoute roles={['admin_tecnico']}><TechConfig /></PrivateRoute>} />
            <Route path="/tecnico/lineas"      element={<PrivateRoute roles={['admin_tecnico']}><LinesOverview /></PrivateRoute>} />

            <Route path="/" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;