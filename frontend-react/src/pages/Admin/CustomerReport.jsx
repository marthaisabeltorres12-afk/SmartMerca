import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { saleService } from '../../services/saleService';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const fmt = n => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(n);

const CustomerReport = () => {
  const { token } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [sales,     setSales]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [sortBy,    setSortBy]    = useState('total'); // total | visits | points

  useEffect(() => {
    Promise.all([
      customerService.getAll(token),
      saleService.getAll(token),
    ]).then(([c, s]) => {
      setCustomers(c);
      setSales(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  // Calcular datos por cliente
  const enriched = customers
    .filter(c => c.is_active)
    .map(c => {
      const myS    = sales.filter(s => s.customer_id === c.id);
      const total  = myS.reduce((a, s) => a + parseFloat(s.total), 0);
      const dates  = myS.map(s => s.created_at?.slice(0, 10)).filter(Boolean).sort();
      const last   = dates[dates.length - 1] || null;
      // Compras en últimos 90 días
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
      const cutStr = cutoff.toISOString().slice(0, 10);
      const recent = dates.filter(d => d >= cutStr).length;
      return { ...c, visits: myS.length, total, last, recent90: recent };
    })
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return c.full_name.toLowerCase().includes(q) ||
             c.doc_number.includes(search) ||
             (c.nid || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'visits') return b.visits - a.visits;
      if (sortBy === 'points') return b.points - a.points;
      return b.total - a.total;
    });

  // Tarjetas resumen
  const totalActivos  = customers.filter(c => c.is_active).length;
  const totalPuntos   = customers.reduce((a, c) => a + c.points, 0);
  const conCompras    = enriched.filter(c => c.visits > 0).length;
  const topCliente    = enriched.find(c => c.visits > 0);

  if (loading) return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft: 240, padding: 32 }}>
        <div className="d-flex align-items-center gap-2 text-muted">
          <div className="spinner-border spinner-border-sm"></div> Cargando reporte...
        </div>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft: 240, padding: 28, background: '#f8fafc', minHeight: '100vh', width: '100%' }}>

        {/* Título */}
        <div className="mb-4">
          <h4 className="fw-bold mb-0">👥 Reporte de Clientes</h4>
          <small className="text-muted">Ranking por compras, puntos acumulados y frecuencia de visita</small>
        </div>

        {/* Tarjetas resumen */}
        <div className="row g-3 mb-4">
          {[
            { icon: 'bi-people-fill',     color: '#3b82f6', bg: '#eff6ff', label: 'Clientes Activos',  val: totalActivos },
            { icon: 'bi-cart-check-fill', color: '#10b981', bg: '#f0fdf4', label: 'Con Compras',       val: conCompras },
            { icon: 'bi-star-fill',       color: '#f59e0b', bg: '#fffbeb', label: 'Puntos Totales',    val: totalPuntos.toLocaleString('es-CO') },
            { icon: 'bi-trophy-fill',     color: '#8b5cf6', bg: '#f5f3ff', label: 'Mejor Cliente',     val: topCliente ? topCliente.full_name.split(' ')[0] : '—' },
          ].map((c, i) => (
            <div key={i} className="col-6 col-md-3">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex align-items-center gap-3">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: 20 }}></i>
                  </div>
                  <div>
                    <div className="fw-bold fs-5 lh-1">{c.val}</div>
                    <div className="text-muted mt-1" style={{ fontSize: 12 }}>{c.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros y ordenamiento */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body d-flex flex-wrap gap-3 align-items-center py-2">
            <div style={{ flex: 1, minWidth: 200 }}>
              <input className="form-control form-control-sm" placeholder="🔍 Buscar por nombre, documento o NID..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="d-flex gap-2">
              {[
                { k: 'total',  lb: '💰 Mayor compra' },
                { k: 'visits', lb: '🛒 Más visitas'  },
                { k: 'points', lb: '⭐ Más puntos'   },
              ].map(s => (
                <button key={s.k}
                  className={`btn btn-sm ${sortBy === s.k ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setSortBy(s.k)}>
                  {s.lb}
                </button>
              ))}
            </div>
            <small className="text-muted ms-auto">{enriched.length} clientes</small>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle">
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    {['#', 'Cliente', 'Documento', 'Visitas', 'Últ. 90 días', 'Total compras', 'Puntos ⭐', 'Última visita', 'Frecuencia'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-muted py-4">Sin clientes que mostrar</td></tr>
                  )}
                  {enriched.map((c, i) => {
                    // Etiqueta de frecuencia según compras en 90 días
                    let freq, freqColor, freqBg;
                    if      (c.recent90 >= 8) { freq = '🔥 Frecuente';  freqColor = '#065f46'; freqBg = '#d1fae5'; }
                    else if (c.recent90 >= 3) { freq = '✅ Regular';    freqColor = '#1e40af'; freqBg = '#dbeafe'; }
                    else if (c.recent90 >= 1) { freq = '⚡ Ocasional';  freqColor = '#92400e'; freqBg = '#fef3c7'; }
                    else if (c.visits   >  0) { freq = '😴 Inactivo';   freqColor = '#991b1b'; freqBg = '#fee2e2'; }
                    else                      { freq = 'Sin compras';   freqColor = '#64748b'; freqBg = '#f1f5f9'; }

                    const medal = ['🥇','🥈','🥉'][i];

                    return (
                      <tr key={c.id}>
                        <td style={{ padding: '11px 14px', fontWeight: 600, fontSize: 15 }}>
                          {medal || <span className="text-muted" style={{ fontSize: 13 }}>{i + 1}</span>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div className="fw-semibold" style={{ fontSize: 14 }}>{c.full_name}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>{c.nid}</div>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13 }}>
                          <span className="badge bg-secondary me-1">{c.doc_type}</span>
                          {c.doc_number}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, textAlign: 'center' }}>
                          {c.visits}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span style={{ background: '#ede9fe', color: '#6d28d9', fontWeight: 600, fontSize: 12, padding: '2px 8px', borderRadius: 99 }}>
                            {c.recent90}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1e293b' }}>
                          {c.visits > 0 ? fmt(c.total) : <span className="text-muted" style={{ fontSize: 12 }}>Sin compras</span>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ background: '#fef9c3', color: '#854d0e', fontWeight: 600, fontSize: 12, padding: '2px 8px', borderRadius: 99 }}>
                            ⭐ {c.points}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: '#64748b' }}>
                          {c.last || <span className="text-muted">—</span>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ background: freqBg, color: freqColor, fontWeight: 600, fontSize: 11, padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap' }}>
                            {freq}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default CustomerReport;