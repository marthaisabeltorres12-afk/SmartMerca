import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt    = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtNum = n => Number(n||0).toLocaleString('es-CO');

const KpiCard = ({ icon, label, value, sub, subColor }) => (
  <div className="card border-0 shadow-sm h-100">
    <div className="card-body py-3 px-3">
      <div className="d-flex align-items-center gap-2 mb-1">
        <span style={{ fontSize:22 }}>{icon}</span>
        <span className="text-muted small">{label}</span>
      </div>
      <div className="fw-bold" style={{ fontSize:22 }}>{value}</div>
      {sub && <div className={`small mt-1 fw-semibold ${subColor || 'text-muted'}`}>{sub}</div>}
    </div>
  </div>
);

// ── Dashboard principal ────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { token } = useAuth();
  const [data,       setData]       = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/dashboard/today', {}, token);
      setData(res);
      setLastUpdate(new Date());
    } catch(e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      </main>
    </div>
  );

  const variacion = data?.variacion_pct ?? 0;
  const varColor  = variacion >= 0 ? 'text-success' : 'text-danger';
  const varIcon   = variacion >= 0 ? '▲' : '▼';
  const alertas   = data?.alertas || {};

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold mb-0">📊 Dashboard</h4>
            <p className="text-muted small mb-0">
              Resumen del día · Actualizado {lastUpdate ? lastUpdate.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}) : '—'}
            </p>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={load}>🔄 Actualizar</button>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <KpiCard icon="💰" label="Ventas del día" value={fmt(data?.ventas_hoy)}
              sub={`${varIcon} ${Math.abs(variacion)}% vs ayer`} subColor={varColor} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="🧾" label="Transacciones" value={fmtNum(data?.transacciones)}
              sub={`Ticket prom: ${fmt(data?.ticket_promedio)}`} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="👤" label="Cajero top" value={data?.cajero_top?.nombre || '—'}
              sub={data?.cajero_top ? fmt(data.cajero_top.total) : 'Sin ventas aún'} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="⚠️" label="Alertas activas" value={alertas.total || 0}
              sub={alertas.total > 0 ? 'Requieren atención' : 'Todo en orden'}
              subColor={alertas.total > 0 ? 'text-warning' : 'text-success'} />
          </div>
        </div>

        <div className="row g-4">
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header fw-semibold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                🏆 Top 5 productos del día
              </div>
              <div className="card-body p-0">
                {!data?.top_productos?.length ? (
                  <div className="text-center text-muted py-4">Sin ventas registradas hoy</div>
                ) : (
                  <table className="table table-hover mb-0" style={{ fontSize:13 }}>
                    <thead className="table-light">
                      <tr><th>#</th><th>Producto</th><th className="text-end">Uds</th><th className="text-end">Valor</th></tr>
                    </thead>
                    <tbody>
                      {data.top_productos.map((p, i) => (
                        <tr key={i}>
                          <td><span style={{ fontSize:16 }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span></td>
                          <td className="fw-semibold">{p.nombre}</td>
                          <td className="text-end">{fmtNum(p.qty)}</td>
                          <td className="text-end text-success fw-bold">{fmt(p.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6 d-flex flex-column gap-4">
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                💳 Ventas por método de pago
              </div>
              <div className="card-body">
                {!data?.metodos_pago || !Object.keys(data.metodos_pago).length ? (
                  <div className="text-center text-muted py-2 small">Sin datos de métodos aún</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {Object.entries(data.metodos_pago).map(([metodo, total]) => {
                      const pct = data.ventas_hoy > 0 ? Math.round((total / data.ventas_hoy) * 100) : 0;
                      const colores = { efectivo:'success', tarjeta:'primary', nequi:'warning', transferencia:'info', credito:'danger' };
                      const color = colores[metodo] || 'secondary';
                      return (
                        <div key={metodo}>
                          <div className="d-flex justify-content-between small mb-1">
                            <span className="fw-semibold text-capitalize">{metodo}</span>
                            <span>{fmt(total)} <span className="text-muted">({pct}%)</span></span>
                          </div>
                          <div className="progress" style={{ height:6 }}>
                            <div className={`progress-bar bg-${color}`} style={{ width:`${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                🔔 Estado del sistema
              </div>
              <div className="card-body p-2">
                {[
                  { label:'Productos agotados',      val: alertas.stock_cero,   color:'danger'  },
                  { label:'Stock bajo',               val: alertas.stock_bajo,   color:'warning' },
                  { label:'Vencimientos próximos',    val: alertas.vencimientos, color:'warning' },
                  { label:'Turnos muy largos (+12h)', val: alertas.turno_largo,  color:'info'    },
                ].map((a, i) => (
                  <div key={i} className={`d-flex justify-content-between align-items-center px-3 py-2 rounded mb-1 ${a.val > 0 ? `bg-${a.color} bg-opacity-10` : 'bg-light'}`}>
                    <span className="small">{a.label}</span>
                    <span className={`badge ${a.val > 0 ? `bg-${a.color}` : 'bg-secondary'}`}>{a.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body py-3">
            <div className="row text-center g-3">
              <div className="col-4">
                <div className="text-muted small">Ventas hoy</div>
                <div className="fw-bold fs-5 text-primary">{fmt(data?.ventas_hoy)}</div>
              </div>
              <div className="col-4">
                <div className="text-muted small">Ventas ayer (misma hora)</div>
                <div className="fw-bold fs-5">{fmt(data?.total_ayer)}</div>
              </div>
              <div className="col-4">
                <div className="text-muted small">Variación</div>
                <div className={`fw-bold fs-5 ${varColor}`}>{varIcon} {Math.abs(variacion)}%</div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default AdminDashboard;