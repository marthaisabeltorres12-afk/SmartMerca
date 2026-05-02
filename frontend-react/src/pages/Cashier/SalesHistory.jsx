import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { saleService } from '../../services/saleService';

const fmtMoney = (n) => Number(n).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtDate  = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
};

const InvoiceModal = ({ sale, cashierName, onClose }) => {
  const ref = useRef();
  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Factura #${String(sale.id).padStart(6,'0')}</title>
      <style>
        body{font-family:monospace;font-size:12px;margin:20px;color:#000}
        h2{text-align:center;margin:0}p{margin:2px 0}
        table{width:100%;border-collapse:collapse}
        th,td{padding:3px 4px}
        .right{text-align:right}.center{text-align:center}
      </style></head><body>
      ${ref.current.innerHTML}
      </body></html>
    `);
    w.document.close(); w.print(); w.close();
  };

  return (
    <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:9999 }}>
      <div className="modal-dialog modal-sm">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h6 className="modal-title fw-bold">🧾 Factura #{String(sale.id).padStart(6,'0')}</h6>
            <button className="btn-close btn-sm" onClick={onClose} />
          </div>
          <div className="modal-body p-3">
            <div ref={ref} style={{ fontFamily:'monospace', fontSize:13, lineHeight:1.6 }}>
              <div style={{ textAlign:'center' }}>
                <strong style={{ fontSize:16 }}>SmartMerca</strong><br/>
                <span>Sistema de Ventas</span><br/>
                <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
                <strong>FACTURA DE VENTA</strong><br/>
                <span>No. {String(sale.id).padStart(6,'0')}</span>
              </div>
              <div style={{ borderTop:'1px dashed #000', margin:'6px 0' }} />
              <div>Cajero: <strong>{cashierName}</strong></div>
              <div>Fecha: {fmtDate(sale.created_at)}</div>
              {sale.customer && (
                <>
                  <div style={{ borderTop:'1px dashed #000', margin:'4px 0' }} />
                  <div>Cliente: <strong>{sale.customer.full_name}</strong></div>
                  <div>{sale.customer.doc_type}: {sale.customer.doc_number}</div>
                  {sale.customer.phone && <div>Tel: {sale.customer.phone}</div>}
                  {sale.customer.address && <div>Ciudad: {sale.customer.address}</div>}
                </>
              )}
              <div style={{ borderTop:'1px dashed #000', margin:'6px 0' }} />
              <table style={{ width:'100%', fontSize:12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:'left' }}>Producto</th>
                    <th style={{ textAlign:'center' }}>Cant</th>
                    <th style={{ textAlign:'right' }}>Precio</th>
                    <th style={{ textAlign:'right' }}>Subt.</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items?.map((item, i) => (
                    <tr key={i}>
                      <td style={{ textAlign:'left', wordBreak:'break-word', maxWidth:90 }}>{item.product}</td>
                      <td style={{ textAlign:'center' }}>{item.quantity}</td>
                      <td style={{ textAlign:'right' }}>{fmtMoney(item.price)}</td>
                      <td style={{ textAlign:'right' }}>{fmtMoney(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ borderTop:'1px dashed #000', margin:'6px 0' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'bold', fontSize:14, marginTop:4 }}>
                <span>TOTAL:</span><span>{fmtMoney(sale.total)}</span>
              </div>
              <div style={{ borderTop:'1px dashed #000', margin:'6px 0' }} />
              <div style={{ textAlign:'center', fontSize:11 }}>
                {sale.customer && (
                  <div style={{ marginBottom:4, fontWeight:'bold' }}>
                    ⭐ Puntos ganados: +{Math.floor(parseFloat(sale.total) / 1000)}<br/>
                    ⭐ Puntos totales: {sale.customer.points}
                  </div>
                )}
                ¡Gracias por su compra!
              </div>
            </div>
          </div>
          <div className="modal-footer py-2 gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cerrar</button>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>🖨️ Imprimir</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SalesHistory = () => {
  const { token, user } = useAuth();
  const isCajero = user?.role === 'cajero';

  const [sales,    setSales]    = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [invoice,  setInvoice]  = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  useEffect(() => {
    saleService.getAll(token)
      .then(all => setSales(all.filter(s => s.cashier_id === user?.id)))
      .catch(console.error);
  }, [token, user]);

  const filtered = sales.filter(s => {
    const d = s.created_at?.slice(0,10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo   && d > dateTo)   return false;
    return true;
  });

  return (
    <div className="d-flex" style={{ background:'#f0f2f5', minHeight:'100vh' }}>
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>

        <h4 className="fw-bold mb-1">📜 Historial de Ventas</h4>
        <p className="text-muted mb-4 small">Mis ventas registradas</p>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius:12 }}>
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small fw-semibold mb-1">📅 Desde</label>
                <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold mb-1">📅 Hasta</label>
                <input type="date" className="form-control form-control-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
              <div className="col-auto">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize:'0.85rem' }}>
              <thead className="table-light">
                <tr>
                  <th># Venta</th>
                  <th>Fecha y Hora</th>
                  <th className="text-center">Items</th>
                  {/* ✅ CAMBIO: cajero NO ve columna Total */}
                  {!isCajero && <th className="text-end">Total</th>}
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={isCajero ? 4 : 5} className="text-center text-muted py-5">
                      <div style={{ fontSize:'2rem' }}>🧾</div>
                      Sin ventas en este período
                    </td>
                  </tr>
                ) : filtered.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td>
                        <span className="badge bg-secondary">#{String(s.id).padStart(4,'0')}</span>
                      </td>
                      <td className="text-muted">{fmtDate(s.created_at)}</td>
                      <td className="text-center">
                        <span className="badge bg-primary">{s.items?.length || 0} productos</span>
                      </td>
                      {/* ✅ CAMBIO: cajero NO ve el total */}
                      {!isCajero && (
                        <td className="text-end fw-bold text-success">{fmtMoney(s.total)}</td>
                      )}
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          {/* ✅ CAMBIO: cajero NO puede ver detalles */}
                          {!isCajero && (
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                            >
                              {expanded === s.id ? '▲ Ocultar' : '▼ Detalle'}
                            </button>
                          )}
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => setInvoice(s)}
                            title="Ver factura"
                          >
                            🧾 Factura
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ✅ CAMBIO: cajero NO ve el detalle expandido */}
                    {!isCajero && expanded === s.id && (
                      <tr>
                        <td colSpan="5" className="p-0">
                          <div className="bg-light px-4 py-3" style={{ borderBottom:'1px solid #dee2e6' }}>
                            <table className="table table-sm mb-0" style={{ fontSize:'0.82rem' }}>
                              <thead>
                                <tr>
                                  <th>Producto</th>
                                  <th className="text-center">Cantidad</th>
                                  <th className="text-end">Precio unit.</th>
                                  <th className="text-end">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.items?.map((item, j) => (
                                  <tr key={j}>
                                    <td className="fw-semibold">{item.product}</td>
                                    <td className="text-center">
                                      <span className="badge bg-secondary">{item.quantity}</span>
                                    </td>
                                    <td className="text-end">{fmtMoney(item.price)}</td>
                                    <td className="text-end text-success fw-bold">{fmtMoney(item.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="table-light">
                                <tr>
                                  <td colSpan="3" className="text-end fw-bold">TOTAL:</td>
                                  <td className="text-end fw-bold text-success">{fmtMoney(s.total)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* ✅ CAMBIO: cajero NO ve el total del pie de tabla */}
          {filtered.length > 0 && !isCajero && (
            <div className="card-footer bg-white d-flex justify-content-between align-items-center" style={{ borderRadius:'0 0 12px 12px' }}>
              <span className="text-muted small">{filtered.length} venta(s)</span>
              <span className="fw-bold text-success">
                {fmtMoney(filtered.reduce((a, s) => a + parseFloat(s.total), 0))}
              </span>
            </div>
          )}

          {/* Cajero solo ve conteo */}
          {filtered.length > 0 && isCajero && (
            <div className="card-footer bg-white" style={{ borderRadius:'0 0 12px 12px' }}>
              <span className="text-muted small">{filtered.length} venta(s) registradas</span>
            </div>
          )}
        </div>
      </main>

      {invoice && (
        <InvoiceModal
          sale={invoice}
          cashierName={user?.name}
          onClose={() => setInvoice(null)}
        />
      )}
    </div>
  );
};

export default SalesHistory;