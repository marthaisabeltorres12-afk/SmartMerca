import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { returnService } from '../../services/returnService';
import 'bootstrap/dist/css/bootstrap.min.css';

const fmtMoney = (n) => Number(n).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });

const Returns = () => {
  const { token } = useAuth();
  const [returns,       setReturns]       = useState([]);
  const [saleId,        setSaleId]        = useState('');
  const [sale,          setSale]          = useState(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [reason,        setReason]        = useState('');
  const [mode,          setMode]          = useState('dinero'); // 'dinero' | 'cambio'
  const [alert,         setAlert]         = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [searching,     setSearching]     = useState(false);
  const [tab,           setTab]           = useState('nueva');
  const [policy,        setPolicy]        = useState(null); // política del negocio

  // Cargar historial y política al iniciar
  const load = async () => {
    try { setReturns(await returnService.getAll(token)); } catch(e) {}
  };

  useEffect(() => {
    load();
    // Cargar política del negocio
    fetch('http://localhost:5000/api/policy/', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then(p => {
      if (p) {
        setPolicy(p);
        // Preseleccionar modo según política
        if (p.return_mode === 'dinero') setMode('dinero');
        else if (p.return_mode === 'cambio') setMode('cambio');
      }
    }).catch(() => {});
  }, [token]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const handleSearchSale = async () => {
    if (!saleId) { showAlert('danger','Ingresa el número de venta'); return; }
    setSearching(true);
    try {
      const s = await returnService.getSale(parseInt(saleId), token);
      setSale(s);
      setSelectedItems({});
    } catch(e) { showAlert('danger', `Venta #${saleId} no encontrada`); setSale(null); }
    finally { setSearching(false); }
  };

  const toggleItem = (item) => {
    setSelectedItems(prev => {
      if (prev[item.product_id]) {
        const { [item.product_id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.product_id]: { ...item, returnQty: item.quantity } };
    });
  };

  const updateQty = (productId, qty) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: { ...prev[productId], returnQty: qty }
    }));
  };

  const handleSubmit = async () => {
    const items = Object.values(selectedItems).filter(i => i.returnQty > 0);
    if (items.length === 0) { showAlert('danger','Selecciona al menos un producto'); return; }
    // Validar motivo obligatorio según política
    if (policy?.return_reason_required && !reason) {
      showAlert('danger','El motivo de la devolución es obligatorio');
      return;
    }
    setLoading(true);
    try {
      await returnService.create({
        sale_id: sale.id,
        reason,
        mode,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.returnQty, price: i.price }))
      }, token);
      showAlert('success', '✅ Devolución registrada correctamente');
      setSale(null); setSaleId(''); setSelectedItems({}); setReason('');
      load();
      setTab('historial');
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  const totalDevolucion = Object.values(selectedItems).reduce((a,i) => a + (i.price * i.returnQty), 0);

  // Etiqueta de modo de devolución según política
  const modeLabel = {
    dinero: '💵 Devolución en dinero',
    cambio: '🔄 Cambio por otro producto',
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>
        <h4 className="fw-bold mb-1">↩️ Devoluciones</h4>
        <p className="text-muted mb-4">Registra devoluciones de productos y revierte el stock</p>

        {/* Banner de política activa */}
        {policy && (
          <div className="alert alert-info py-2 mb-4 d-flex align-items-center gap-2" style={{ fontSize:13 }}>
            <i className="bi bi-info-circle-fill"></i>
            <span>
              Política activa: <strong>
                {policy.return_mode === 'dinero' ? 'Solo devolución en dinero' :
                 policy.return_mode === 'cambio' ? 'Solo cambio por otro producto' :
                 'Devolución en dinero o cambio'}
              </strong>
              {policy.return_reason_required && <span className="ms-2">— Motivo <strong>obligatorio</strong></span>}
              {policy.return_max_days && <span className="ms-2">— Máx. <strong>{policy.return_max_days} días</strong> desde la compra</span>}
            </span>
          </div>
        )}

        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        {/* Tabs */}
        <div className="btn-group mb-4">
          <button className={`btn btn-sm ${tab==='nueva' ? 'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('nueva')}>
            ↩️ Nueva Devolución
          </button>
          <button className={`btn btn-sm ${tab==='historial' ? 'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('historial')}>
            📜 Historial ({returns.length})
          </button>
        </div>

        {tab === 'nueva' && (
          <div className="row g-4">
            {/* Panel izquierdo */}
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
                <div className="card-header border-0 fw-bold bg-white" style={{ borderRadius:'12px 12px 0 0' }}>
                  🔍 Buscar Venta
                </div>
                <div className="card-body">
                  <label className="form-label small fw-semibold">Número de ticket / venta</label>
                  <div className="input-group mb-3">
                    <span className="input-group-text">#</span>
                    <input type="number" className="form-control" placeholder="000001"
                      value={saleId} onChange={e=>setSaleId(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && handleSearchSale()} />
                    <button className="btn btn-dark" onClick={handleSearchSale} disabled={searching}>
                      {searching ? '...' : 'Buscar'}
                    </button>
                  </div>

                  {sale && (
                    <>
                      {/* Info de la venta */}
                      <div className="p-3 rounded mb-3" style={{ background:'#f0fff4' }}>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted small">Venta</span>
                          <span className="fw-bold">#{String(sale.id).padStart(6,'0')}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted small">Fecha</span>
                          <span className="small">{sale.created_at?.slice(0,10)}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted small">Cajero</span>
                          <span className="small">{sale.cashier}</span>
                        </div>
                        {sale.customer && (
                          <div className="d-flex justify-content-between">
                            <span className="text-muted small">Cliente</span>
                            <span className="small">{sale.customer.full_name}</span>
                          </div>
                        )}
                        <div className="d-flex justify-content-between mt-1">
                          <span className="text-muted small">Total venta</span>
                          <span className="fw-bold text-success">{fmtMoney(sale.total)}</span>
                        </div>
                      </div>

                      {/* Modo de devolución — solo si política permite ambos */}
                      {(!policy || policy.return_mode === 'ambos') && (
                        <div className="mb-3">
                          <label className="form-label small fw-semibold">Tipo de devolución</label>
                          <div className="d-flex gap-2">
                            {[
                              { val: 'dinero', lb: '💵 En dinero' },
                              { val: 'cambio', lb: '🔄 Cambio' },
                            ].map(opt => (
                              <button key={opt.val} type="button"
                                className={`btn btn-sm flex-fill ${mode === opt.val ? 'btn-primary' : 'btn-outline-secondary'}`}
                                onClick={() => setMode(opt.val)}>
                                {opt.lb}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Si la política fija el modo, solo mostramos etiqueta */}
                      {policy && policy.return_mode !== 'ambos' && (
                        <div className="mb-3 p-2 rounded" style={{ background:'#f1f5f9', fontSize:13 }}>
                          <i className="bi bi-lock-fill me-1 text-muted"></i>
                          Modo fijo: <strong>{modeLabel[mode]}</strong>
                        </div>
                      )}

                      {/* Motivo */}
                      <label className="form-label small fw-semibold">
                        Motivo de devolución {policy?.return_reason_required ? <span className="text-danger">*</span> : <span className="text-muted">(opcional)</span>}
                      </label>
                      <select className="form-select mb-3" value={reason} onChange={e=>setReason(e.target.value)}>
                        <option value="">— Seleccionar motivo —</option>
                        <option value="Producto dañado">Producto dañado</option>
                        <option value="Producto vencido">Producto vencido</option>
                        <option value="Error en la venta">Error en la venta</option>
                        <option value="Insatisfacción del cliente">Insatisfacción del cliente</option>
                        <option value="Producto incorrecto">Producto incorrecto</option>
                        <option value="Otro">Otro</option>
                      </select>

                      {/* Resumen */}
                      {Object.keys(selectedItems).length > 0 && (
                        <div className="p-2 rounded mb-3" style={{ background:'#fff8f0' }}>
                          <div className="d-flex justify-content-between fw-bold">
                            <span>Total a devolver:</span>
                            <span className="text-danger">{fmtMoney(totalDevolucion)}</span>
                          </div>
                          <div className="text-muted small mt-1">
                            Modalidad: <strong>{modeLabel[mode]}</strong>
                          </div>
                          {sale.customer && (
                            <div className="text-muted small">
                              ⭐ Se restarán {Math.floor(totalDevolucion/1000)} puntos al cliente
                            </div>
                          )}
                        </div>
                      )}

                      <button className="btn btn-danger w-100 fw-bold" onClick={handleSubmit}
                        disabled={loading || Object.keys(selectedItems).length === 0}>
                        {loading ? 'Procesando...' : '↩️ Confirmar Devolución'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de productos */}
            {sale && (
              <div className="col-lg-7">
                <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
                  <div className="card-header border-0 fw-bold bg-white" style={{ borderRadius:'12px 12px 0 0' }}>
                    📦 Selecciona los productos a devolver
                  </div>
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width:40 }}></th>
                          <th>Producto</th>
                          <th className="text-center">Cant. vendida</th>
                          <th className="text-center">Cant. a devolver</th>
                          <th className="text-end">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items?.map(item => {
                          const sel = selectedItems[item.product_id];
                          return (
                            <tr key={item.product_id} style={{ background: sel ? '#f0fff4' : '' }}>
                              <td>
                                <input type="checkbox" className="form-check-input"
                                  checked={!!sel} onChange={() => toggleItem(item)} />
                              </td>
                              <td className="fw-semibold small">{item.product}</td>
                              <td className="text-center">
                                <span className="badge bg-secondary">{item.quantity}</span>
                              </td>
                              <td className="text-center">
                                {sel ? (
                                  <input type="number" className="form-control form-control-sm text-center"
                                    style={{ width:70, margin:'0 auto' }}
                                    min="0.001" max={item.quantity} step="0.001"
                                    value={sel.returnQty}
                                    onChange={e => updateQty(item.product_id, parseFloat(e.target.value)||0)} />
                                ) : <span className="text-muted">—</span>}
                              </td>
                              <td className="text-end small">
                                {sel ? <span className="text-danger fw-bold">{fmtMoney(item.price * sel.returnQty)}</span>
                                      : fmtMoney(item.subtotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'historial' && (
          <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Venta orig.</th>
                    <th>Cajero</th>
                    <th>Cliente</th>
                    <th>Motivo</th>
                    <th>Modalidad</th>
                    <th>Productos</th>
                    <th className="text-end">Total devuelto</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.length === 0
                    ? <tr><td colSpan="9" className="text-center text-muted py-4">Sin devoluciones registradas</td></tr>
                    : returns.map((r,i) => (
                      <tr key={r.id}>
                        <td><span className="badge bg-secondary">{i+1}</span></td>
                        <td className="fw-semibold">#{String(r.sale_id).padStart(6,'0')}</td>
                        <td>{r.cashier}</td>
                        <td>{r.customer || '—'}</td>
                        <td className="text-muted small">{r.reason || '—'}</td>
                        <td>
                          <span className={`badge ${r.mode === 'cambio' ? 'bg-info text-dark' : 'bg-success'}`}>
                            {r.mode === 'cambio' ? '🔄 Cambio' : '💵 Dinero'}
                          </span>
                        </td>
                        <td className="text-muted small">
                          {r.items?.map(i=>i.product_name).join(', ').slice(0,40)}
                        </td>
                        <td className="text-end text-danger fw-bold">{fmtMoney(r.total)}</td>
                        <td className="text-muted small">{r.created_at?.slice(0,10)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Returns;