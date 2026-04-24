import React, { useEffect, useState, useCallback, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { creditService } from '../../services/creditService';
import { customerService } from '../../services/customerService';

const fmt = (n) => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtDate = (s) => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-CO') : '—';

const ESTADO_BADGE = {
  pagada:    { cls: 'bg-success',           label: '✅ Pagada'    },
  parcial:   { cls: 'bg-warning text-dark', label: '⚠️ Parcial'  },
  pendiente: { cls: 'bg-danger',            label: '🔴 Pendiente' },
};

// ── Comprobante imprimible ────────────────────────────────────────────────
const Comprobante = ({ data, onClose }) => {
  const ref = useRef();

  const print = () => {
    const w = window.open('', '_blank', 'width=500,height=700');
    w.document.write(`<html><head><title>Comprobante</title>
    <style>body{font-family:"Courier New",monospace;font-size:13px;padding:20px;max-width:400px;}
    hr{border-top:1px dashed #000;}.bold{font-weight:bold;}.right{text-align:right;}
    table{width:100%;border-collapse:collapse;}td{padding:2px 0;}
    </style></head><body>${ref.current.innerHTML}
    <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:10000 }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h6 className="modal-title fw-bold">🧾 Comprobante de pago</h6>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body" style={{ background:'#fafafa' }}>
            <div ref={ref} style={{ fontFamily:'"Courier New",monospace', fontSize:13, padding:16, background:'#fff' }}>
              <div className="text-center fw-bold" style={{ fontSize:15, marginBottom:8 }}>
                {data.tipo === 'factura' ? 'COMPROBANTE DE PAGO' : 'COMPROBANTE DE ABONO'}
              </div>
              <hr style={{ borderTop:'1px dashed #000' }} />
              <table>
                <tbody>
                  <tr><td className="fw-semibold">Cliente:</td><td className="text-end">{data.cliente}</td></tr>
                  <tr><td className="fw-semibold">Monto pagado:</td><td className="text-end fw-bold">{fmt(data.monto)}</td></tr>
                  <tr><td className="fw-semibold">Fecha:</td><td className="text-end">{data.fecha}</td></tr>
                </tbody>
              </table>
              <hr style={{ borderTop:'1px dashed #000' }} />
              <div className="fw-semibold mb-1">Aplicado a:</div>
              {data.afectadas.map((a, i) => {
                const f = data.facturas?.find(x => x.sale_id === a.sale_id);
                return (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span>Factura #{a.sale_id}{f ? ` (${fmtDate(f.date)})` : ''}</span>
                    <span className="fw-bold">{fmt(a.monto)}</span>
                  </div>
                );
              })}
              <hr style={{ borderTop:'1px dashed #000' }} />
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span className="fw-bold">Saldo total restante:</span>
                <span className="fw-bold">{fmt(data.saldo_total)}</span>
              </div>
              {data.tipo === 'factura' && data.afectadas[0] && (() => {
                const f = data.facturas?.find(x => x.sale_id === data.afectadas[0].sale_id);
                return f ? (
                  <div style={{ display:'flex', justifyContent:'space-between', color: f.pendiente === 0 ? 'green' : '#888' }}>
                    <span>Saldo factura #{f.sale_id}:</span>
                    <span>{fmt(f.pendiente)} {f.estado === 'pagada' ? '✅' : ''}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
            <button className="btn btn-dark fw-bold" onClick={print}>🖨️ Imprimir</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────
const Cartera = () => {
  const { token } = useAuth();
  const [cartera,    setCartera]    = useState([]);
  const [customers,  setCustomers]  = useState([]);
  const [alert,      setAlert]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [tab,        setTab]        = useState('cartera');
  const [search,     setSearch]     = useState('');

  // Modal abono/pago
  const [abonoModal,   setAbonoModal]   = useState(null);  // cliente
  const [abonoFactura, setAbonoFactura] = useState(null);  // factura específica o null
  const [abonoMonto,   setAbonoMonto]   = useState('');
  const [abonoNota,    setAbonoNota]    = useState('');

  // Modal historial
  const [histModal, setHistModal] = useState(null);
  const [histTxs,   setHistTxs]   = useState([]);

  // Modal facturas
  const [facturasModal, setFacturasModal] = useState(null);
  const [facturas,      setFacturas]      = useState([]);
  const [loadingFact,   setLoadingFact]   = useState(false);

  // Modal tope
  const [topeModal, setTopeModal] = useState(null);
  const [topeValor, setTopeValor] = useState('');

  // Comprobante
  const [comprobante, setComprobante] = useState(null);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4500); };

  const load = useCallback(async () => {
    try {
      const [c, all] = await Promise.all([
        creditService.getCartera(token),
        customerService.getAll(token),
      ]);
      setCartera(Array.isArray(c) ? c : []);
      setCustomers(Array.isArray(all) ? all : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ── Abono / pago ─────────────────────────────────────────────────────
  const handleAbono = async (e) => {
    e.preventDefault();
    const monto = parseFloat(abonoMonto);
    if (!monto || monto <= 0) { showAlert('danger','Ingresa un monto válido'); return; }

    // Validaciones front
    const bal = parseFloat(abonoModal.credit_balance || 0);
    if (monto > bal + 0.01) { showAlert('danger', `El abono supera la deuda total (${fmt(bal)})`); return; }
    if (abonoFactura) {
      if (abonoFactura.pendiente <= 0) { showAlert('danger','Esta factura ya está pagada'); return; }
      if (monto > abonoFactura.pendiente + 0.01) {
        showAlert('danger', `El monto supera lo pendiente de esta factura (${fmt(abonoFactura.pendiente)})`);
        return;
      }
    }

    setLoading(true);
    try {
      const body = {
        amount:  monto,
        note:    abonoNota || (abonoFactura ? `Pago factura #${abonoFactura.sale_id}` : 'Abono general'),
        sale_id: abonoFactura?.sale_id || null,
      };
      const res = await creditService.addPayment(abonoModal.id, body, token);
      setComprobante(res.comprobante);
      setAbonoModal(null); setAbonoFactura(null); setAbonoMonto(''); setAbonoNota('');
      if (facturasModal?.id === abonoModal.id) {
        const updated = await creditService.getFacturasPendientes(abonoModal.id, token);
        setFacturas(Array.isArray(updated) ? updated : []);
      }
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  // ── Historial ────────────────────────────────────────────────────────
  const openHist = async (customer) => {
    setHistModal(customer);
    try { setHistTxs(await creditService.getTransactions(customer.id, token)); }
    catch(e) { setHistTxs([]); }
  };

  // ── Facturas ─────────────────────────────────────────────────────────
  const openFacturas = async (customer) => {
    setFacturasModal(customer);
    setLoadingFact(true);
    try {
      const data = await creditService.getFacturasPendientes(customer.id, token);
      setFacturas(Array.isArray(data) ? data : []);
    } catch(e) { setFacturas([]); }
    finally { setLoadingFact(false); }
  };

  // ── Tope ─────────────────────────────────────────────────────────────
  const handleTope = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await creditService.setLimit(topeModal.id, { credit_limit: parseFloat(topeValor||0) }, token);
      showAlert('success', `Tope actualizado para ${topeModal.full_name}`);
      setTopeModal(null); setTopeValor('');
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const totalDeuda  = cartera.reduce((a,c) => a + parseFloat(c.credit_balance||0), 0);
  const conCredito  = customers.filter(c => c.credit_limit > 0);
  const filtered    = cartera.filter(c =>
    !search ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.doc_number?.includes(search)
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <h4 className="fw-bold mb-1">💰 Cartera de Clientes</h4>
        <p className="text-muted mb-4">Gestión de créditos, deudas y abonos</p>

        {alert && <div className={`alert alert-${alert.type} alert-dismissible`}>{alert.msg}</div>}

        {/* KPIs */}
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card border-danger border-2 text-center">
              <div className="card-body">
                <div className="fs-3 fw-bold text-danger">{fmt(totalDeuda)}</div>
                <div className="text-muted small">💸 Total en cartera</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-warning border-2 text-center">
              <div className="card-body">
                <div className="fs-3 fw-bold text-warning">{cartera.length}</div>
                <div className="text-muted small">👤 Clientes con deuda</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card border-success border-2 text-center">
              <div className="card-body">
                <div className="fs-3 fw-bold text-success">{conCredito.length}</div>
                <div className="text-muted small">✅ Con crédito habilitado</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-3">
          {[['cartera','💸 Deudas activas'],['limites','⚙️ Configurar créditos']].map(([k,l]) => (
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* ── DEUDAS ACTIVAS ── */}
        {tab === 'cartera' && (
          <>
            <div className="mb-3">
              <input className="form-control" style={{ maxWidth:320 }}
                placeholder="🔍 Buscar por nombre o documento..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Cliente</th>
                      <th>Contacto</th>
                      <th className="text-end">Deuda actual</th>
                      <th className="text-end">Tope</th>
                      <th className="text-center">% Usado</th>
                      <th style={{width:300}}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filtered.length ? (
                      <tr><td colSpan="6" className="text-center text-muted py-5">
                        <div className="fs-2">✅</div>
                        <div>Ningún cliente tiene deuda pendiente</div>
                      </td></tr>
                    ) : filtered.map(c => {
                      const pct = c.credit_limit > 0
                        ? Math.min(100, (c.credit_balance / c.credit_limit * 100)).toFixed(0)
                        : 100;
                      return (
                        <tr key={c.id} style={{ background: parseFloat(pct) >= 90 ? '#fff5f5' : '' }}>
                          <td>
                            <div className="fw-semibold">{c.full_name}</div>
                            <div className="text-muted small">{c.doc_type}: {c.doc_number}</div>
                          </td>
                          <td className="text-muted small">{c.phone || '—'}</td>
                          <td className="text-end fw-bold text-danger fs-6">{fmt(c.credit_balance)}</td>
                          <td className="text-end text-muted">{c.credit_limit > 0 ? fmt(c.credit_limit) : <span className="badge bg-secondary">Sin tope</span>}</td>
                          <td className="text-center">
                            <div className="d-flex align-items-center gap-2">
                              <div className="progress flex-fill" style={{height:8}}>
                                <div className={`progress-bar ${parseFloat(pct)>=90?'bg-danger':parseFloat(pct)>=70?'bg-warning':'bg-success'}`}
                                  style={{width:`${pct}%`}} />
                              </div>
                              <span className="small fw-bold" style={{width:36}}>{pct}%</span>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              <button className="btn btn-success btn-sm"
                                onClick={() => { setAbonoModal(c); setAbonoFactura(null); setAbonoMonto(''); setAbonoNota(''); }}>
                                💵 Abono
                              </button>
                              <button className="btn btn-warning btn-sm text-dark"
                                onClick={() => openFacturas(c)}>
                                🧾 Facturas
                              </button>
                              <button className="btn btn-outline-primary btn-sm"
                                onClick={() => openHist(c)}>
                                📋 Historial
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── CONFIGURAR CRÉDITOS ── */}
        {tab === 'limites' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header fw-semibold">⚙️ Tope de crédito por cliente</div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Cliente</th><th>Documento</th>
                    <th className="text-end">Deuda actual</th>
                    <th className="text-end">Tope de crédito</th>
                    <th className="text-end">Disponible</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id}>
                      <td className="fw-semibold">{c.full_name}</td>
                      <td className="text-muted small">{c.doc_type}: {c.doc_number}</td>
                      <td className="text-end text-danger fw-semibold">
                        {c.credit_balance > 0 ? fmt(c.credit_balance) : <span className="text-muted">$0</span>}
                      </td>
                      <td className="text-end">
                        {c.credit_limit > 0
                          ? <span className="fw-bold text-success">{fmt(c.credit_limit)}</span>
                          : <span className="badge bg-secondary">Sin crédito</span>}
                      </td>
                      <td className="text-end text-muted">
                        {c.credit_limit > 0 ? fmt(Math.max(0, c.credit_limit - c.credit_balance)) : '—'}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary"
                          onClick={() => { setTopeModal(c); setTopeValor(String(c.credit_limit||'')); }}>
                          ✏️ Configurar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Modal Facturas ── */}
        {facturasModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,.5)', zIndex:9998}}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f', color:'#fff'}}>
                  <h5 className="modal-title fw-bold">🧾 Facturas — {facturasModal.full_name}</h5>
                  <div className="ms-3 badge bg-danger fs-6">{fmt(facturasModal.credit_balance)} pendiente</div>
                  <button className="btn-close btn-close-white ms-auto" onClick={() => setFacturasModal(null)} />
                </div>
                <div className="modal-body p-0">
                  {loadingFact ? (
                    <div className="text-center py-4"><div className="spinner-border"/></div>
                  ) : !facturas.length ? (
                    <div className="text-center text-muted py-5">
                      <div className="fs-2">✅</div><div>No hay facturas registradas</div>
                    </div>
                  ) : (
                    <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                      <thead className="table-light">
                        <tr>
                          <th>Factura #</th><th>Fecha</th><th>Estado</th>
                          <th className="text-end">Total</th>
                          <th className="text-end text-success">Abonado</th>
                          <th className="text-end text-danger">Pendiente</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {facturas.map(f => {
                          const badge = ESTADO_BADGE[f.estado] || ESTADO_BADGE.pendiente;
                          return (
                            <tr key={f.sale_id} style={{ background: f.estado==='pagada'?'#f0fdf4':f.estado==='parcial'?'#fffbeb':'' }}>
                              <td className="fw-semibold">#{f.sale_id}</td>
                              <td className="text-muted">{fmtDate(f.date)}</td>
                              <td><span className={`badge ${badge.cls}`}>{badge.label}</span></td>
                              <td className="text-end">{fmt(f.total)}</td>
                              <td className="text-end text-success">{fmt(f.abonado)}</td>
                              <td className="text-end fw-bold text-danger">{fmt(f.pendiente)}</td>
                              <td>
                                {f.estado !== 'pagada' && (
                                  <button className="btn btn-sm btn-success"
                                    onClick={() => {
                                      setAbonoModal(facturasModal);
                                      setAbonoFactura(f);
                                      setAbonoMonto(String(f.pendiente));
                                      setAbonoNota(`Pago factura #${f.sale_id}`);
                                      setFacturasModal(null);
                                    }}>
                                    💵 Pagar
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="table-light fw-bold">
                        <tr>
                          <td colSpan="3">Total</td>
                          <td className="text-end">{fmt(facturas.reduce((a,f)=>a+f.total,0))}</td>
                          <td className="text-end text-success">{fmt(facturas.reduce((a,f)=>a+f.abonado,0))}</td>
                          <td className="text-end text-danger">{fmt(facturas.reduce((a,f)=>a+f.pendiente,0))}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-success"
                    onClick={() => {
                      setAbonoModal(facturasModal);
                      setAbonoFactura(null);
                      setAbonoMonto('');
                      setAbonoNota('Abono general');
                      setFacturasModal(null);
                    }}>
                    💵 Abono general (FIFO)
                  </button>
                  <button className="btn btn-secondary" onClick={() => setFacturasModal(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Abono / Pago ── */}
        {abonoModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,.5)', zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#059669', color:'#fff'}}>
                  <h5 className="modal-title fw-bold">
                    {abonoFactura ? `🧾 Pago factura #${abonoFactura.sale_id}` : '💵 Abono general'}
                  </h5>
                  <button className="btn-close btn-close-white" onClick={() => { setAbonoModal(null); setAbonoFactura(null); }} />
                </div>
                <form onSubmit={handleAbono}>
                  <div className="modal-body">
                    {/* Resumen cliente */}
                    <div className="p-3 rounded mb-3" style={{background:'#f0fdf4', border:'1px solid #bbf7d0'}}>
                      <div className="fw-bold">{abonoModal.full_name}</div>
                      <div className="d-flex gap-4 mt-1" style={{fontSize:13}}>
                        <span>Deuda total: <strong className="text-danger">{fmt(abonoModal.credit_balance)}</strong></span>
                        {abonoModal.credit_limit > 0 && <span>Tope: <strong>{fmt(abonoModal.credit_limit)}</strong></span>}
                      </div>
                    </div>

                    {/* Info factura si es pago específico */}
                    {abonoFactura && (
                      <div className="p-3 rounded mb-3" style={{background:'#fffbeb', border:'1px solid #fde68a'}}>
                        <div className="fw-semibold">Factura #{abonoFactura.sale_id} — {fmtDate(abonoFactura.date)}</div>
                        <div className="d-flex gap-4 mt-1" style={{fontSize:13}}>
                          <span>Total: {fmt(abonoFactura.total)}</span>
                          <span>Abonado: <span className="text-success">{fmt(abonoFactura.abonado)}</span></span>
                          <span>Pendiente: <span className="text-danger fw-bold">{fmt(abonoFactura.pendiente)}</span></span>
                        </div>
                      </div>
                    )}

                    {/* Info FIFO */}
                    {!abonoFactura && (
                      <div className="alert alert-info py-2 mb-3" style={{fontSize:12}}>
                        💡 El abono se aplicará automáticamente a las facturas más antiguas primero (FIFO).
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="form-label fw-semibold">Monto del {abonoFactura ? 'pago' : 'abono'} *</label>
                      <div className="input-group input-group-lg">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="1" step="1"
                          max={abonoFactura ? abonoFactura.pendiente : abonoModal.credit_balance}
                          placeholder="0" value={abonoMonto}
                          onChange={e => setAbonoMonto(e.target.value)} autoFocus required />
                      </div>
                      {abonoFactura && (
                        <button type="button" className="btn btn-sm btn-outline-success mt-2"
                          onClick={() => setAbonoMonto(String(abonoFactura.pendiente))}>
                          Pagar monto exacto ({fmt(abonoFactura.pendiente)})
                        </button>
                      )}
                      <div className="form-text text-muted">
                        Máximo: {fmt(abonoFactura ? abonoFactura.pendiente : abonoModal.credit_balance)}
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold">Nota</label>
                      <input className="form-control" placeholder="Ej: Pago en efectivo"
                        value={abonoNota} onChange={e => setAbonoNota(e.target.value)} />
                    </div>

                    {/* Preview saldo */}
                    {abonoMonto && parseFloat(abonoMonto) > 0 && (
                      <div className="p-2 rounded" style={{background:'#f0fdf4', fontSize:13}}>
                        Deuda total restante tras el {abonoFactura ? 'pago' : 'abono'}:{' '}
                        <strong className="text-success">
                          {fmt(Math.max(0, parseFloat(abonoModal.credit_balance) - parseFloat(abonoMonto||0)))}
                        </strong>
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary"
                      onClick={() => { setAbonoModal(null); setAbonoFactura(null); }}>Cancelar</button>
                    <button type="submit" className="btn btn-success fw-bold" disabled={loading}>
                      {loading ? 'Guardando...' : `✅ Registrar ${abonoFactura ? 'pago' : 'abono'}`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Historial ── */}
        {histModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,.5)', zIndex:9999}}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">📋 Historial — {histModal.full_name}</h5>
                  <button className="btn-close" onClick={() => setHistModal(null)} />
                </div>
                <div className="modal-body p-0">
                  <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                    <thead className="table-light">
                      <tr><th>Fecha</th><th>Tipo</th><th className="text-end">Monto</th><th>Nota</th><th>Factura #</th></tr>
                    </thead>
                    <tbody>
                      {!histTxs.length
                        ? <tr><td colSpan="5" className="text-center text-muted py-4">Sin movimientos</td></tr>
                        : histTxs.map(tx => (
                          <tr key={tx.id}>
                            <td className="text-muted">{tx.created_at?.slice(0,16).replace('T',' ')}</td>
                            <td>
                              {tx.type === 'credito'
                                ? <span className="badge bg-danger">💸 Crédito</span>
                                : <span className="badge bg-success">💵 Abono</span>}
                            </td>
                            <td className={`text-end fw-bold ${tx.type==='credito'?'text-danger':'text-success'}`}>
                              {tx.type==='credito'?'+':'-'}{fmt(tx.amount)}
                            </td>
                            <td className="text-muted">{tx.note || '—'}</td>
                            <td className="text-muted">{tx.sale_id ? `#${tx.sale_id}` : '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setHistModal(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal Tope ── */}
        {topeModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,.5)', zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">⚙️ Tope de crédito — {topeModal.full_name}</h5>
                  <button className="btn-close" onClick={() => setTopeModal(null)} />
                </div>
                <form onSubmit={handleTope}>
                  <div className="modal-body">
                    <p className="text-muted small mb-3">
                      El cliente puede comprar a crédito hasta este monto. Pon 0 para desactivar el crédito.
                    </p>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Tope máximo de crédito</label>
                      <div className="input-group input-group-lg">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="0" step="1000"
                          placeholder="Ej: 200000" value={topeValor}
                          onChange={e => setTopeValor(e.target.value)} autoFocus required />
                      </div>
                    </div>
                    {topeModal.credit_balance > 0 && (
                      <div className="alert alert-warning py-2" style={{fontSize:12}}>
                        ⚠️ Este cliente tiene deuda activa de {fmt(topeModal.credit_balance)}
                      </div>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setTopeModal(null)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={loading}>
                      {loading ? 'Guardando...' : '✅ Guardar tope'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Comprobante ── */}
        {comprobante && <Comprobante data={comprobante} onClose={() => setComprobante(null)} />}

      </main>
    </div>
  );
};

export default Cartera;