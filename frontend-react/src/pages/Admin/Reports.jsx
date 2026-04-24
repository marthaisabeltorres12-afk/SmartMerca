import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

import { saleService } from '../../services/saleService';
import { productService } from '../../services/productService';
import { inventoryService } from '../../services/inventoryService';
import { exportVentasPDF, exportVentasExcel } from '../../services/exportService';

// Muestra gramaje junto al nombre si existe
const dname = (p) => {
  if (!p) return '';
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const q = parseFloat(p.gramaje_cantidad);
    return `${p.name} · ${q === Math.floor(q) ? Math.floor(q) : q} ${p.gramaje_unidad}`;
  }
  return p.display_name || p.name;
};


const fmtMoney = n => Number(n || 0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });

const PAGO_LABEL = { efectivo:'💵 Efectivo', tarjeta:'💳 Tarjeta', nequi:'📱 Nequi', transferencia:'🏦 Transferencia', credito:'📒 Crédito' };

const Reports = () => {
  const { token } = useAuth();

  // ── Datos generales ──────────────────────────────────────────────────────
  const [sales,     setSales]     = useState([]);
  const [products,  setProducts]  = useState([]);
  const [movements, setMovements] = useState([]);
  const [byCashier, setByCashier] = useState([]);
  const [tab,       setTab]       = useState('diarias');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [expandedCashier, setExpandedCashier] = useState(null);

  // ── Filtros pestaña Por Producto ─────────────────────────────────────────
  const [prodQuery,  setProdQuery]  = useState('');  // nombre O código de barras
  const [prodCat,    setProdCat]    = useState('');
  const [prodCajero, setProdCajero] = useState('');
  const [prodPago,   setProdPago]   = useState('');
  const [prodSort,   setProdSort]   = useState('fecha_desc');
  const [prodPage,   setProdPage]   = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => {
    Promise.all([
      saleService.getAll(token),
      productService.getAll(token),
      saleService.getByCashierDetail(token),
      inventoryService.getAll(token),
    ]).then(([s, p, bc, mv]) => {
      setSales(s); setProducts(p); setByCashier(bc); setMovements(mv);
    }).catch(console.error);
  }, [token]);

  const today   = new Date().toISOString().slice(0, 10);
  const in7days = (() => { const d = new Date(); d.setDate(d.getDate()+7);  return d.toISOString().slice(0,10); })();
  const in30d   = (() => { const d = new Date(); d.setDate(d.getDate()+30); return d.toISOString().slice(0,10); })();

  const filtered = sales.filter(s => {
    const d = s.created_at?.slice(0,10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  });

  // Función para obtener nombre con gramaje de un item de venta
  const itemDname = (item) => {
    const p = products.find(x =>
      x.id === item.product_id ||
      x.name === item.product ||
      x.name === item.product_name
    );
    return p ? dname(p) : (item.product || item.product_name || '—');
  };

  const soldMap = {};
  filtered.forEach(s => s.items?.forEach(i => {
    const key = itemDname(i);
    soldMap[key] = (soldMap[key] || 0) + i.quantity;
  }));
  const topProducts = Object.entries(soldMap).sort((a,b) => b[1]-a[1]).slice(0,10);

  const dailyMap = {};
  filtered.forEach(s => {
    const d = s.created_at?.slice(0,10);
    if (!dailyMap[d]) dailyMap[d] = { count:0, total:0 };
    dailyMap[d].count++;
    dailyMap[d].total += parseFloat(s.total);
  });

  const mensualMap = {};
  filtered.forEach(s => {
    const m = s.created_at?.slice(0,7);
    if (!mensualMap[m]) mensualMap[m] = { count:0, total:0 };
    mensualMap[m].count++;
    mensualMap[m].total += parseFloat(s.total);
  });

  const lowStock   = products.filter(p => p.stock <= (p.min_stock ?? 5));
  const totalRev   = filtered.reduce((a,s) => a + parseFloat(s.total), 0);
  const vencidos   = products.filter(p => p.expiry_date && p.expiry_date < today);
  const vence7     = products.filter(p => p.expiry_date && p.expiry_date >= today && p.expiry_date <= in7days);
  const vence30    = products.filter(p => p.expiry_date && p.expiry_date > in7days && p.expiry_date <= in30d);
  const totalVenc  = vencidos.length + vence7.length + vence30.length;

  const expiryBadge = exp => {
    if (!exp)          return <span className="badge bg-secondary">Sin fecha</span>;
    if (exp < today)   return <span className="badge bg-danger">Vencido</span>;
    if (exp <= in7days) return <span className="badge bg-danger">Vence pronto</span>;
    if (exp <= in30d)   return <span className="badge bg-warning text-dark">Vence en 30 días</span>;
    return               <span className="badge bg-success">Vigente</span>;
  };

  const stockColor = p => {
    const t = p.min_stock ?? 5;
    if (p.stock === 0)   return 'bg-danger';
    if (p.stock <= t)    return 'bg-danger';
    if (p.stock <= t*2)  return 'bg-warning text-dark';
    return 'bg-secondary';
  };

  // ── Reporte por producto — filas expandidas ──────────────────────────────
  // Cada item de venta = una fila con todos los datos del contexto
  // CATEGORÍA y LÍNEA se tratan como lo mismo: se usa category del producto
  const allRows = useMemo(() => {
    const rows = [];
    filtered.forEach(sale => {
      sale.items?.forEach(item => {
        // Busca el producto por id o por nombre para obtener metadatos
        const meta = products.find(p =>
          p.id === item.product_id ||
          p.name === item.product ||
          p.name === item.product_name
        );
        rows.push({
          // Datos del ítem
          product_id:   item.product_id,
          producto:     itemDname(item),
          barcode:      meta?.barcode || item.barcode || '',
          cantidad:     item.quantity,
          precio_unit:  parseFloat(item.price)    || 0,
          subtotal:     parseFloat(item.subtotal) || 0,
          // Contexto de la venta
          fecha:        sale.created_at || '',
          fecha_date:   (sale.created_at || '').slice(0,10),
          hora:         (sale.created_at || '').slice(11,16),
          cajero:       sale.cashier || '—',
          pago:         sale.payment_method || 'efectivo',
          cliente:      sale.customer?.name || sale.customer?.full_name || 'Consumidor Final',
          // Metadatos del producto
          // NOTA: línea y categoría son lo mismo — se muestra como "Categoría"
          categoria:    meta?.category || meta?.line_name || item.category || '—',
        });
      });
    });
    return rows;
  }, [filtered, products]);

  // Opciones únicas para filtros
  const opcionesCats    = useMemo(() => [...new Set(allRows.map(r => r.categoria).filter(v => v !== '—'))].sort(), [allRows]);
  const opcionesCajeros = useMemo(() => [...new Set(allRows.map(r => r.cajero).filter(v => v !== '—'))].sort(), [allRows]);
  const opcionesPagos   = useMemo(() => [...new Set(allRows.map(r => r.pago))].sort(), [allRows]);

  const prodFiltered = useMemo(() => {
    let rows = [...allRows];

    // Búsqueda unificada: nombre O código de barras
    if (prodQuery.trim()) {
      const q = prodQuery.trim().toLowerCase();
      rows = rows.filter(r =>
        r.producto.toLowerCase().includes(q) ||
        (r.barcode && r.barcode.toLowerCase().includes(q))
      );
    }

    if (prodCat)    rows = rows.filter(r => r.categoria === prodCat);
    if (prodCajero) rows = rows.filter(r => r.cajero    === prodCajero);
    if (prodPago)   rows = rows.filter(r => r.pago      === prodPago);

    rows.sort((a,b) => {
      if (prodSort === 'fecha_desc')    return b.fecha.localeCompare(a.fecha);
      if (prodSort === 'fecha_asc')     return a.fecha.localeCompare(b.fecha);
      if (prodSort === 'producto_az')   return a.producto.localeCompare(b.producto);
      if (prodSort === 'cantidad_desc') return b.cantidad - a.cantidad;
      if (prodSort === 'subtotal_desc') return b.subtotal - a.subtotal;
      return 0;
    });
    return rows;
  }, [allRows, prodQuery, prodCat, prodCajero, prodPago, prodSort]);

  const prodTotalQty   = prodFiltered.reduce((a,r) => a + r.cantidad,  0);
  const prodTotalMonto = prodFiltered.reduce((a,r) => a + r.subtotal,  0);
  const prodTotalPages = Math.max(1, Math.ceil(prodFiltered.length / PAGE_SIZE));
  const prodPageRows   = prodFiltered.slice((prodPage-1)*PAGE_SIZE, prodPage*PAGE_SIZE);

  const limpiarFiltrosProd = () => {
    setProdQuery(''); setProdCat(''); setProdCajero(''); setProdPago('');
    setProdSort('fecha_desc'); setProdPage(1);
  };

  const exportProdCSV = () => {
    const headers = ['Producto','Código','Cantidad','Precio unit.','Subtotal','Cajero','Cliente','Fecha','Hora','Pago','Categoría'];
    const rows    = prodFiltered.map(r => [
      r.producto, r.barcode, r.cantidad, r.precio_unit, r.subtotal,
      r.cajero, r.cliente, r.fecha_date, r.hora, r.pago, r.categoria,
    ]);
    const csv  = [headers, ...rows].map(r => r.map(c => '"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='reporte_productos.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    ['diarias',    '📅 Diarias'],
    ['mensual',    '📆 Mensual'],
    ['financiero', '💹 Rentabilidad'],
    ['top',        '📈 Más Vendidos'],
    ['productos',  '📋 Por Producto'],
    ['proveedores','🚚 Proveedores'],
    ['stock',      '⚠️ Stock'],
    ['vencidos',   '📅 Vencimientos'],
    ['cajeros',    '💰 Por Cajero'],
  ];

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <h4 className="fw-bold mb-4">📊 Reportes</h4>

        {/* Filtro global de fechas con atajos de período */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="row g-2 align-items-end">
              {/* Atajos rápidos */}
              <div className="col-12 mb-1">
                <div className="d-flex gap-1 flex-wrap">
                  <span className="text-muted small me-1 align-self-center">Período:</span>
                  {[
                    ['hoy',       'Hoy'],
                    ['ayer',      'Ayer'],
                    ['semana',    'Esta semana'],
                    ['mes',       'Este mes'],
                    ['mes_ant',   'Mes pasado'],
                    ['trimestre', 'Trimestre'],
                  ].map(([key, label]) => (
                    <button key={key} className="btn btn-sm btn-outline-secondary py-0"
                      onClick={() => {
                        const hoy = new Date();
                        const fmt = d => d.toISOString().slice(0,10);
                        if (key === 'hoy') {
                          setDateFrom(fmt(hoy)); setDateTo(fmt(hoy));
                        } else if (key === 'ayer') {
                          const ay = new Date(hoy); ay.setDate(ay.getDate()-1);
                          setDateFrom(fmt(ay)); setDateTo(fmt(ay));
                        } else if (key === 'semana') {
                          const lun = new Date(hoy); lun.setDate(hoy.getDate() - hoy.getDay() + 1);
                          setDateFrom(fmt(lun)); setDateTo(fmt(hoy));
                        } else if (key === 'mes') {
                          setDateFrom(fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
                          setDateTo(fmt(hoy));
                        } else if (key === 'mes_ant') {
                          const ini = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1);
                          const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
                          setDateFrom(fmt(ini)); setDateTo(fmt(fin));
                        } else if (key === 'trimestre') {
                          const ini = new Date(hoy.getFullYear(), hoy.getMonth()-2, 1);
                          setDateFrom(fmt(ini)); setDateTo(fmt(hoy));
                        }
                      }}>
                      {label}
                    </button>
                  ))}
                  <button className="btn btn-sm btn-outline-danger py-0"
                    onClick={() => { setDateFrom(''); setDateTo(''); }}>✕ Limpiar</button>
                </div>
              </div>
              {/* Fechas manuales */}
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Desde</label>
                <input type="date" className="form-control" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold">Hasta</label>
                <input type="date" className="form-control" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              {dateFrom && <div className="col-auto align-self-end">
                <span className="badge bg-primary py-2">{dateFrom} → {dateTo || 'hoy'} · {filtered.length} ventas</span>
              </div>}
              <div className="col-auto align-self-end d-flex gap-2">
                <button className="btn btn-danger"  onClick={() => exportVentasPDF(filtered, dateFrom, dateTo)}   disabled={!filtered.length}>📄 PDF</button>
                <button className="btn btn-success" onClick={() => exportVentasExcel(filtered, dateFrom, dateTo)} disabled={!filtered.length}>📊 Excel</button>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { icon:'🧾', value: filtered.length,       label:'Total Ventas',         color:'primary' },
            { icon:'💰', value: fmtMoney(totalRev),    label:'Ingresos totales',     color:'success' },
            { icon:'⚠️', value: lowStock.length,       label:'Stock bajo',           color:'warning' },
            { icon:'📅', value: totalVenc,             label:'Vencidos/Por vencer',  color:'danger'  },
          ].map((s,i) => (
            <div key={i} className="col-md-3">
              <div className={`card border-${s.color} border-2`}>
                <div className="card-body d-flex align-items-center gap-3">
                  <span style={{ fontSize:'1.8rem' }}>{s.icon}</span>
                  <div>
                    <div className={`fs-4 fw-bold text-${s.color}`}>{s.value}</div>
                    <div className="text-muted small">{s.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pestañas */}
        <ul className="nav nav-tabs mb-3" style={{ flexWrap:'nowrap', overflowX:'auto' }}>
          {TABS.map(([k,l]) => (
            <li key={k} className="nav-item">
              <button className={`nav-link text-nowrap ${tab===k?'active':''}`} onClick={() => setTab(k)}>
                {l}
                {k==='vencidos' && totalVenc>0 && <span className="badge bg-danger ms-1">{totalVenc}</span>}
                {k==='stock'    && lowStock.length>0 && <span className="badge bg-warning text-dark ms-1">{lowStock.length}</span>}
              </button>
            </li>
          ))}
        </ul>

        {/* ── VENTAS DIARIAS ── */}
        {tab === 'diarias' && (
          <div className="card">
            <div className="card-header fw-semibold">📅 Ventas por día</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light"><tr><th>Fecha</th><th>N° Ventas</th><th>Total</th></tr></thead>
                <tbody>
                  {!Object.keys(dailyMap).length
                    ? <tr><td colSpan="3" className="text-center text-muted py-3">Sin datos</td></tr>
                    : Object.entries(dailyMap).sort((a,b) => b[0].localeCompare(a[0])).map(([d,v]) => (
                      <tr key={d}>
                        <td>{d}</td>
                        <td><span className="badge bg-primary">{v.count}</span></td>
                        <td className="text-success fw-bold">{fmtMoney(v.total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MENSUAL ── */}
        {tab === 'mensual' && (
          <div className="card">
            <div className="card-header fw-semibold">📆 Ventas por mes</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light"><tr><th>Mes</th><th>Ventas</th><th>Total</th></tr></thead>
                <tbody>
                  {!Object.keys(mensualMap).length
                    ? <tr><td colSpan="3" className="text-center text-muted py-3">Sin datos</td></tr>
                    : Object.entries(mensualMap).sort((a,b) => b[0].localeCompare(a[0])).map(([m,v]) => (
                      <tr key={m}>
                        <td>{m}</td>
                        <td><span className="badge bg-primary">{v.count}</span></td>
                        <td className="text-success fw-bold">{fmtMoney(v.total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── RENTABILIDAD ── */}
        {tab === 'financiero' && (() => {
          const mesActual = new Date().toISOString().slice(0,7);
          const meses = {};
          movements.filter(m => m.type==='entrada' && m.total_cost).forEach(m => {
            const mes = m.created_at?.slice(0,7);
            if (!meses[mes]) meses[mes] = { inversion:0, ventas:0 };
            meses[mes].inversion += m.total_cost;
          });
          sales.forEach(s => {
            const mes = s.created_at?.slice(0,7);
            if (!meses[mes]) meses[mes] = { inversion:0, ventas:0 };
            meses[mes].ventas += parseFloat(s.total);
          });
          const filas   = Object.entries(meses).sort((a,b) => b[0].localeCompare(a[0]));
          const actual  = meses[mesActual] || { inversion:0, ventas:0 };
          const ganAct  = actual.ventas - actual.inversion;
          return (
            <div className="d-flex flex-column gap-3">
              <div className="row g-3">
                {[
                  { icon:'📦', label:'Inversión del mes',  value: actual.inversion, color:'danger'  },
                  { icon:'💰', label:'Ventas del mes',     value: actual.ventas,    color:'success' },
                  { icon:'📈', label:'Ganancia del mes',   value: ganAct,           color: ganAct>=0?'success':'danger' },
                ].map((k,i) => (
                  <div key={i} className="col-md-4">
                    <div className={`card border-${k.color} border-2`}>
                      <div className="card-body d-flex align-items-center gap-3">
                        <span style={{ fontSize:'2rem' }}>{k.icon}</span>
                        <div>
                          <div className={`fs-4 fw-bold text-${k.color}`}>{fmtMoney(k.value)}</div>
                          <div className="text-muted small">{k.label} ({mesActual})</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-header fw-semibold">Inversión, Ventas y Ganancias por Mes</div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr><th>Mes</th><th className="text-end text-danger">Inversión</th><th className="text-end text-success">Ventas</th><th className="text-end">Ganancia</th><th className="text-center">Margen</th></tr>
                    </thead>
                    <tbody>
                      {!filas.length
                        ? <tr><td colSpan="5" className="text-center text-muted py-3">Sin datos</td></tr>
                        : filas.map(([mes,v]) => {
                          const gan    = v.ventas - v.inversion;
                          const margen = v.ventas > 0 ? ((gan/v.ventas)*100).toFixed(1) : 0;
                          return (
                            <tr key={mes} style={{ background: mes===mesActual?'#f0fff4':'' }}>
                              <td className="fw-semibold">{mes}{mes===mesActual && <span className="badge bg-primary ms-2">Actual</span>}</td>
                              <td className="text-end text-danger fw-semibold">{fmtMoney(v.inversion)}</td>
                              <td className="text-end text-success fw-semibold">{fmtMoney(v.ventas)}</td>
                              <td className="text-end fw-bold"><span className={gan>=0?'text-success':'text-danger'}>{gan>=0?'+':''}{fmtMoney(gan)}</span></td>
                              <td className="text-center"><span className={`badge ${gan>=0?'bg-success':'bg-danger'}`}>{margen}%</span></td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── MÁS VENDIDOS ── */}
        {tab === 'top' && (
          <div className="card">
            <div className="card-header fw-semibold">📈 Productos más vendidos</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light"><tr><th>#</th><th>Producto</th><th>Unidades</th></tr></thead>
                <tbody>
                  {!topProducts.length
                    ? <tr><td colSpan="3" className="text-center text-muted py-3">Sin datos</td></tr>
                    : topProducts.map(([name,qty],i) => (
                      <tr key={name}>
                        <td>{i===0?'🥇':i===1?'🥈':i===2?'🥉':<span className="badge bg-secondary">{i+1}</span>}</td>
                        <td className="fw-semibold">{name}</td>
                        <td><span className="badge bg-success">{qty}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 📋 POR PRODUCTO ── */}
        {tab === 'productos' && (
          <div>
            {/* Filtros */}
            <div className="card mb-3">
              <div className="card-body">
                <div className="row g-2 align-items-end">

                  {/* Búsqueda unificada nombre + código de barras */}
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">🔍 Nombre o código de barras</label>
                    <div className="input-group">
                      <span className="input-group-text bg-dark text-white" style={{ fontSize:12 }}>🔍</span>
                      <input className="form-control" placeholder="Escribe nombre o escanea código..."
                        value={prodQuery}
                        onChange={e => { setProdQuery(e.target.value); setProdPage(1); }} />
                      {prodQuery && (
                        <button className="btn btn-outline-secondary btn-sm"
                          onClick={() => { setProdQuery(''); setProdPage(1); }}>✕</button>
                      )}
                    </div>
                    <div className="form-text" style={{ fontSize:10 }}>
                      Busca por nombre del producto o por código de barras
                    </div>
                  </div>

                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">📂 Categoría</label>
                    <select className="form-select" value={prodCat}
                      onChange={e => { setProdCat(e.target.value); setProdPage(1); }}>
                      <option value="">Todas</option>
                      {opcionesCats.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">👤 Cajero</label>
                    <select className="form-select" value={prodCajero}
                      onChange={e => { setProdCajero(e.target.value); setProdPage(1); }}>
                      <option value="">Todos</option>
                      {opcionesCajeros.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">💳 Pago</label>
                    <select className="form-select" value={prodPago}
                      onChange={e => { setProdPago(e.target.value); setProdPage(1); }}>
                      <option value="">Todos</option>
                      {opcionesPagos.map(p => <option key={p} value={p}>{PAGO_LABEL[p] || p}</option>)}
                    </select>
                  </div>

                  <div className="col-md-2">
                    <label className="form-label small fw-semibold">Ordenar</label>
                    <select className="form-select" value={prodSort}
                      onChange={e => { setProdSort(e.target.value); setProdPage(1); }}>
                      <option value="fecha_desc">Fecha (reciente)</option>
                      <option value="fecha_asc">Fecha (antigua)</option>
                      <option value="producto_az">Producto A-Z</option>
                      <option value="cantidad_desc">Mayor cantidad</option>
                      <option value="subtotal_desc">Mayor subtotal</option>
                    </select>
                  </div>

                  <div className="col-12 d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={limpiarFiltrosProd}>
                      Limpiar filtros
                    </button>
                    <button className="btn btn-success btn-sm" onClick={exportProdCSV} disabled={!prodFiltered.length}>
                      ⬇️ Exportar CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen del filtro */}
            <div className="d-flex gap-3 mb-3 flex-wrap align-items-center">
              <span className="text-muted small">
                <strong>{prodFiltered.length}</strong> registros
                {prodQuery  && <> · búsqueda: <strong>"{prodQuery}"</strong></>}
                {prodCat    && <> · categoría: <strong>{prodCat}</strong></>}
                {prodCajero && <> · cajero: <strong>{prodCajero}</strong></>}
                {prodPago   && <> · pago: <strong>{PAGO_LABEL[prodPago]||prodPago}</strong></>}
              </span>
              <span className="ms-auto fw-semibold text-success">{fmtMoney(prodTotalMonto)}</span>
              <span className="badge bg-primary">{prodTotalQty} uds</span>
            </div>

            {/* Tabla */}
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ fontSize:13 }}>
                  <thead className="table-light">
                    <tr>
                      <th>Producto</th>
                      <th style={{ fontFamily:'monospace', fontSize:11 }}>Código</th>
                      <th className="text-center">Cant.</th>
                      <th className="text-end">Precio/ud</th>
                      <th className="text-end">Subtotal</th>
                      <th>Cliente</th>
                      <th>Fecha y hora</th>
                      <th>Pago</th>
                      <th>Cajero</th>
                      <th>Categoría</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!prodPageRows.length ? (
                      <tr>
                        <td colSpan="10" className="text-center text-muted py-5">
                          <div className="fs-3">🔍</div>
                          <div>Sin resultados para los filtros aplicados</div>
                        </td>
                      </tr>
                    ) : prodPageRows.map((r,i) => (
                      <tr key={i}>
                        <td className="fw-semibold">{r.producto}</td>
                        <td className="text-muted" style={{ fontFamily:'monospace', fontSize:11 }}>
                          {r.barcode || <span className="text-muted">—</span>}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-secondary">{r.cantidad}</span>
                        </td>
                        <td className="text-end text-muted">{fmtMoney(r.precio_unit)}</td>
                        <td className="text-end fw-bold text-success">{fmtMoney(r.subtotal)}</td>
                        <td>
                          {r.cliente !== '—'
                            ? <span className="badge bg-light text-dark border">{r.cliente}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-muted" style={{ whiteSpace:'nowrap' }}>
                          {r.fecha_date} <span className="text-secondary" style={{ fontSize:11 }}>{r.hora}</span>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border" style={{ fontSize:11 }}>
                            {PAGO_LABEL[r.pago] || r.pago}
                          </span>
                        </td>
                        <td className="text-muted">{r.cajero}</td>
                        <td>
                          {r.categoria !== '—'
                            ? <span className="badge bg-light text-dark border" style={{ fontSize:10 }}>{r.categoria}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {prodFiltered.length > 0 && (
                    <tfoot className="table-light">
                      <tr>
                        <td colSpan="2" className="fw-bold">TOTAL</td>
                        <td className="text-center fw-bold">{prodTotalQty}</td>
                        <td></td>
                        <td className="text-end fw-bold text-success">{fmtMoney(prodTotalMonto)}</td>
                        <td colSpan="5"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Paginación */}
              {prodTotalPages > 1 && (
                <div className="card-footer d-flex justify-content-between align-items-center py-2">
                  <span className="text-muted small">
                    Página {prodPage} de {prodTotalPages} · {prodFiltered.length} registros
                  </span>
                  <div className="d-flex gap-1">
                    <button className="btn btn-sm btn-outline-secondary" disabled={prodPage===1} onClick={() => setProdPage(1)}>«</button>
                    <button className="btn btn-sm btn-outline-secondary" disabled={prodPage===1} onClick={() => setProdPage(p=>p-1)}>‹</button>
                    {Array.from({ length: Math.min(5, prodTotalPages) }, (_,i) => {
                      const start = Math.max(1, Math.min(prodPage-2, prodTotalPages-4));
                      const page  = start + i;
                      return page <= prodTotalPages ? (
                        <button key={page}
                          className={`btn btn-sm ${prodPage===page?'btn-dark':'btn-outline-secondary'}`}
                          onClick={() => setProdPage(page)}>{page}</button>
                      ) : null;
                    })}
                    <button className="btn btn-sm btn-outline-secondary" disabled={prodPage===prodTotalPages} onClick={() => setProdPage(p=>p+1)}>›</button>
                    <button className="btn btn-sm btn-outline-secondary" disabled={prodPage===prodTotalPages} onClick={() => setProdPage(prodTotalPages)}>»</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PROVEEDORES ── */}
        {tab === 'proveedores' && (() => {
          const supplierMap = {};
          filtered.forEach(sale => {
            sale.items?.forEach(item => {
              const prod     = products.find(p => p.id===item.product_id || p.name===item.product);
              const suppName = prod?.supplier || '—';
              if (!supplierMap[suppName]) supplierMap[suppName] = { ventas:0, total:0, productos:{} };
              supplierMap[suppName].ventas++;
              supplierMap[suppName].total += item.subtotal||0;
              supplierMap[suppName].productos[item.product] = (supplierMap[suppName].productos[item.product]||0)+(item.quantity||0);
            });
          });
          const ranking = Object.entries(supplierMap)
            .map(([name,v]) => ({ name, ...v, topProd: Object.entries(v.productos).sort((a,b)=>b[1]-a[1])[0] }))
            .sort((a,b) => b.total - a.total);
          const totalGen = ranking.reduce((a,r)=>a+r.total,0);
          return (
            <div className="card">
              <div className="card-header fw-semibold">🚚 Ranking de Proveedores</div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr><th>#</th><th>Proveedor</th><th className="text-end">Total</th><th>Producto estrella</th><th className="text-center">Participación</th></tr>
                  </thead>
                  <tbody>
                    {!ranking.length
                      ? <tr><td colSpan="5" className="text-center text-muted py-4">Sin datos</td></tr>
                      : ranking.map((s,i) => {
                        const pct = totalGen>0?((s.total/totalGen)*100).toFixed(1):0;
                        return (
                          <tr key={s.display_name || s.company_name || s.name} style={{ background: i===0?'#fffbeb':'' }}>
                            <td>{i===0?'🥇':i===1?'🥈':i===2?'🥉':<span className="badge bg-secondary">{i+1}</span>}</td>
                            <td className="fw-semibold">{s.display_name || s.company_name || s.name}</td>
                            <td className="text-end text-success fw-bold">{fmtMoney(s.total)}</td>
                            <td className="text-muted small">{s.topProd?`${s.topProd[0]} (${s.topProd[1]} uds)`:'—'}</td>
                            <td className="text-center">
                              <div className="d-flex align-items-center gap-2">
                                <div className="progress flex-fill" style={{ height:8 }}>
                                  <div className="progress-bar bg-success" style={{ width:`${pct}%` }} />
                                </div>
                                <span className="small">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ── STOCK BAJO ── */}
        {tab === 'stock' && (
          <div className="card">
            <div className="card-header fw-semibold">⚠️ Productos con stock bajo</div>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr><th>Producto</th><th>Categoría</th><th className="text-center">Stock</th><th className="text-center">Mínimo</th><th>Vencimiento</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {!lowStock.length
                    ? <tr><td colSpan="6" className="text-center text-muted py-3">Todo bien ✅</td></tr>
                    : lowStock.map(p => (
                      <tr key={p.id}>
                        <td className="fw-semibold">{dname(p)}</td>
                        <td>{p.category||'—'}</td>
                        <td className="text-center"><span className={`badge ${stockColor(p)}`}>{p.stock}</span></td>
                        <td className="text-center"><span className="badge bg-light text-dark border">{p.min_stock??5}</span></td>
                        <td>{p.expiry_date ? <>{p.expiry_date} {expiryBadge(p.expiry_date)}</> : <span className="text-muted">—</span>}</td>
                        <td><span className={`badge ${p.stock===0?'bg-danger':'bg-warning text-dark'}`}>{p.stock===0?'Agotado':'Bajo'}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── VENCIMIENTOS ── */}
        {tab === 'vencidos' && (
          <div className="d-flex flex-column gap-3">
            <div className="row g-3">
              {[
                { label:'Vencidos',          value:vencidos.length, color:'danger'  },
                { label:'Vencen en 7 días',  value:vence7.length,   color:'danger'  },
                { label:'Vencen en 30 días', value:vence30.length,  color:'warning' },
              ].map((s,i) => (
                <div key={i} className="col-md-4">
                  <div className={`card border-${s.color} border-2 text-center`}>
                    <div className="card-body">
                      <div className={`fs-2 fw-bold text-${s.color}`}>{s.value}</div>
                      <div className="text-muted">{s.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!totalVenc && (
              <div className="card"><div className="card-body text-center text-success py-5"><div className="fs-1">✅</div><div>Todos los productos están vigentes</div></div></div>
            )}
            {[...vencidos, ...vence7, ...vence30].length > 0 && (
              <div className="card">
                <div className="card-header fw-semibold">Detalle de productos</div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Fecha Venc.</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {[...vencidos,...vence7,...vence30].map(p => (
                        <tr key={p.id}>
                          <td className="fw-semibold">{dname(p)}</td>
                          <td>{p.category||'—'}</td>
                          <td><span className={`badge ${stockColor(p)}`}>{p.stock}</span></td>
                          <td>{p.expiry_date}</td>
                          <td>{expiryBadge(p.expiry_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── POR CAJERO ── */}
        {tab === 'cajeros' && (
          <div className="card">
            <div className="card-header fw-semibold">💰 Ventas por Cajero</div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>Cajero</th><th>Ventas</th><th>Total</th><th>Productos</th></tr></thead>
                <tbody>
                  {!byCashier.length
                    ? <tr><td colSpan="4" className="text-center text-muted py-4">Sin datos</td></tr>
                    : byCashier.map((c,i) => (
                      <React.Fragment key={i}>
                        <tr style={{ cursor:'pointer' }} onClick={() => setExpandedCashier(expandedCashier===i?null:i)}>
                          <td className="fw-semibold">👤 {c.cashier}</td>
                          <td><span className="badge bg-primary">{c.ventas}</span></td>
                          <td className="text-success fw-bold">{fmtMoney(parseFloat(c.total))}</td>
                          <td className="text-muted small">
                            {c.products?.slice(0,3).map(p=>p.product).join(', ')}
                            {c.products?.length > 3 && ` +${c.products.length-3} más`}
                            <span className="ms-2 text-primary">{expandedCashier===i?'▲':'▼'}</span>
                          </td>
                        </tr>
                        {expandedCashier===i && (
                          <tr><td colSpan="4" className="p-0">
                            <div className="bg-light px-4 py-2">
                              <table className="table table-sm mb-0">
                                <thead><tr><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
                                <tbody>
                                  {c.products?.map((p,j) => (
                                    <tr key={j}>
                                      <td>{p.product}</td>
                                      <td><span className="badge bg-secondary">{p.quantity}</span></td>
                                      <td className="text-success">{fmtMoney(p.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default Reports;