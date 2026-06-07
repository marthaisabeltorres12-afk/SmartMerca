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
  const printRef = useRef();
  const isDian = sale.sale_mode === 'dian';

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const css = `
      @page { size: 72mm auto; margin: 0 !important; }
      * { box-sizing: border-box; margin: 0; padding: 0; page-break-inside: avoid !important; break-inside: avoid !important; }
      html, body { width: 72mm !important; margin: 0 !important; padding: 0 !important; height: auto !important; }
      body { font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #000; background: #fff; padding: 6px 6mm 6px 6mm; }
      .c { text-align: center; }
      .r { text-align: right; }
      .b { font-weight: bold; }
      .sep  { border: none; border-top: 1px dashed #000; margin: 3px 0; display: block; }
      .sep2 { border: none; border-top: 1px solid  #000; margin: 1px 0; display: block; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      td, th { padding: 0 1px; line-height: 1.5; vertical-align: top; }
      .info-table td:first-child { white-space: nowrap; min-width: 55px; }
      .info-table td:last-child  { text-align: right; }
      .prod-table th { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 1px; }
      .prod-table td { border-bottom: 1px dashed #ccc; }
      .prod-table th:first-child, .prod-table td:first-child { text-align: left;   width: 38%; }
      .prod-table th:nth-child(2),.prod-table td:nth-child(2){ text-align: center; width: 18%; }
      .prod-table th:nth-child(3),.prod-table td:nth-child(3){ text-align: right;  width: 22%; }
      .prod-table th:last-child,  .prod-table td:last-child  { text-align: right;  width: 22%; }
      .tot-table td:first-child { font-weight: bold; font-size: 12px; }
      .tot-table td:last-child  { text-align: right; font-weight: bold; font-size: 12px; }
      .iva-row td { font-size: 9px; }
      .iva-row td:last-child { text-align: right; }
      .pago-table td:first-child { white-space: nowrap; min-width: 80px; }
      .pago-table td:last-child  { text-align: right; }
    `;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:72mm;height:0;border:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${content}</body></html>`);
    doc.close();
    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  const subtotalItems = sale.items?.reduce((a, i) => a + Number(i.subtotal), 0) || 0;
  const total = sale.total ? Math.round(parseFloat(sale.total)) : subtotalItems;

  return (
    <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:9999 }}>
      <div className="modal-dialog" style={{ maxWidth:340 }}>
        <div className="modal-content">
          <div className="modal-header py-2" style={{ background: isDian ? '#1e3a5f' : '#374151', color:'#fff' }}>
            <h6 className="modal-title fw-bold">
              {isDian ? '🧾 Factura DIAN' : '🧾 Ticket'} #{String(sale.id).padStart(6,'0')}
            </h6>
            <button className="btn-close btn-close-white btn-sm" onClick={onClose} />
          </div>

          <div className="modal-body p-2" style={{ background:'#fafafa' }}>
            <div ref={printRef} style={{ fontFamily:'"Courier New",Courier,monospace', fontSize:11, color:'#000', background:'#fff', padding:'6px 8px', width:'72mm', margin:'0' }}>

              {/* ENCABEZADO */}
              <div style={{ textAlign:'center' }}>
                <div style={{ fontWeight:'bold', fontSize:14, letterSpacing:1 }}>LA ESQUINA DE DULCE</div>
                <div>EDUCARDO TORRES</div>
                <div>NIT: 17293830</div>
                <div>DIR: MZ 30 CASA 4 QUITAS FLANDES</div>
                <div>TEL: 3203308547</div>
                <div>FLANDES - TOLIMA</div>
                <div>Responsable de IVA</div>
              </div>

              <hr className="sep"/>

              {isDian ? (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontWeight:'bold' }}>FACTURA DE VENTA</div>
                  <div style={{ fontSize:9 }}>Res. DIAN No. 18764050366042</div>
                  <div style={{ fontSize:9 }}>Del 2024-01-01 al 2025-12-31</div>
                  <div style={{ fontSize:9 }}>Desde FACT-0001 hasta FACT-9999</div>
                </div>
              ) : (
                <div style={{ textAlign:'center', fontSize:10 }}>
                  <div>ESTE DOCUMENTO NO ES VALIDO</div>
                  <div>COMO FACTURA DE VENTA</div>
                </div>
              )}

              <hr className="sep"/>

              {/* INFO VENTA */}
              <table className="info-table"><tbody>
                <tr>
                  <td>{isDian ? 'Factura No:' : 'Ticket No:'}</td>
                  <td style={{ textAlign:'right', fontWeight:'bold' }}>{isDian ? 'FACT-' : '#'}{String(sale.id).padStart(6,'0')}</td>
                </tr>
                <tr><td>Fecha:</td><td style={{ textAlign:'right' }}>{fmtDate(sale.created_at)}</td></tr>
                <tr><td>Cajero:</td><td style={{ textAlign:'right' }}>{cashierName}</td></tr>
                <tr>
                  <td>Cliente:</td>
                  <td style={{ textAlign:'right' }}>
                    {(sale.customer?.full_name || 'Consumidor Final').toUpperCase()}
                  </td>
                </tr>
                {sale.customer?.doc_number && (
                  <tr><td>CC:</td><td style={{ textAlign:'right' }}>{sale.customer.doc_number}</td></tr>
                )}
                {sale.customer?.phone && (
                  <tr><td>Tel:</td><td style={{ textAlign:'right' }}>{sale.customer.phone}</td></tr>
                )}
                {sale.customer?.address && (
                  <tr><td>Dir:</td><td style={{ textAlign:'right' }}>{sale.customer.address}</td></tr>
                )}
              </tbody></table>

              <hr className="sep"/>

              {/* PRODUCTOS */}
              <table className="prod-table">
                <thead>
                  <tr><th>Producto</th><th>Cant</th><th>P.Unit</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {sale.items?.map((item, i) => (
                    <tr key={i}>
                      <td>
                        {item.product}
                        {item.units_per_pack && (
                          <span style={{ fontSize:8 }}> {item.quantity}p×{item.units_per_pack}u</span>
                        )}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        {item.units_per_pack
                          ? `${item.quantity}p`
                          : Number(item.quantity) % 1 === 0
                            ? `${item.quantity} und`
                            : `${item.quantity} kg`}
                      </td>
                      <td style={{ textAlign:'right' }}>{Number(item.price).toLocaleString('es-CO')}</td>
                      <td style={{ textAlign:'right', fontWeight:'bold' }}>{Number(item.subtotal).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <hr className="sep2"/>

              {/* IVA + TOTAL */}
              {(() => {
                const ivaGrupos = {};
                sale.items?.forEach(item => {
                  const rate = item.iva_type ?? 19;
                  if (!ivaGrupos[rate]) ivaGrupos[rate] = 0;
                  const sub = Number(item.subtotal) || 0;
                  if (rate > 0) ivaGrupos[rate] += sub - sub / (1 + rate / 100);
                });
                return (
                  <>
                    {Object.entries(ivaGrupos).filter(([, v]) => v > 0).map(([rate, v]) => (
                      <table key={rate} className="iva-row"><tbody>
                        <tr>
                          <td>IVA {rate}% (incluido):</td>
                          <td style={{ textAlign:'right' }}>${Math.round(v).toLocaleString('es-CO')}</td>
                        </tr>
                      </tbody></table>
                    ))}
                    <table className="tot-table"><tbody>
                      {subtotalItems > total && (
                        <tr>
                          <td>Descuento cupón:</td>
                          <td style={{textAlign:'right', color:'#16a34a'}}>-${(subtotalItems - total).toLocaleString('es-CO')}</td>
                        </tr>
                      )}
                      <tr>
                        <td>TOTAL:</td>
                        <td>${Number(total).toLocaleString('es-CO')}</td>
                      </tr>
                    </tbody></table>
                  </>
                );
              })()}

              <hr className="sep"/>

              {/* MÉTODO DE PAGO */}
              <table className="pago-table"><tbody>
                {sale.payment_method === 'credito' ? (
                  <tr><td>Método de pago:</td><td style={{ textAlign:'right', fontWeight:'bold' }}>A CRÉDITO</td></tr>
                ) : sale.payments?.length > 0 ? (
                  <>
                    {sale.payments.map((p, i) => (
                      <React.Fragment key={i}>
                        <tr>
                          <td style={{ textTransform:'capitalize' }}>
                            {sale.payments.length > 1 ? p.metodo : 'Método de pago:'}
                          </td>
                          <td style={{ textAlign:'right', fontWeight: sale.payments.length > 1 ? 'normal' : 'bold', textTransform:'uppercase' }}>
                            {sale.payments.length > 1
                              ? '$' + Number(p.monto).toLocaleString('es-CO')
                              : p.metodo.toUpperCase()}
                          </td>
                        </tr>
                        {p.metodo?.toLowerCase().includes('efectivo') && (
                          <>
                            <tr>
                              <td>Recibido:</td>
                              <td style={{ textAlign:'right' }}>${Number(p.monto).toLocaleString('es-CO')}</td>
                            </tr>
                            <tr>
                              <td>Cambio:</td>
                              <td style={{ textAlign:'right' }}>${Number(p.cambio || 0).toLocaleString('es-CO')}</td>
                            </tr>
                          </>
                        )}
                      </React.Fragment>
                    ))}
                  </>
                ) : (
                  <tr>
                    <td>Método de pago:</td>
                    <td style={{ textAlign:'right', fontWeight:'bold', textTransform:'uppercase' }}>
                      {sale.payment_method || 'EFECTIVO'}
                    </td>
                  </tr>
                )}
              </tbody></table>

              <hr className="sep"/>

              {/* PIE */}
              <div style={{ textAlign:'center' }}>
                <div style={{ letterSpacing:3 }}>★ ★ ★ ★ ★ ★ ★ ★ ★ ★</div>
                {sale.customer && (
                  <>
                    <div>Puntos ganados: +{Math.floor(total / 1000)}</div>
                    <div>Puntos totales: {(sale.customer.points || 0) + Math.floor(total / 1000)}</div>
                  </>
                )}
                {isDian && (
                  <div style={{ fontSize:9 }}>
                    Generado el {new Date().toLocaleDateString('es-CO')}<br/>
                    Vendedor autorizado por resolución DIAN
                  </div>
                )}
                <div style={{ fontWeight:'bold', fontSize:12, marginTop:2 }}>¡GRACIAS POR SU COMPRA!</div>
                <div>Vuelva pronto</div>
                <div style={{ fontSize:9, marginTop:2 }}>Este ticket es su comprobante</div>
                <div style={{ letterSpacing:3 }}>★ ★ ★ ★ ★ ★ ★ ★ ★ ★</div>
                <div style={{ fontSize:9 }}>Desarrollado por SmartMerca</div>
              </div>

            </div>
          </div>

          <div className="modal-footer py-2 gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Cerrar</button>
            <button className="btn btn-dark btn-sm fw-bold" onClick={handlePrint}>
              <i className="bi bi-printer me-1"></i> Imprimir {isDian ? 'factura' : 'ticket'}
            </button>
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

        <h4 className="fw-bold mb-1 bi-card-list"> Historial de Ventas</h4>
        <p className="text-muted mb-4 small">Mis ventas registradas</p>

        {/* Filtros */}
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius:12 }}>
          <div className="card-body py-2">
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small fw-semibold mb-1 bi-calendar-event-fill"> Desde</label>
                <input type="date" className="form-control form-control-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small fw-semibold mb-1 bi-calendar-event-fill"> Hasta</label>
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
                  <th className="text-end">Total</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                 <tr>
  <td colSpan={5} className="text-center text-muted py-5">
    <div style={{ fontSize: '2rem' }}>
      <i className="bi bi-receipt"></i>
    </div>
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
                      <td className="text-end fw-bold text-success">{fmtMoney(s.total)}</td>
                      <td className="text-center">
                        <div className="d-flex gap-1 justify-content-center">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                          >
                            {expanded === s.id ? '▲ Ocultar' : '▼ Detalle'}
                          </button>
                          <button
  className="btn btn-outline-primary btn-sm"
  onClick={() => setInvoice(s)}
  title="Ver ticket"
>
  <i className="bi bi-receipt me-1"></i>
  Ticket
</button>
                        </div>
                      </td>
                    </tr>

                    {expanded === s.id && (
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

          {filtered.length > 0 && (
            <div className="card-footer bg-white d-flex justify-content-between align-items-center" style={{ borderRadius:'0 0 12px 12px' }}>
              <span className="text-muted small">{filtered.length} venta(s) registradas</span>
              <span className="fw-bold text-success">
                {fmtMoney(filtered.reduce((a, s) => a + parseFloat(s.total), 0))}
              </span>
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