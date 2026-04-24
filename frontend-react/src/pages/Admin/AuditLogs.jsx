import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { useAuth } from "../../context/AuthContext";

export default function AuditLogs() {
  const { token } = useAuth();
  const [logs,   setLogs]   = useState([]);
  const [error,  setError]  = useState(null);
  const [search, setSearch] = useState('');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');

  const roles = {
    admin:         "Administrador",
    admin_tecnico: "Admin Técnico",
    cajero:        "Cajero",
    sistema:       "Sistema",
  };

  const accionColor = {
    crear:         "text-success fw-bold",
    editar:        "text-warning fw-bold",
    eliminar:      "text-danger fw-bold",
    descuento:     "text-primary fw-bold",
    autorizacion:  "text-purple fw-bold",
  };

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams({ limit: '500' });
    if (from) params.set('from', from);
    if (to)   params.set('to',   to);

    fetch(`http://localhost:5000/api/audit/?${params}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => { if (!res.ok) throw new Error(`Error ${res.status}`); return res.json(); })
      .then(data => { setLogs(Array.isArray(data) ? data : []); setError(null); })
      .catch(err => { console.error(err); setError("No se pudieron cargar los logs: " + err.message); });
  }, [token, from, to]);

  const filtered = logs.filter(log =>
    !search ||
    (log.usuario_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.rol            || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.accion         || '').toLowerCase().includes(search.toLowerCase()) ||
    (log.descripcion    || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-1">🕵️ Logs de Auditoría</h4>
        <p className="text-muted mb-4">Registro de acciones importantes del sistema</p>

        {error && <div className="alert alert-danger">{error}</div>}

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label small fw-semibold">🔍 Buscar</label>
                <input className="form-control"
                  placeholder="Usuario, rol, acción o descripción..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Desde</label>
                <input type="date" className="form-control"
                  value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-semibold">Hasta</label>
                <input type="date" className="form-control"
                  value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <div className="col-md-2">
                <button className="btn btn-outline-secondary w-100"
                  onClick={() => { setSearch(''); setFrom(''); setTo(''); }}>
                  Limpiar
                </button>
              </div>
              <div className="col-md-1 d-flex align-items-end">
                <span className="badge bg-secondary">{filtered.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-bordered table-hover align-middle mb-0" style={{ fontSize: 13 }}>
              <thead className="table-light">
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Acción</th>
                  <th>Descripción</th>
                  <th style={{ whiteSpace:'nowrap' }}>Fecha y hora</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-4">
                      {error ? 'Error al cargar datos' : 'No hay registros aún'}
                    </td>
                  </tr>
                ) : filtered.map((log, i) => (
                  <tr key={i}>
                    <td className="fw-semibold">{log.usuario_nombre || "Sistema"}</td>
                    <td>{roles[log.rol] || log.rol || "-"}</td>
                    <td>
                      <span className={accionColor[log.accion] || "text-secondary fw-bold"}>
                        {log.accion}
                      </span>
                    </td>
                    <td className="text-muted" style={{ maxWidth:420 }}>
                      {log.descripcion || "-"}
                    </td>
                    <td style={{ whiteSpace:'nowrap' }}>
                      {log.fecha_hora ? new Date(log.fecha_hora).toLocaleString('es-CO') : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}