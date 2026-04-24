import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

import { saleService } from '../../services/saleService';
import { productService } from '../../services/productService';

// Muestra gramaje junto al nombre si existe
const dname = (p) => {
  if (!p) return '';
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const q = parseFloat(p.gramaje_cantidad);
    return `${p.name} · ${q === Math.floor(q) ? Math.floor(q) : q} ${p.gramaje_unidad}`;
  }
  return p.display_name || p.name;
};


const fmt = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });

const PAGO_COLOR = {
  efectivo: '#22c55e', tarjeta: '#3b82f6', nequi: '#8b5cf6',
  transferencia: '#f59e0b', credito: '#ef4444',
};

const LineDashboard = () => {
  const { categoria } = useParams();        // URL-encoded category name
  const lineName      = decodeURIComponent(categoria);
  const { token }     = useAuth();

  const [sales,    setSales]    = useState([]);
  const [products, setProducts] = useState([]);
  const [period,   setPeriod]   = useState('mes'); // hoy | semana | mes

  useEffect(() => {
    Promise.all([saleService.getAll(token), productService.getAll(token)])
      .then(([s, p]) => { setSales(s); setProducts(p); })
      .catch(console.error);
  }, [token]);

  // Filtrar ventas por periodo
  const now      = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

  const periodSales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.created_at);
      if (period === 'hoy')   return s.created_at?.slice(0,10) === todayStr;
      if (period === 'semana') return d >= weekAgo;
      return d >= monthAgo;
    });
  }, [sales, period, todayStr]);

  // Solo ítems de esta categoría
  const lineItems = useMemo(() => {
    const rows = [];
    periodSales.forEach(sale => {
      sale.items?.forEach(item => {
        const meta = products.find(p =>
          p.id === item.product_id || p.name === item.product
        );
        if ((meta?.category || '') === lineName) {
          rows.push({ ...item, sale, cajero: sale.cashier, pago: sale.payment_method, customer: sale.customer });
        }
      });
    });
    return rows;
  }, [periodSales, products, lineName]);

  // KPIs
  const totalVentas  = new Set(lineItems.map(i => i.sale?.id)).size;
  const totalMonto   = lineItems.reduce((a, i) => a + parseFloat(i.subtotal||0), 0);
  const totalUnidades = lineItems.reduce((a, i) => a + parseFloat(i.quantity||0), 0);

  // Top productos
  const topMap = {};
  lineItems.forEach(i => {
    // Usar dname buscando el producto por id para incluir gramaje
    const prod = products.find(p => p.id === i.product_id || p.name === i.product);
    const key  = prod ? dname(prod) : (i.product || '—');
    if (!topMap[key]) topMap[key] = { qty:0, monto:0 };
    topMap[key].qty   += parseFloat(i.quantity||0);
    topMap[key].monto += parseFloat(i.subtotal||0);
  });
  const topProductos = Object.entries(topMap).sort((a,b) => b[1].monto - a[1].monto).slice(0,8);

  // Por cajero
  const cajeroMap = {};
  lineItems.forEach(i => {
    const c = i.cajero || '—';
    if (!cajeroMap[c]) cajeroMap[c] = { qty:0, monto:0 };
    cajeroMap[c].qty   += parseFloat(i.quantity||0);
    cajeroMap[c].monto += parseFloat(i.subtotal||0);
  });
  const topCajeros = Object.entries(cajeroMap).sort((a,b) => b[1].monto - a[1].monto);

  // Por método de pago
  const pagoMap = {};
  lineItems.forEach(i => {
    const p = i.pago || 'efectivo';
    if (!pagoMap[p]) pagoMap[p] = 0;
    pagoMap[p] += parseFloat(i.subtotal||0);
  });

  // Clientes frecuentes
  const clienteMap = {};
  lineItems.forEach(i => {
    const name = i.customer?.full_name || i.customer?.name || '—';
    if (name === '—') return;
    if (!clienteMap[name]) clienteMap[name] = { compras:0, monto:0 };
    clienteMap[name].compras++;
    clienteMap[name].monto += parseFloat(i.subtotal||0);
  });
  const topClientes = Object.entries(clienteMap).sort((a,b) => b[1].monto - a[1].monto).slice(0,5);

  // Stock de esta línea
  const lineProducts = products.filter(p => (p.category||'') === lineName);

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>

        {/* Header */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <Link to="/admin/lineas" className="btn btn-outline-secondary btn-sm">← Volver</Link>
          <div>
            <h4 className="fw-bold mb-0">{lineName}</h4>
            <span className="text-muted small">{lineProducts.length} productos en esta categoría</span>
          </div>
          <div className="ms-auto d-flex gap-2">
            {[['hoy','Hoy'],['semana','7 días'],['mes','30 días']].map(([v,l]) => (
              <button key={v}
                className={'btn btn-sm ' + (period===v ? 'btn-dark' : 'btn-outline-secondary')}
                onClick={() => setPeriod(v)}>{l}</button>
            ))}
          </div>
        </div>

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { icon:'🧾', value: totalVentas,         label:'Ventas con esta categoría', color:'primary' },
            { icon:'💰', value: fmt(totalMonto),      label:'Ingresos del período',      color:'success' },
            { icon:'📦', value: Math.round(totalUnidades), label:'Unidades vendidas',   color:'info'    },
            { icon:'📋', value: lineProducts.length,  label:'Productos activos',        color:'secondary'},
          ].map((k,i) => (
            <div key={i} className="col-md-3">
              <div className={`card border-${k.color} border-2`}>
                <div className="card-body d-flex align-items-center gap-3">
                  <span style={{ fontSize:'1.8rem' }}>{k.icon}</span>
                  <div>
                    <div className={`fs-4 fw-bold text-${k.color}`}>{k.value}</div>
                    <div className="text-muted small">{k.label}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {lineItems.length === 0 ? (
          <div className="card text-center py-5 text-muted">
            <div className="fs-2 mb-2">📭</div>
            <div>Sin ventas en este período para <strong>{lineName}</strong></div>
          </div>
        ) : (
          <div className="row g-4">

            {/* Top productos */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header fw-semibold">📈 Productos más vendidos</div>
                <div className="card-body p-0">
                  <table className="table table-hover mb-0" style={{ fontSize:13 }}>
                    <thead className="table-light">
                      <tr><th>#</th><th>Producto</th><th className="text-center">Uds</th><th className="text-end">Monto</th></tr>
                    </thead>
                    <tbody>
                      {topProductos.map(([name,v],i) => (
                        <tr key={name}>
                          <td>{i===0?'🥇':i===1?'🥈':i===2?'🥉':<span className="badge bg-secondary">{i+1}</span>}</td>
                          <td className="fw-semibold">{name}</td>
                          <td className="text-center"><span className="badge bg-secondary">{Math.round(v.qty)}</span></td>
                          <td className="text-end text-success fw-semibold">{fmt(v.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Desglose por pago */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header fw-semibold">💳 Desglose por método de pago</div>
                <div className="card-body">
                  {Object.entries(pagoMap).sort((a,b)=>b[1]-a[1]).map(([pago,monto]) => {
                    const pct = totalMonto > 0 ? ((monto/totalMonto)*100).toFixed(1) : 0;
                    return (
                      <div key={pago} className="mb-3">
                        <div className="d-flex justify-content-between mb-1" style={{ fontSize:13 }}>
                          <span className="fw-semibold">{pago}</span>
                          <span className="text-muted">{fmt(monto)} · {pct}%</span>
                        </div>
                        <div className="progress" style={{ height:10 }}>
                          <div className="progress-bar" style={{ width:`${pct}%`, background: PAGO_COLOR[pago]||'#6b7280' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cajeros */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">👤 Cajeros que vendieron esta categoría</div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0" style={{ fontSize:13 }}>
                    <thead className="table-light">
                      <tr><th>Cajero</th><th className="text-center">Uds</th><th className="text-end">Monto</th></tr>
                    </thead>
                    <tbody>
                      {topCajeros.map(([cajero,v]) => (
                        <tr key={cajero}>
                          <td className="fw-semibold">👤 {cajero}</td>
                          <td className="text-center"><span className="badge bg-secondary">{Math.round(v.qty)}</span></td>
                          <td className="text-end text-success fw-semibold">{fmt(v.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Clientes frecuentes */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">⭐ Clientes frecuentes en esta categoría</div>
                {!topClientes.length ? (
                  <div className="card-body text-muted small">Sin ventas con cliente registrado</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0" style={{ fontSize:13 }}>
                      <thead className="table-light">
                        <tr><th>#</th><th>Cliente</th><th className="text-center">Compras</th><th className="text-end">Monto</th></tr>
                      </thead>
                      <tbody>
                        {topClientes.map(([nombre,v],i) => (
                          <tr key={nombre}>
                            <td>{i===0?'🥇':i===1?'🥈':i===2?'🥉':<span className="badge bg-secondary">{i+1}</span>}</td>
                            <td className="fw-semibold">{nombre}</td>
                            <td className="text-center"><span className="badge bg-primary">{v.compras}</span></td>
                            <td className="text-end text-success fw-semibold">{fmt(v.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Stock de la categoría */}
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">📦 Stock de productos en esta categoría</div>
                <div className="table-responsive">
                  <table className="table table-hover mb-0" style={{ fontSize:13 }}>
                    <thead className="table-light">
                      <tr><th>Producto</th><th>Código</th><th className="text-end">Precio</th><th className="text-center">Stock</th><th>Vencimiento</th></tr>
                    </thead>
                    <tbody>
                      {lineProducts.length === 0
                        ? <tr><td colSpan="5" className="text-center text-muted py-3">Sin productos</td></tr>
                        : lineProducts.map(p => (
                          <tr key={p.id}>
                            <td className="fw-semibold">{dname(p)}</td>
                            <td className="text-muted" style={{ fontFamily:'monospace', fontSize:11 }}>{p.barcode||'—'}</td>
                            <td className="text-end">{fmt(p.final_price??p.price)}</td>
                            <td className="text-center">
                              <span className={`badge ${p.stock===0?'bg-danger':p.stock<=(p.min_stock??5)?'bg-warning text-dark':'bg-success'}`}>
                                {p.stock}
                              </span>
                            </td>
                            <td>{p.expiry_date||<span className="text-muted">—</span>}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LineDashboard;