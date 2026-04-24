import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../services/productService';

const Alerts = () => {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    productService.getAll(token).then(setProducts).catch(console.error);
  }, [token]);

  const today   = new Date().toISOString().slice(0, 10);
  const in7days = (() => { const d = new Date(); d.setDate(d.getDate() + 7);  return d.toISOString().slice(0, 10); })();
  const in30d   = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  // Usar min_stock propio de cada producto (default 5 si no tiene)
  const agotados = products.filter(p => p.stock === 0);
  const bajos    = products.filter(p => p.stock > 0 && p.stock <= (p.min_stock ?? 5));
  const ok       = products.filter(p => p.stock > (p.min_stock ?? 5));

  const vencidos    = products.filter(p => p.expiry_date && p.expiry_date < today);
  const vence7dias  = products.filter(p => p.expiry_date && p.expiry_date >= today && p.expiry_date <= in7days);
  const vence30dias = products.filter(p => p.expiry_date && p.expiry_date > in7days && p.expiry_date <= in30d);
  const vigentes    = products.filter(p => p.expiry_date && p.expiry_date > in30d);
  const sinFecha    = products.filter(p => !p.expiry_date);

  const stockBadge = (p) => {
    const threshold = p.min_stock ?? 5;
    if (p.stock === 0)          return 'bg-danger';
    if (p.stock <= threshold)   return 'bg-danger';
    if (p.stock <= threshold*2) return 'bg-warning text-dark';
    return 'bg-secondary';
  };

  const stockLabel = (p) => {
    const threshold = p.min_stock ?? 5;
    if (p.stock === 0)        return <span className="badge bg-danger">❌ Agotado</span>;
    if (p.stock <= threshold) return <span className="badge bg-danger">⚠️ Bajo (≤ {threshold})</span>;
    return                           <span className="badge bg-success">✅ Normal</span>;
  };

  const expiryBadge = (exp) => {
    if (!exp)           return <span className="badge bg-secondary">Sin fecha</span>;
    if (exp < today)    return <span className="badge bg-danger">❌ Vencido</span>;
    if (exp <= in7days) return <span className="badge bg-danger">🔴 Vence en días</span>;
    if (exp <= in30d)   return <span className="badge bg-warning text-dark">🟡 Vence pronto</span>;
    return                     <span className="badge bg-success">✅ Vigente</span>;
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-4">⚠️ Alertas de Inventario</h4>

        {/* ══ TARJETAS STOCK ══ */}
        <h6 className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: 1 }}>
          📦 Estado de Stock
        </h6>
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card border-danger border-2 text-center">
              <div className="card-body">
                <div className="fs-2 fw-bold text-danger">{agotados.length}</div>
                <div className="text-muted">❌ Productos Agotados</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-warning border-2 text-center">
              <div className="card-body">
                <div className="fs-2 fw-bold text-warning">{bajos.length}</div>
                <div className="text-muted">⚠️ Stock Bajo (≤ mínimo por producto)</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-success border-2 text-center">
              <div className="card-body">
                <div className="fs-2 fw-bold text-success">{ok.length}</div>
                <div className="text-muted">✅ Stock Normal</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla stock bajo con min_stock visible */}
        {(agotados.length > 0 || bajos.length > 0) && (
          <div className="card mb-4 border-danger">
            <div className="card-header fw-semibold text-danger bg-danger bg-opacity-10">
              🚨 Productos con stock bajo o agotado
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th className="text-center">Stock actual</th>
                    <th className="text-center">Stock mínimo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {[...agotados, ...bajos].map(p => (
                    <tr key={p.id} style={{ background: p.stock === 0 ? '#fff5f5' : '#fff8f0' }}>
                      <td className="fw-semibold">{p.display_name || p.name}</td>
                      <td>{p.category || '—'}</td>
                      <td className="text-center">
                        <span className={`badge ${stockBadge(p)}`}>{p.stock}</span>
                      </td>
                      <td className="text-center">
                        <span className="badge bg-light text-dark border">{p.min_stock ?? 5}</span>
                      </td>
                      <td>{stockLabel(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TARJETAS VENCIMIENTO ══ */}
        <h6 className="text-muted fw-semibold mb-2 text-uppercase" style={{ fontSize: '0.75rem', letterSpacing: 1 }}>
          📅 Estado de Vencimiento
        </h6>
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card border-danger border-2 text-center">
              <div className="card-body">
                <div className="fs-2 fw-bold text-danger">{vencidos.length}</div>
                <div className="text-muted">❌ Vencidos</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-danger border-2 text-center" style={{ borderStyle: 'dashed' }}>
              <div className="card-body">
                <div className="fs-2 fw-bold text-danger">{vence7dias.length}</div>
                <div className="text-muted">🔴 Vencen en 7 días</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-warning border-2 text-center">
              <div className="card-body">
                <div className="fs-2 fw-bold text-warning">{vence30dias.length}</div>
                <div className="text-muted">🟡 Vencen en 30 días</div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-success border-2 text-center">
              <div className="card-body">
                <div className="fs-2 fw-bold text-success">{vigentes.length}</div>
                <div className="text-muted">✅ Vigentes</div>
              </div>
            </div>
          </div>
        </div>

        {(vencidos.length > 0 || vence7dias.length > 0 || vence30dias.length > 0) && (
          <div className="card mb-4 border-danger">
            <div className="card-header fw-semibold text-danger bg-danger bg-opacity-10">
              🚨 Productos que requieren atención inmediata
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Fecha Vencimiento</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {[...vencidos, ...vence7dias, ...vence30dias].map(p => (
                    <tr key={p.id} style={{ background: p.expiry_date < today ? '#fff5f5' : p.expiry_date <= in7days ? '#fff8f0' : 'inherit' }}>
                      <td className="fw-semibold">{p.display_name || p.name}</td>
                      <td>{p.category || '—'}</td>
                      <td>
                        <span className={`badge ${stockBadge(p)}`}>{p.stock}</span>
                      </td>
                      <td>{p.expiry_date}</td>
                      <td>{expiryBadge(p.expiry_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabla stock — todos los productos */}
        <div className="card mb-4">
          <div className="card-header fw-semibold">📋 Estado de Stock — todos los productos</div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th className="text-center">Stock actual</th>
                  <th className="text-center">Stock mínimo</th>
                  <th>Estado Stock</th>
                </tr>
              </thead>
              <tbody>
                {[...agotados, ...bajos, ...ok].map(p => (
                  <tr key={p.id}>
                    <td className="fw-semibold">{p.display_name || p.name}</td>
                    <td>{p.category || '—'}</td>
                    <td className="text-center">
                      <span className={`badge ${stockBadge(p)}`}>{p.stock}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-light text-dark border">{p.min_stock ?? 5}</span>
                    </td>
                    <td>{stockLabel(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla vencimiento — todos los productos */}
        <div className="card">
          <div className="card-header fw-semibold">📅 Estado de Vencimiento — todos los productos</div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Fecha Vencimiento</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {[...vencidos, ...vence7dias, ...vence30dias, ...vigentes, ...sinFecha].map(p => (
                  <tr key={p.id}>
                    <td className="fw-semibold">{p.display_name || p.name}</td>
                    <td>{p.category || '—'}</td>
                    <td>
                      <span className={`badge ${stockBadge(p)}`}>{p.stock}</span>
                    </td>
                    <td>{p.expiry_date || <span className="text-muted">—</span>}</td>
                    <td>{expiryBadge(p.expiry_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
};

export default Alerts;