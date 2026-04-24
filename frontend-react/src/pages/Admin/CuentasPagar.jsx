import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });

const statusBadge = s => {
  if (s === 'pagado')   return <span className="badge bg-success">✅ Pagado</span>;
  if (s === 'parcial')  return <span className="badge bg-warning text-dark">⏳ Parcial</span>;
  if (s === 'vencido')  return <span className="badge bg-danger">🔴 Vencido</span>;
  return <span className="badge bg-secondary">⏱ Pendiente</span>;
};

const diasVencimiento = (fecha) => {
  const hoy  = new Date(); hoy.setHours(0,0,0,0);
  const venc = new Date(fecha + 'T00:00:00');
  const diff = Math.round((venc - hoy) / (1000*60*60*24));
  if (diff < 0)  return <span className="text-danger fw-bold">Venció hace {Math.abs(diff)} días</span>;
  if (diff === 0) return <span className="text-danger fw-bold">Vence hoy</span>;
  if (diff <= 3)  return <span className="text-warning fw-bold">Vence en {diff} días</span>;
  return <span className="text-muted">En {diff} días</span>;
};

const EMPTY_INVOICE = { supplier_id:'', numero_factura_proveedor:'', valor_total:'', fecha_factura:'', fecha_vencimiento:'', notas:'' };
const EMPTY_PAYMENT = { monto:'', fecha_pago: new Date().toISOString().slice(0,10), metodo_pago:'transferencia', referencia_bancaria:'' };

const CuentasPagar = () => {
  const { token } = useAuth();
  const [facturas,   setFacturas]   = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [cartera,    setCartera]    = useState([]);
  const [tab,        setTab]        = useState('facturas');
  const [filterStatus, setFilterStatus] = useState('');
  const [alert,      setAlert]      = useState(null);
  const [loading,    setLoading]    = useState(false);

  // Modales
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm,      setInvoiceForm]      = useState(EMPTY_INVOICE);
  const [paymentModal,     setPaymentModal]     = useState(null); // factura seleccionada
  const [paymentForm,      setPaymentForm]      = useState(EMPTY_PAYMENT);
  const [expanded,         setExpanded]         = useState(null);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const [facts, sups, cart] = await Promise.all([
        apiFetch('/supplier-invoices/', {}, token),
        apiFetch('/suppliers/', {}, token),
        apiFetch('/supplier-invoices/cartera', {}, token),
      ]);
      setFacturas(Array.isArray(facts) ? facts : []);
      setSuppliers(Array.isArray(sups) ? sups : []);
      setCartera(Array.isArray(cart) ? cart : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleCreateInvoice = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiFetch('/supplier-invoices/', { method:'POST', body: JSON.stringify(invoiceForm) }, token);
      showAlert('success', 'Factura registrada correctamente');
      setShowInvoiceModal(false);
      setInvoiceForm(EMPTY_INVOICE);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const handlePayment = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await apiFetch(`/supplier-invoices/${paymentModal.id}/payment`, { method:'POST', body: JSON.stringify(paymentForm) }, token);
      showAlert('success', 'Pago registrado correctamente');
      setPaymentModal(null);
      setPaymentForm(EMPTY_PAYMENT);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const filtered = filterStatus ? facturas.filter(f => f.status === filterStatus) : facturas;
  const totalDeuda = cartera.reduce((a, c) => a + c.total_deuda, 0);

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold mb-0">📋 Cuentas por Pagar</h4>
            <p className="text-muted small mb-0">
              Las facturas se agregan automáticamente desde <strong>Inventario → Registrar Pedido</strong> cuando marcas "Factura quedó pendiente de pago".
            </p>
          </div>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2`}>{alert.msg}</div>}

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { label:'Total deuda', val: fmt(totalDeuda), color:'danger' },
            { label:'Pendientes',  val: facturas.filter(f=>f.status==='pendiente').length, color:'secondary' },
            { label:'Parciales',   val: facturas.filter(f=>f.status==='parcial').length,   color:'warning' },
            { label:'Vencidas',    val: facturas.filter(f=>f.status==='vencido').length,   color:'danger' },
          ].map((k,i) => (
            <div key={i} className="col-6 col-md-3">
              <div className={`card border-${k.color} border-2 text-center`}>
                <div className="card-body py-2">
                  <div className={`fs-4 fw-bold text-${k.color}`}>{k.val}</div>
                  <div className="text-muted small">{k.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          {[['facturas','📄 Facturas'],['cartera','🏦 Cartera por proveedor']].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* Tab facturas */}
        {tab === 'facturas' && (
          <div>
            <div className="d-flex gap-2 mb-3 flex-wrap">
              {['','pendiente','parcial','vencido','pagado'].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  className={`btn btn-sm ${filterStatus===s?'btn-dark':'btn-outline-secondary'}`}>
                  {s===''?'Todas':s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
            </div>
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                  <thead className="table-light">
                    <tr>
                      <th>Proveedor</th><th>Factura</th><th>Fecha</th>
                      <th className="text-end">Total</th><th className="text-end">Pagado</th>
                      <th className="text-end">Saldo</th><th>Vencimiento</th>
                      <th>Estado</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filtered.length ? (
                      <tr><td colSpan="9" className="text-center text-muted py-4">Sin facturas registradas</td></tr>
                    ) : filtered.map(f => (
                      <React.Fragment key={f.id}>
                        <tr style={{background: f.status==='vencido'?'#fff5f5':f.status==='pagado'?'#f0fff4':''}}>
                          <td className="fw-semibold">{f.supplier_name}</td>
                          <td className="text-muted">{f.numero_factura_proveedor}</td>
                          <td className="text-muted">{f.fecha_factura}</td>
                          <td className="text-end">{fmt(f.valor_total)}</td>
                          <td className="text-end text-success">{fmt(f.valor_pagado)}</td>
                          <td className="text-end fw-bold text-danger">{fmt(f.saldo)}</td>
                          <td>{diasVencimiento(f.fecha_vencimiento)}</td>
                          <td>{statusBadge(f.status)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-sm btn-outline-secondary py-0 px-2"
                                onClick={()=>setExpanded(expanded===f.id?null:f.id)}>
                                {expanded===f.id?'▲':'▼'}
                              </button>
                              {f.status !== 'pagado' && (
                                <button className="btn btn-sm btn-outline-success py-0 px-2"
                                  onClick={()=>{ setPaymentModal(f); setPaymentForm({...EMPTY_PAYMENT, monto: f.saldo}); }}>
                                  💳 Pagar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded===f.id && (
                          <tr><td colSpan="9" className="p-0">
                            <div className="bg-light p-3">
                              {f.notas && <div className="text-muted small mb-2">📝 {f.notas}</div>}
                              {!f.payments?.length ? (
                                <div className="text-muted small">Sin pagos registrados</div>
                              ) : (
                                <table className="table table-sm mb-0" style={{fontSize:12}}>
                                  <thead><tr><th>Fecha</th><th>Método</th><th className="text-end">Monto</th><th>Referencia</th><th>Registrado por</th></tr></thead>
                                  <tbody>
                                    {f.payments.map(p=>(
                                      <tr key={p.id}>
                                        <td>{p.fecha_pago}</td>
                                        <td className="text-capitalize">{p.metodo_pago}</td>
                                        <td className="text-end text-success fw-bold">{fmt(p.monto)}</td>
                                        <td className="text-muted">{p.referencia_bancaria||'—'}</td>
                                        <td className="text-muted">{p.registrado_por_nombre}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab cartera */}
        {tab === 'cartera' && (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                <thead className="table-light">
                  <tr><th>Proveedor</th><th className="text-center">Facturas pendientes</th><th className="text-center">Vencidas</th><th className="text-end">Deuda total</th></tr>
                </thead>
                <tbody>
                  {!cartera.length ? (
                    <tr><td colSpan="4" className="text-center text-muted py-4">Sin deudas pendientes</td></tr>
                  ) : cartera.map(c=>(
                    <tr key={c.supplier_id}>
                      <td className="fw-semibold">🏭 {c.supplier_name}</td>
                      <td className="text-center">{c.facturas}</td>
                      <td className="text-center">
                        {c.vencidas > 0
                          ? <span className="badge bg-danger">{c.vencidas}</span>
                          : <span className="text-muted">0</span>}
                      </td>
                      <td className="text-end fw-bold text-danger fs-6">{fmt(c.total_deuda)}</td>
                    </tr>
                  ))}
                </tbody>
                {cartera.length > 0 && (
                  <tfoot className="table-light">
                    <tr>
                      <td colSpan="3" className="fw-bold text-end">Total deuda:</td>
                      <td className="text-end fw-bold text-danger fs-6">{fmt(totalDeuda)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Modal nueva factura */}
        {showInvoiceModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">📄 Registrar Factura de Proveedor</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setShowInvoiceModal(false)} />
                </div>
                <form onSubmit={handleCreateInvoice}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Proveedor *</label>
                      <select className="form-select" required value={invoiceForm.supplier_id}
                        onChange={e=>setInvoiceForm({...invoiceForm, supplier_id:e.target.value})}>
                        <option value="">— Seleccionar —</option>
                        {suppliers.map(s=><option key={s.id} value={s.id}>{s.company_name||s.name}</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Número de factura *</label>
                      <input className="form-control" required value={invoiceForm.numero_factura_proveedor}
                        onChange={e=>setInvoiceForm({...invoiceForm, numero_factura_proveedor:e.target.value})}
                        placeholder="Ej: FAC-2026-001" />
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">Valor total *</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input type="number" className="form-control" required min="1"
                            value={invoiceForm.valor_total}
                            onChange={e=>setInvoiceForm({...invoiceForm, valor_total:e.target.value})} />
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Fecha factura *</label>
                        <input type="date" className="form-control" required value={invoiceForm.fecha_factura}
                          onChange={e=>setInvoiceForm({...invoiceForm, fecha_factura:e.target.value})} />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Fecha vencimiento *</label>
                      <input type="date" className="form-control" required value={invoiceForm.fecha_vencimiento}
                        onChange={e=>setInvoiceForm({...invoiceForm, fecha_vencimiento:e.target.value})} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Notas</label>
                      <textarea className="form-control" rows={2} value={invoiceForm.notas}
                        onChange={e=>setInvoiceForm({...invoiceForm, notas:e.target.value})}
                        placeholder="Observaciones opcionales..." />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowInvoiceModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={loading}>
                      {loading?'Guardando...':'✅ Registrar factura'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal pago */}
        {paymentModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#166534',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">💳 Registrar Pago</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setPaymentModal(null)} />
                </div>
                <form onSubmit={handlePayment}>
                  <div className="modal-body">
                    <div className="alert alert-info py-2 mb-3" style={{fontSize:13}}>
                      <strong>{paymentModal.supplier_name}</strong> — Factura {paymentModal.numero_factura_proveedor}<br/>
                      Saldo pendiente: <strong>{fmt(paymentModal.saldo)}</strong>
                    </div>
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label className="form-label fw-semibold">Monto *</label>
                        <div className="input-group">
                          <span className="input-group-text">$</span>
                          <input type="number" className="form-control" required min="1"
                            value={paymentForm.monto}
                            onChange={e=>setPaymentForm({...paymentForm, monto:e.target.value})} />
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-semibold">Fecha pago *</label>
                        <input type="date" className="form-control" required value={paymentForm.fecha_pago}
                          onChange={e=>setPaymentForm({...paymentForm, fecha_pago:e.target.value})} />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Método de pago *</label>
                      <select className="form-select" value={paymentForm.metodo_pago}
                        onChange={e=>setPaymentForm({...paymentForm, metodo_pago:e.target.value})}>
                        {['transferencia','efectivo','cheque','nequi','otro'].map(m=>(
                          <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Referencia bancaria</label>
                      <input className="form-control" value={paymentForm.referencia_bancaria}
                        onChange={e=>setPaymentForm({...paymentForm, referencia_bancaria:e.target.value})}
                        placeholder="Ej: TRF-9921" />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setPaymentModal(null)}>Cancelar</button>
                    <button type="submit" className="btn btn-success fw-bold" disabled={loading}>
                      {loading?'Guardando...':'✅ Registrar pago'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default CuentasPagar;