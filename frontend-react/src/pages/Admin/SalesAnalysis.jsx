import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// Muestra gramaje junto al nombre si existe
const dname = (p) => {
  if (!p) return '';
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const q = parseFloat(p.gramaje_cantidad);
    return `${p.name} · ${q === Math.floor(q) ? Math.floor(q) : q} ${p.gramaje_unidad}`;
  }
  return p.display_name || p.name;
};

// ── Proyección lineal simple (regresión por mínimos cuadrados) ───────────────
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return values;
  const sumX  = (n * (n - 1)) / 2;
  const sumX2 = values.reduce((a, _, i) => a + i * i, 0);
  const sumY  = values.reduce((a, v) => a + v, 0);
  const sumXY = values.reduce((a, v, i) => a + i * v, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return Array.from({ length: n + 3 }, (_, i) => Math.max(0, intercept + slope * i));
}

const SalesAnalysis = () => {
  const { token } = useAuth();
  const [sales,    setSales]    = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState('month');
  const [sinSearch,    setSinSearch]    = useState('');
  const [sinCatFilter, setSinCatFilter] = useState('');

  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('http://localhost:5000/api/sales/',    { headers: h }).then(r => r.json()),
      fetch('http://localhost:5000/api/products/', { headers: h }).then(r => r.json()),
    ]).then(([s, p]) => { setSales(s); setProducts(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const { labels, totals, counts } = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const d = s.created_at?.slice(0, 10);
      if (!d) return;
      let key;
      if (period === 'week') {
        const dt = new Date(d);
        const day = dt.getDay() || 7;
        dt.setDate(dt.getDate() - day + 1);
        key = dt.toISOString().slice(0, 10);
      } else if (period === 'month') {
        key = d.slice(0, 7);
      } else {
        key = d.slice(0, 4);
      }
      if (!map[key]) map[key] = { total: 0, count: 0 };
      map[key].total += parseFloat(s.total);
      map[key].count += 1;
    });
    const sorted = Object.keys(map).sort();
    return {
      labels: sorted.map(k => {
        if (period === 'month') {
          const [y, m] = k.split('-');
          return `${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][+m-1]} ${y}`;
        }
        return k;
      }),
      totals: sorted.map(k => map[k].total),
      counts: sorted.map(k => map[k].count),
    };
  }, [sales, period]);

  const proyected = useMemo(() => linearRegression(totals), [totals]);
  const projLabels = [...labels, 'Proy. +1', 'Proy. +2', 'Proy. +3'];

  // productRanking — enriquecido con dname buscando el producto por id
  const productRanking = useMemo(() => {
    const map = {};
    sales.forEach(s => s.items?.forEach(i => {
      const key = i.product_id || i.product;
      if (!map[key]) {
        const prod = products.find(p => p.id === i.product_id || p.name === i.product);
        map[key] = { name: prod ? dname(prod) : (i.product || 'Desconocido'), qty: 0, revenue: 0 };
      }
      map[key].qty     += parseFloat(i.quantity);
      map[key].revenue += parseFloat(i.price) * parseFloat(i.quantity);
    }));
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [sales, products]);

  const top10    = productRanking.slice(0, 10);
  const bottom10 = [...productRanking].sort((a, b) => a.qty - b.qty).slice(0, 10);

  const vendidosIds = useMemo(
    () => new Set(sales.flatMap(s => (s.items || []).map(i => i.product_id))),
    [sales]
  );

  const sinVentas = products.filter(p => p.is_active && !vendidosIds.has(p.id));

  const totalRevenue  = sales.reduce((a, s) => a + parseFloat(s.total), 0);
  const totalVentas   = sales.length;
  const ticketProm    = totalVentas > 0 ? totalRevenue / totalVentas : 0;
  const mejorPeriodo  = labels[totals.indexOf(Math.max(...totals))] || '—';
  const tendencia     = totals.length >= 2
    ? totals[totals.length-1] > totals[totals.length-2] ? '📈 Al alza' : '📉 A la baja'
    : '—';

  const chartOpts = { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => fmt(v) } } } };

  const hoy = new Date();

  const categorias = useMemo(
    () => [...new Set(products.filter(p => p.is_active).map(p => p.category).filter(Boolean))].sort(),
    [products]
  );

  const sinVentasDetalle = useMemo(() => {
    return products
      .filter(p => p.is_active && !vendidosIds.has(p.id))
      .filter(p => {
        const q = sinSearch.toLowerCase();
        const matchS = !sinSearch || dname(p).toLowerCase().includes(q);
        const matchC = !sinCatFilter || p.category === sinCatFilter;
        return matchS && matchC;
      })
      .map(p => {
        const created = p.created_at ? new Date(p.created_at) : null;
        const dias    = created ? Math.floor((hoy - created) / (1000 * 60 * 60 * 24)) : null;
        return { ...p, diasSinVenta: dias };
      })
      .sort((a, b) => (b.diasSinVenta ?? 0) - (a.diasSinVenta ?? 0));
  }, [products, vendidosIds, sinSearch, sinCatFilter]);

  const urgenciaTag = (dias) => {
    if (dias === null) return { lb: '—',             bg: '#f1f5f9', c: '#64748b' };
    if (dias >= 90)    return { lb: '🔴 +90 días',   bg: '#fee2e2', c: '#991b1b' };
    if (dias >= 30)    return { lb: '🟠 +30 días',   bg: '#ffedd5', c: '#9a3412' };
    if (dias >= 7)     return { lb: '🟡 +7 días',    bg: '#fef9c3', c: '#854d0e' };
    return               { lb: '⚪ Reciente',        bg: '#f1f5f9', c: '#64748b' };
  };

  if (loading) return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft: 240, padding: 32 }}>
        <div className="d-flex align-items-center gap-2 text-muted">
          <div className="spinner-border spinner-border-sm"></div> Cargando análisis...
        </div>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft: 240, padding: 28, background: '#f8fafc', minHeight: '100vh', width: '100%' }}>

        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold mb-0">📊 Análisis de Ventas</h4>
            <small className="text-muted">Tendencias, productos más/menos vendidos y proyección futura</small>
          </div>
          <div className="btn-group btn-group-sm">
            {[
              { k: 'week',  lb: 'Semanal' },
              { k: 'month', lb: 'Mensual' },
              { k: 'year',  lb: 'Anual'   },
            ].map(p => (
              <button key={p.k}
                className={`btn ${period === p.k ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setPeriod(p.k)}>
                {p.lb}
              </button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { icon: 'bi-cash-stack',      color: '#10b981', bg: '#f0fdf4', label: 'Ingresos Totales',   val: fmt(totalRevenue) },
            { icon: 'bi-cart-check',      color: '#3b82f6', bg: '#eff6ff', label: 'Total Ventas',       val: totalVentas },
            { icon: 'bi-receipt',         color: '#8b5cf6', bg: '#f5f3ff', label: 'Ticket Promedio',    val: fmt(ticketProm) },
            { icon: 'bi-graph-up-arrow',  color: '#f59e0b', bg: '#fffbeb', label: 'Tendencia',          val: tendencia },
            { icon: 'bi-trophy',          color: '#ef4444', bg: '#fef2f2', label: 'Mejor período',      val: mejorPeriodo },
            { icon: 'bi-box-seam',        color: '#64748b', bg: '#f1f5f9', label: 'Sin movimiento',     val: sinVentas.length },
          ].map((c, i) => (
            <div key={i} className="col-6 col-md-4 col-lg-2">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-3">
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: 17 }}></i>
                  </div>
                  <div className="fw-bold" style={{ fontSize: 15 }}>{c.val}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{c.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header border-0 bg-white pt-3 d-flex justify-content-between align-items-center">
                <span className="fw-bold">💰 Ingresos por período</span>
                <span className="badge bg-secondary" style={{ fontSize: 11 }}>{labels.length} períodos</span>
              </div>
              <div className="card-body" style={{ maxHeight: 280 }}>
                {labels.length === 0 ? (
                  <div className="text-center text-muted py-4">Sin datos de ventas</div>
                ) : (
                  <Bar data={{
                    labels,
                    datasets: [{
                      label: 'Ingresos',
                      data: totals,
                      backgroundColor: 'rgba(59,130,246,0.7)',
                      borderRadius: 6,
                    }]
                  }} options={chartOpts} />
                )}
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header border-0 bg-white pt-3">
                <span className="fw-bold">🛒 Cantidad de ventas</span>
              </div>
              <div className="card-body" style={{ maxHeight: 280 }}>
                {labels.length === 0 ? (
                  <div className="text-center text-muted py-4">Sin datos</div>
                ) : (
                  <Bar data={{
                    labels,
                    datasets: [{
                      label: 'Ventas',
                      data: counts,
                      backgroundColor: 'rgba(16,185,129,0.7)',
                      borderRadius: 6,
                    }]
                  }} options={{ ...chartOpts, scales: { y: { ticks: { stepSize: 1 } } } }} />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header border-0 bg-white pt-3 d-flex align-items-center gap-2">
            <span className="fw-bold">🔮 Proyección de ventas futuras</span>
            <span className="badge" style={{ background: '#ede9fe', color: '#7c3aed', fontSize: 11 }}>
              Basada en regresión lineal del historial
            </span>
          </div>
          <div className="card-body" style={{ maxHeight: 260 }}>
            {totals.length < 2 ? (
              <div className="text-center text-muted py-4">Se necesitan al menos 2 períodos de datos para proyectar</div>
            ) : (
              <Line data={{
                labels: projLabels,
                datasets: [
                  {
                    label: 'Ventas reales',
                    data: [...totals, null, null, null],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                  },
                  {
                    label: 'Proyección',
                    data: proyected,
                    borderColor: '#f59e0b',
                    borderDash: [6, 3],
                    backgroundColor: 'rgba(245,158,11,0.06)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                  },
                ]
              }} options={{
                responsive: true,
                plugins: { legend: { display: true, position: 'top' } },
                scales: { y: { ticks: { callback: v => fmt(v) } } }
              }} />
            )}
          </div>
        </div>

        <div className="row g-4 mb-4">
          {/* Top 10 más vendidos — CON GRAMAJE */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header border-0 bg-white pt-3">
                <span className="fw-bold">🏆 Top 10 productos más vendidos</span>
              </div>
              <div className="card-body p-0">
                <table className="table table-hover mb-0 align-middle">
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>#</th>
                      <th style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>Producto</th>
                      <th style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }} className="text-end">Unidades</th>
                      <th style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }} className="text-end">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.length === 0
                      ? <tr><td colSpan={4} className="text-center text-muted py-3">Sin datos</td></tr>
                      : top10.map((p, i) => (
                        <tr key={i}>
                          <td style={{ padding: '9px 14px', fontSize: 14 }}>
                            {['🥇','🥈','🥉'][i] || <span className="text-muted">{i+1}</span>}
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: '9px 14px', fontSize: 13 }} className="text-end">
                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                              {p.qty.toFixed(0)} und.
                            </span>
                          </td>
                          <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600 }} className="text-end text-success">
                            {fmt(p.revenue)}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom 10 menos vendidos — CON GRAMAJE */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header border-0 bg-white pt-3">
                <span className="fw-bold">⚠️ Productos que menos se venden</span>
              </div>
              <div className="card-body p-0">
                <table className="table table-hover mb-0 align-middle">
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }}>Producto</th>
                      <th style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }} className="text-center">Unidades</th>
                      <th style={{ padding: '10px 14px', fontSize: 11, color: '#64748b' }} className="text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottom10.length === 0 && sinVentas.length === 0
                      ? <tr><td colSpan={3} className="text-center text-muted py-3">Sin datos</td></tr>
                      : <>
                        {bottom10.map((p, i) => (
                          <tr key={`b-${i}`}>
                            <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500 }}>{p.name}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12 }} className="text-center">
                              <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                                {p.qty.toFixed(0)} und.
                              </span>
                            </td>
                            <td className="text-center" style={{ padding: '9px 14px' }}>
                              <span style={{ background: '#fef9c3', color: '#854d0e', fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>🐢 Lento</span>
                            </td>
                          </tr>
                        ))}
                        {sinVentas.slice(0, 5).map((p, i) => (
                          <tr key={`nv-${i}`} style={{ background: '#fff5f5' }}>
                            <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500 }}>{dname(p)}</td>
                            <td style={{ padding: '9px 14px', fontSize: 12 }} className="text-center">
                              <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>0 und.</span>
                            </td>
                            <td className="text-center" style={{ padding: '9px 14px' }}>
                              <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>❌ Sin ventas</span>
                            </td>
                          </tr>
                        ))}
                      </>
                    }
                  </tbody>
                </table>
                {sinVentas.length > 5 && (
                  <div className="text-center text-muted py-2" style={{ fontSize: 12 }}>
                    + {sinVentas.length - 5} productos más sin ninguna venta
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla completa productos sin ninguna venta */}
        <div className="card border-0 shadow-sm">
          <div className="card-header border-0 bg-white pt-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold">🚫 Productos sin ninguna venta</span>
              <span className="badge bg-danger" style={{ fontSize: 11 }}>{sinVentasDetalle.length}</span>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <input
                className="form-control form-control-sm"
                style={{ width: 200 }}
                placeholder="🔍 Buscar producto..."
                value={sinSearch}
                onChange={e => setSinSearch(e.target.value)}
              />
              <select
                className="form-select form-select-sm"
                style={{ width: 180 }}
                value={sinCatFilter}
                onChange={e => setSinCatFilter(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="px-3 pt-2 pb-1 d-flex gap-2 flex-wrap border-bottom">
            {[
              { bg: '#fee2e2', c: '#991b1b', lb: '🔴 +90 días sin venderse' },
              { bg: '#ffedd5', c: '#9a3412', lb: '🟠 +30 días' },
              { bg: '#fef9c3', c: '#854d0e', lb: '🟡 +7 días' },
              { bg: '#f1f5f9', c: '#64748b', lb: '⚪ Reciente (< 7 días)' },
            ].map((l, i) => (
              <span key={i} style={{ background: l.bg, color: l.c, fontSize: 11, padding: '2px 10px', borderRadius: 99, fontWeight: 600 }}>
                {l.lb}
              </span>
            ))}
          </div>

          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: 13 }}>
                <thead style={{ background: '#f1f5f9' }}>
                  <tr>
                    <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Producto</th>
                    <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Categoría</th>
                    <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Stock actual</th>
                    <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Precio</th>
                    <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'center' }}>Días sin venderse</th>
                    <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Urgencia</th>
                    <th style={{ padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Recomendación</th>
                  </tr>
                </thead>
                <tbody>
                  {sinVentasDetalle.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-5">
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
                        <div className="fw-semibold text-success">¡Todos los productos activos tienen al menos una venta!</div>
                      </td>
                    </tr>
                  ) : sinVentasDetalle.map(p => {
                    const tag = urgenciaTag(p.diasSinVenta);
                    const rowBg = p.diasSinVenta >= 90 ? '#fff5f5'
                                : p.diasSinVenta >= 30 ? '#fff8f5'
                                : p.diasSinVenta >= 7  ? '#fffef0'
                                : '';
                    const recomendacion = p.diasSinVenta === null  ? '—'
                                        : p.diasSinVenta >= 90    ? '🛑 Considerar descontinuar'
                                        : p.diasSinVenta >= 30    ? '📢 Aplicar descuento o promoción'
                                        : p.diasSinVenta >= 7     ? '👀 Monitorear'
                                        : '✅ Producto nuevo';
                    return (
                      <tr key={p.id} style={{ background: rowBg }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                          {dname(p)}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                          {p.category || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{
                            background: p.stock === 0 ? '#fee2e2' : p.stock <= 5 ? '#fef9c3' : '#dcfce7',
                            color:      p.stock === 0 ? '#991b1b' : p.stock <= 5 ? '#854d0e' : '#166534',
                            fontWeight: 700, fontSize: 12, padding: '2px 10px', borderRadius: 99
                          }}>
                            {p.stock}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#059669' }}>
                          {fmt(p.price)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>
                          {p.diasSinVenta !== null
                            ? <span style={{ fontSize: 15 }}>{p.diasSinVenta}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: tag.bg, color: tag.c, fontSize: 11, padding: '3px 9px', borderRadius: 99, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {tag.lb}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>
                          {recomendacion}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sinVentasDetalle.length > 0 && (
              <div className="px-3 py-2 border-top" style={{ fontSize: 11, color: '#64748b', background: '#f8fafc' }}>
                💡 Los días se cuentan desde que el producto fue creado en el sistema.
                Usa Promociones o descuentos para impulsar los productos con mayor urgencia.
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default SalesAnalysis;