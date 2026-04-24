import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const fmt  = n => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n);
const fmtP = n => `${Number(n).toFixed(1)}%`;
const fmtN = n => Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });

// Umbrales
const MARGEN_CRITICO  = 10;
const MARGEN_BAJO     = 25;

const marginTag = (pct, hasCost) => {
  if (!hasCost)           return { lb:'⚪ Sin costo',   bg:'#f1f5f9', c:'#64748b' };
  if (pct < 0)            return { lb:'🔴 Pérdida',     bg:'#fee2e2', c:'#991b1b' };
  if (pct < MARGEN_CRITICO) return { lb:'🟠 Crítico',   bg:'#ffedd5', c:'#9a3412' };
  if (pct < MARGEN_BAJO)  return { lb:'🟡 Bajo',        bg:'#fef9c3', c:'#854d0e' };
  return                         { lb:'🟢 Saludable',   bg:'#dcfce7', c:'#166534' };
};

const stockTag = (estado) => {
  const m = {
    'Normal':  { bg:'#dcfce7', c:'#166534' },
    'Bajo':    { bg:'#fef9c3', c:'#854d0e' },
    'Crítico': { bg:'#ffedd5', c:'#9a3412' },
    'Agotado': { bg:'#fee2e2', c:'#991b1b' },
  };
  return m[estado] || { bg:'#f1f5f9', c:'#64748b' };
};

const AdvancedFinance = () => {
  const { token }                 = useAuth();
  const [data,     setData]       = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState('');
  const [catFilter,setCatFilter]  = useState('');
  const [sortBy,   setSortBy]     = useState('margen_pct');
  const [sortDir,  setSortDir]    = useState('asc');
  const [tab,      setTab]        = useState('tabla');

  useEffect(() => {
    fetch('http://localhost:5000/api/finance/', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const categories = useMemo(() => [...new Set(data.map(d => d.categoria))].sort(), [data]);

  const filtered = useMemo(() => {
    let r = data.filter(d => {
      const matchS = !search || d.producto.toLowerCase().includes(search.toLowerCase());
      const matchC = !catFilter || d.categoria === catFilter;
      return matchS && matchC;
    });
    return [...r].sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
  }, [data, search, catFilter, sortBy, sortDir]);

  const toggleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  // KPIs
  const withCost       = data.filter(d => d.has_cost);
  const totalIngresos  = data.reduce((a,d) => a + d.ingresos, 0);
  const totalCostoVend = data.reduce((a,d) => a + d.costo_vendido, 0);
  const totalGanancia  = withCost.reduce((a,d) => a + (d.ganancia_bruta * d.uds_vendidas), 0);
  const avgMargen      = withCost.length > 0 ? withCost.reduce((a,d) => a + d.margen_pct, 0) / withCost.length : 0;
  const countCritico   = data.filter(d => d.has_cost && d.margen_pct < MARGEN_CRITICO).length;
  const totalStockVal  = data.reduce((a,d) => a + d.valor_inventario, 0);

  // Gráfico top 15 margen
  const chartData = useMemo(() => {
    const src = [...withCost].sort((a,b) => b.margen_pct - a.margen_pct).slice(0,15);
    return {
      labels: src.map(d => d.producto.length > 22 ? d.producto.slice(0,20)+'…' : d.producto),
      datasets: [{
        label: 'Margen %',
        data: src.map(d => d.margen_pct),
        backgroundColor: src.map(d =>
          d.margen_pct < 0              ? 'rgba(239,68,68,0.8)'  :
          d.margen_pct < MARGEN_CRITICO ? 'rgba(249,115,22,0.8)' :
          d.margen_pct < MARGEN_BAJO    ? 'rgba(234,179,8,0.8)'  :
                                          'rgba(34,197,94,0.8)'),
        borderRadius: 5,
      }]
    };
  }, [withCost]);

  const SortIcon = ({ col }) => (
    <i className={`bi bi-chevron-${sortBy===col?(sortDir==='asc'?'up':'down'):'expand'} ms-1`}
       style={{ fontSize:9, opacity: sortBy===col?1:0.3 }}></i>
  );

  const Th = ({ col, children, className='' }) => (
    <th onClick={() => col && toggleSort(col)}
      style={{ padding:'10px 10px', fontSize:11, fontWeight:700, color:'#64748b',
               textTransform:'uppercase', whiteSpace:'nowrap',
               cursor: col?'pointer':'default', userSelect:'none' }}
      className={className}>
      {children}{col && <SortIcon col={col}/>}
    </th>
  );

  // ── NUEVO: productos con descuento activo ─────────────────────────────────
  const conDescuento = useMemo(() => {
    return data
      .filter(d => d.active_discount > 0 && d.has_cost)
      .map(d => {
        const IVA_RATE      = 0.19;
        // Precio sin descuento
        const precioNormal  = d.precio_venta;
        const sinIvaNormal  = precioNormal / (1 + IVA_RATE);
        const ganNormal     = sinIvaNormal - d.costo_promedio;
        const margenNormal  = d.costo_promedio > 0 ? (ganNormal / d.costo_promedio) * 100 : 0;

        // Precio con descuento aplicado
        const precioDesc    = precioNormal * (1 - d.active_discount / 100);
        const sinIvaDesc    = precioDesc   / (1 + IVA_RATE);
        const ganDesc       = sinIvaDesc   - d.costo_promedio;
        const margenDesc    = d.costo_promedio > 0 ? (ganDesc / d.costo_promedio) * 100 : 0;

        // Impacto total sobre lo ya vendido con descuento
        const impactoTotal  = (ganDesc - ganNormal) * d.uds_vendidas;

        return {
          ...d,
          precioNormal,
          ganNormal:    Math.round(ganNormal),
          margenNormal: Math.round(margenNormal * 10) / 10,
          precioDesc:   Math.round(precioDesc),
          ganDesc:      Math.round(ganDesc),
          margenDesc:   Math.round(margenDesc * 10) / 10,
          impactoTotal: Math.round(impactoTotal),
          diferencia:   Math.round(ganDesc - ganNormal),
        };
      })
      .sort((a, b) => a.impactoTotal - b.impactoTotal); // peor impacto primero
  }, [data]);

  const totalImpacto = conDescuento.reduce((a, d) => a + d.impactoTotal, 0);
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main style={{ marginLeft:240, padding:32 }}>
        <div className="d-flex align-items-center gap-2 text-muted">
          <div className="spinner-border spinner-border-sm"></div> Calculando finanzas...
        </div>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft:240, padding:28, background:'#f8fafc', minHeight:'100vh', width:'100%' }}>

        {/* Título */}
        <div className="mb-4">
          <h4 className="fw-bold mb-0">💰 Finanzas Avanzadas</h4>
          <small className="text-muted">Costo · IVA DIAN · Ganancia bruta · Margen por producto (IVA incluido en precio de venta)</small>
        </div>

        {/* Alerta críticos */}
        {countCritico > 0 && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 py-2">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span><strong>{countCritico} producto{countCritico>1?'s':''}</strong> con margen menor al {MARGEN_CRITICO}%.</span>
          </div>
        )}

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { icon:'bi-cash-stack',         color:'#10b981', bg:'#f0fdf4', label:'Ingresos totales',    val: fmt(totalIngresos)  },
            { icon:'bi-box-arrow-in-down',  color:'#3b82f6', bg:'#eff6ff', label:'Costo de lo vendido', val: fmt(totalCostoVend) },
            { icon:'bi-graph-up',           color:'#8b5cf6', bg:'#f5f3ff', label:'Ganancia bruta',      val: fmt(totalGanancia)  },
            { icon:'bi-percent',            color:'#f59e0b', bg:'#fffbeb', label:'Margen promedio',     val: fmtP(avgMargen)     },
            { icon:'bi-exclamation-diamond',color:'#ef4444', bg:'#fef2f2', label:'Productos críticos',  val: countCritico        },
            { icon:'bi-archive',            color:'#64748b', bg:'#f1f5f9', label:'Valor inventario',    val: fmt(totalStockVal)  },
          ].map((c,i) => (
            <div key={i} className="col-6 col-md-4 col-lg-2">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body p-3">
                  <div style={{ width:36, height:36, borderRadius:10, background:c.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                    <i className={`bi ${c.icon}`} style={{ color:c.color, fontSize:17 }}></i>
                  </div>
                  <div className="fw-bold lh-1" style={{ fontSize:15 }}>{c.val}</div>
                  <div className="text-muted mt-1" style={{ fontSize:11 }}>{c.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + filtros */}
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div className="btn-group btn-group-sm">
            <button className={`btn ${tab==='tabla'  ?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('tabla')}>📋 Tabla</button>
            <button className={`btn ${tab==='grafico'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('grafico')}>📊 Gráfico</button>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <input className="form-control form-control-sm" style={{ width:210 }}
              placeholder="🔍 Buscar producto..."
              value={search} onChange={e=>setSearch(e.target.value)} />
            <select className="form-select form-select-sm" style={{ width:180 }}
              value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-muted small align-self-center">{filtered.length} productos</span>
          </div>
        </div>

        {/* Leyenda semáforo */}
        <div className="d-flex gap-2 mb-3 flex-wrap">
          {[
            { bg:'#fee2e2', c:'#991b1b', lb:'🔴 Pérdida (< 0%)' },
            { bg:'#ffedd5', c:'#9a3412', lb:`🟠 Crítico (< ${MARGEN_CRITICO}%)` },
            { bg:'#fef9c3', c:'#854d0e', lb:`🟡 Bajo (< ${MARGEN_BAJO}%)` },
            { bg:'#dcfce7', c:'#166534', lb:'🟢 Saludable' },
            { bg:'#f1f5f9', c:'#64748b', lb:'⚪ Sin costo' },
          ].map((l,i)=>(
            <span key={i} style={{ background:l.bg, color:l.c, fontSize:11, padding:'3px 10px', borderRadius:99, fontWeight:600 }}>{l.lb}</span>
          ))}
        </div>

        {/* Gráfico */}
        {tab==='grafico' && (
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header border-0 bg-white pt-3 fw-bold">
              📊 Margen % — Top 15 productos con costo registrado
            </div>
            <div className="card-body">
              {withCost.length===0
                ? <div className="text-center text-muted py-4">Registra el costo en entradas de inventario para ver este gráfico</div>
                : <Bar data={chartData} options={{
                    responsive:true,
                    plugins:{ legend:{ display:false } },
                    scales:{ y:{ ticks:{ callback: v=>`${v}%` } }, x:{ ticks:{ font:{ size:10 } } } }
                  }}/>
              }
            </div>
          </div>
        )}

        {/* Tabla */}
        {tab==='tabla' && (
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize:12 }}>
                  <thead style={{ background:'#f1f5f9' }}>
                    <tr>
                      <Th col={null}>Producto</Th>
                      <Th col={null}>Categoría</Th>
                      <Th col="precio_venta">Precio venta</Th>
                      <Th col="costo_promedio">Costo promedio <span title="Costo promedio ponderado por cantidad" style={{cursor:'help', fontSize:11, color:'#94a3b8'}}>ⓘ</span></Th>
                      <Th col="iva_dian_unit">IVA DIAN</Th>
                      <Th col="ganancia_bruta">Ganancia bruta</Th>
                      <Th col="margen_pct">Margen %</Th>
                      <Th col="uds_vendidas" className="text-center">Uds vendidas</Th>
                      <Th col="ingresos">Ingresos</Th>
                      <Th col="costo_vendido">Costo vendido</Th>
                      <Th col="stock" className="text-center">Stock</Th>
                      <Th col="valor_inventario">Valor inventario</Th>
                      <Th col={null}>Estado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length===0 && (
                      <tr><td colSpan={13} className="text-center text-muted py-4">Sin productos</td></tr>
                    )}
                    {filtered.map(d => {
                      const mtag = marginTag(d.margen_pct, d.has_cost);
                      const stag = stockTag(d.estado);
                      const rowBg = !d.has_cost ? '' :
                        d.margen_pct < 0             ? '#fff5f5' :
                        d.margen_pct < MARGEN_CRITICO ? '#fff8f5' :
                        d.margen_pct < MARGEN_BAJO   ? '#fffef0' : '';
                      return (
                        <tr key={d.id} style={{ background:rowBg }}>
                          <td style={{ padding:'9px 10px', fontWeight:600, maxWidth:180 }}>
                            <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={d.producto}>
                              {d.producto}
                            </div>
                            {d.verificacion_ok === true && (
                              <span title="Costo + IVA + Ganancia = Precio ✅" style={{ fontSize:9, color:'#10b981' }}>✅ verificado</span>
                            )}
                          </td>
                          <td style={{ padding:'9px 10px', color:'#64748b', fontSize:11, whiteSpace:'nowrap' }}>{d.categoria}</td>
                          <td style={{ padding:'9px 10px', fontWeight:600 }}>{fmt(d.precio_venta)}</td>
                          <td style={{ padding:'9px 10px' }}>
                            {d.has_cost
                              ? <span style={{ fontWeight:600 }}>{fmt(d.costo_promedio)}</span>
                              : <span className="text-muted" style={{ fontSize:11 }}>Sin registro</span>}
                          </td>
                          <td style={{ padding:'9px 10px', color:'#7c3aed', fontWeight:600 }}>
                            {fmt(d.iva_dian_unit)}
                            <div style={{ fontSize:9, color:'#94a3b8', fontWeight:400 }}>
                              {fmt(d.precio_venta)} ÷ 1.19 × 19%
                            </div>
                          </td>
                          <td style={{ padding:'9px 10px', fontWeight:700 }}>
                            {d.has_cost
                              ? <span style={{ color: d.ganancia_bruta>=0?'#059669':'#dc2626' }}>{fmt(d.ganancia_bruta)}</span>
                              : <span className="text-muted">—</span>}
                            {d.has_cost && (
                              <div style={{ fontSize:9, color:'#94a3b8', fontWeight:400 }}>precio s/IVA − costo</div>
                            )}
                          </td>
                          <td style={{ padding:'9px 10px', fontWeight:700, textAlign:'center' }}>
                            {d.has_cost
                              ? <span style={{ color: d.margen_pct<MARGEN_CRITICO?'#dc2626':d.margen_pct<MARGEN_BAJO?'#d97706':'#059669' }}>
                                  {fmtP(d.margen_pct)}
                                </span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td style={{ padding:'9px 10px', textAlign:'center' }}>
                            <span style={{ background:'#ede9fe', color:'#6d28d9', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>
                              {fmtN(d.uds_vendidas)}
                            </span>
                          </td>
                          <td style={{ padding:'9px 10px', fontWeight:600, color:'#059669' }}>{fmt(d.ingresos)}</td>
                          <td style={{ padding:'9px 10px', color:'#dc2626' }}>
                            {d.has_cost ? fmt(d.costo_vendido) : <span className="text-muted">—</span>}
                          </td>
                          <td style={{ padding:'9px 10px', textAlign:'center', fontWeight:700 }}>{fmtN(d.stock)}</td>
                          <td style={{ padding:'9px 10px' }}>
                            {d.has_cost ? fmt(d.valor_inventario) : <span className="text-muted">—</span>}
                          </td>
                          <td style={{ padding:'9px 10px' }}>
                            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                              <span style={{ background:stag.bg, color:stag.c, fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:600, whiteSpace:'nowrap' }}>
                                {d.estado==='Agotado'?'❌':d.estado==='Crítico'?'🟠':d.estado==='Bajo'?'🟡':'🟢'} {d.estado}
                              </span>
                              <span style={{ background:mtag.bg, color:mtag.c, fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:600, whiteSpace:'nowrap' }}>
                                {mtag.lb}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-top" style={{ fontSize:11, color:'#64748b', background:'#f8fafc' }}>
                <strong>Fórmulas:</strong>
                {' '}IVA DIAN = Precio ÷ 1.19 × 19% &nbsp;|&nbsp;
                Ganancia bruta = (Precio ÷ 1.19) − Costo promedio &nbsp;|&nbsp;
                Margen % = Ganancia ÷ Costo × 100 &nbsp;|&nbsp;
                <span style={{ color:'#10b981' }}>✅ Verificación: Costo + IVA + Ganancia = Precio de venta</span>
                <br/>
                💡 El costo promedio se calcula desde las entradas de inventario con <strong>costo unitario registrado</strong>.
              </div>
            </div>
          </div>
        )}

        {/* ── NUEVO: Ganancias con descuento ────────────────────────────────── */}
        <div className="card border-0 shadow-sm">
          <div className="card-header border-0 bg-white pt-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold">🏷️ Ganancias con descuento activo</span>
              <span className="badge" style={{ background:'#ede9fe', color:'#7c3aed', fontSize:11 }}>
                {conDescuento.length} producto{conDescuento.length !== 1 ? 's' : ''}
              </span>
            </div>
            {conDescuento.length > 0 && (
              <div style={{
                background: totalImpacto < 0 ? '#fee2e2' : '#dcfce7',
                color:      totalImpacto < 0 ? '#991b1b' : '#166534',
                padding: '4px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700
              }}>
                Impacto total en ganancia: {totalImpacto >= 0 ? '+' : ''}{fmt(totalImpacto)}
              </div>
            )}
          </div>

          <div className="card-body p-0">
            {conDescuento.length === 0 ? (
              <div className="text-center text-muted py-5">
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏷️</div>
                <div className="fw-semibold">No hay productos con descuento activo y costo registrado</div>
                <div style={{ fontSize: 12 }}>Activa un descuento en un producto con costo de inventario para ver el análisis</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize: 12 }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      {[
                        'Producto',
                        'Descuento',
                        'Precio normal',
                        'Precio c/ dto.',
                        'Ganancia normal',
                        'Ganancia c/ dto.',
                        'Diferencia/ud',
                        'Uds vendidas',
                        'Impacto total',
                        'Resultado',
                      ].map(h => (
                        <th key={h} style={{ padding:'10px 10px', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {conDescuento.map(d => {
                      const perdida    = d.ganDesc < 0;
                      const menosGan   = d.ganDesc < d.ganNormal;
                      const rowBg      = perdida ? '#fff5f5' : menosGan ? '#fffef0' : '#f0fdf4';
                      const resultado  = perdida
                        ? { lb: '🔴 Vende a pérdida', bg: '#fee2e2', c: '#991b1b' }
                        : menosGan
                        ? { lb: '🟡 Gana menos',      bg: '#fef9c3', c: '#854d0e' }
                        : { lb: '🟢 Sigue ganando',   bg: '#dcfce7', c: '#166534' };

                      return (
                        <tr key={d.id} style={{ background: rowBg }}>
                          {/* Producto */}
                          <td style={{ padding:'9px 10px', fontWeight:600, maxWidth:160 }}>
                            <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={d.producto}>
                              {d.producto}
                            </div>
                          </td>

                          {/* Descuento % */}
                          <td style={{ padding:'9px 10px', textAlign:'center' }}>
                            <span style={{ background:'#fee2e2', color:'#991b1b', fontWeight:700, fontSize:12, padding:'2px 10px', borderRadius:99 }}>
                              -{d.active_discount}%
                            </span>
                          </td>

                          {/* Precio normal */}
                          <td style={{ padding:'9px 10px', color:'#64748b' }}>{fmt(d.precioNormal)}</td>

                          {/* Precio con descuento */}
                          <td style={{ padding:'9px 10px', fontWeight:700, color:'#dc2626' }}>{fmt(d.precioDesc)}</td>

                          {/* Ganancia normal (sin dto) */}
                          <td style={{ padding:'9px 10px', color:'#059669', fontWeight:600 }}>
                            {fmt(d.ganNormal)}
                            <div style={{ fontSize:9, color:'#94a3b8' }}>{fmtP(d.margenNormal)} margen</div>
                          </td>

                          {/* Ganancia con descuento */}
                          <td style={{ padding:'9px 10px', fontWeight:700, color: perdida ? '#dc2626' : '#d97706' }}>
                            {fmt(d.ganDesc)}
                            <div style={{ fontSize:9, color:'#94a3b8' }}>{fmtP(d.margenDesc)} margen</div>
                          </td>

                          {/* Diferencia por unidad */}
                          <td style={{ padding:'9px 10px', textAlign:'center' }}>
                            <span style={{
                              background: d.diferencia < 0 ? '#fee2e2' : '#f0fdf4',
                              color:      d.diferencia < 0 ? '#991b1b' : '#166534',
                              fontWeight:700, fontSize:12, padding:'2px 9px', borderRadius:99
                            }}>
                              {d.diferencia >= 0 ? '+' : ''}{fmt(d.diferencia)}
                            </span>
                          </td>

                          {/* Uds vendidas */}
                          <td style={{ padding:'9px 10px', textAlign:'center' }}>
                            <span style={{ background:'#ede9fe', color:'#6d28d9', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:700 }}>
                              {fmtN(d.uds_vendidas)}
                            </span>
                          </td>

                          {/* Impacto total en ganancia */}
                          <td style={{ padding:'9px 10px', textAlign:'center' }}>
                            <span style={{
                              background: d.impactoTotal < 0 ? '#fee2e2' : '#dcfce7',
                              color:      d.impactoTotal < 0 ? '#991b1b' : '#166534',
                              fontWeight:700, fontSize:12, padding:'2px 9px', borderRadius:99, whiteSpace:'nowrap'
                            }}>
                              {d.impactoTotal >= 0 ? '+' : ''}{fmt(d.impactoTotal)}
                            </span>
                          </td>

                          {/* Resultado */}
                          <td style={{ padding:'9px 10px' }}>
                            <span style={{ background:resultado.bg, color:resultado.c, fontSize:11, padding:'3px 9px', borderRadius:99, fontWeight:600, whiteSpace:'nowrap' }}>
                              {resultado.lb}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-3 py-2 border-top" style={{ fontSize:11, color:'#64748b', background:'#f8fafc' }}>
              <strong>Fórmulas:</strong>
              {' '}Ganancia normal = (Precio ÷ 1.19) − Costo &nbsp;|&nbsp;
              Ganancia c/dto = (Precio × (1 − dto%) ÷ 1.19) − Costo &nbsp;|&nbsp;
              Impacto total = Diferencia/ud × Uds vendidas &nbsp;|&nbsp;
              💡 Solo muestra productos con descuento activo hoy y costo registrado en inventario.
            </div>
          </div>
        </div>
        {/* ── FIN NUEVO ─────────────────────────────────────────────────────── */}

      </main>
    </div>
  );
};

export default AdvancedFinance;