import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const TechConfig = () => {
  const { token } = useAuth();
  const [saved,         setSaved]         = useState(false);
  const [securitySaved, setSecuritySaved] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg,     setBackupMsg]     = useState(null);

  // Configuración de inventario
  const [minStock,      setMinStock]      = useState(5);

  // Configuración de seguridad
  const [sessionHours,  setSessionHours]  = useState(8);
  const [jwtActive,     setJwtActive]     = useState(true);
  const [corsActive,    setCorsActive]    = useState(true);

  // Cargar configuración guardada al iniciar
  useEffect(() => {
    fetch(`${API_URL}/system-config/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(cfg => {
        if (cfg.min_stock     !== undefined) setMinStock(cfg.min_stock);
        if (cfg.session_hours !== undefined) setSessionHours(cfg.session_hours);
        if (cfg.jwt_active    !== undefined) setJwtActive(cfg.jwt_active);
        if (cfg.cors_active   !== undefined) setCorsActive(cfg.cors_active);
      })
      .catch(() => {});
  }, [token]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/system-config/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ min_stock: parseInt(minStock) }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveSecurity = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/system-config/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          session_hours: parseInt(sessionHours),
          jwt_active:    jwtActive,
          cors_active:   corsActive,
        }),
      });
      setSecuritySaved(true);
      setTimeout(() => setSecuritySaved(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    try {
      const response = await fetch(`${API_URL}/backup/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json();
        setBackupMsg({ type:'danger', text: err.message || 'Error al generar backup' });
        return;
      }
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0,10);
      a.href     = url;
      a.download = `smartmerca_backup_${date}.sql`;
      a.click();
      window.URL.revokeObjectURL(url);
      setBackupMsg({ type:'success', text: '✅ Backup descargado correctamente' });
    } catch(e) {
      setBackupMsg({ type:'danger', text: `Error: ${e.message}` });
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-4">⚙️ Configuración del Sistema</h4>

        <div className="row g-4">
          {/* Inventario */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header fw-semibold">📦 Configuración de Inventario</div>
              <div className="card-body">
                {saved && <div className="alert alert-success py-2 mb-3">✅ Configuración guardada</div>}
                <form onSubmit={handleSave}>
                  <div className="mb-3">
                    <label className="form-label">Stock mínimo para alerta</label>
                    <input className="form-control" type="number" min="1"
                      value={minStock} onChange={e => setMinStock(e.target.value)} />
                    <div className="form-text">Se generará alerta cuando el stock sea menor o igual a este valor.</div>
                  </div>
                  <button type="submit" className="btn btn-success">Guardar configuración</button>
                </form>
              </div>
            </div>
          </div>

          {/* Seguridad */}
          <div className="col-md-6">
            <div className="card">
              <div className="card-header fw-semibold">🔒 Seguridad del Sistema</div>
              <div className="card-body">
                {securitySaved && <div className="alert alert-success py-2 mb-3">✅ Seguridad guardada</div>}
                <form onSubmit={handleSaveSecurity}>
                  <div className="mb-3">
                    <label className="form-label">Tiempo de sesión (horas)</label>
                    <input className="form-control" type="number" min="1" max="24"
                      value={sessionHours} onChange={e => setSessionHours(e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" id="jwt"
                        checked={jwtActive} onChange={e => setJwtActive(e.target.checked)} />
                      <label className="form-check-label" htmlFor="jwt">Autenticación JWT activa</label>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="form-check form-switch">
                      <input className="form-check-input" type="checkbox" id="cors"
                        checked={corsActive} onChange={e => setCorsActive(e.target.checked)} />
                      <label className="form-check-label" htmlFor="cors">CORS habilitado</label>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">
                    Guardar seguridad
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Backup */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
              <div className="card-header fw-semibold border-0 bg-white" style={{ borderRadius:'12px 12px 0 0' }}>
                💾 Respaldo de Base de Datos
              </div>
              <div className="card-body">
                <p className="text-muted small mb-3">
                  Descarga una copia completa de la base de datos en formato <strong>.sql</strong>.
                  Guárdala en un lugar seguro (USB, Google Drive, etc).
                </p>
                <div className="d-flex align-items-center gap-3 p-3 rounded mb-3" style={{ background:'#f0f9ff' }}>
                  <div style={{ fontSize:'2rem' }}>🗄️</div>
                  <div>
                    <div className="fw-semibold">Base de datos: smartmerca</div>
                    <div className="text-muted small">Incluye: productos, ventas, clientes, usuarios, inventario</div>
                  </div>
                </div>
                {backupMsg && (
                  <div className={`alert alert-${backupMsg.type} py-2 mb-3`}>{backupMsg.text}</div>
                )}
                <button
                  className="btn btn-success w-100 fw-bold"
                  onClick={handleBackup}
                  disabled={backupLoading}
                >
                  {backupLoading
                    ? <><span className="spinner-border spinner-border-sm me-2"/>Generando backup...</>
                    : '💾 Descargar Backup'}
                </button>
                <div className="text-muted small mt-2 text-center">
                  Se recomienda hacer backup al final de cada día
                </div>
              </div>
            </div>
          </div>

          {/* Info del sistema */}
          <div className="col-12">
            <div className="card">
              <div className="card-header fw-semibold">ℹ️ Información del Sistema</div>
              <div className="card-body">
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><td className="fw-semibold">Nombre</td><td>SmartMerca</td></tr>
                    <tr><td className="fw-semibold">Versión</td><td>1.0.0</td></tr>
                    <tr><td className="fw-semibold">Backend</td><td>Flask + Python</td></tr>
                    <tr><td className="fw-semibold">Frontend</td><td>React + Bootstrap 5</td></tr>
                    <tr><td className="fw-semibold">Base de datos</td><td>MySQL</td></tr>
                    <tr><td className="fw-semibold">Sesión JWT</td><td>{sessionHours} horas</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
export default TechConfig;