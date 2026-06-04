import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { returnService } from '../../services/returnService';
import { productService } from '../../services/productService';
import AuthModal from '../../components/AuthModal';
import 'bootstrap/dist/css/bootstrap.min.css';

const fmtMoney = (n) => Number(n).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtDate  = (s) => s ? new Date(s).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' }) : '—';

const Returns = () => {
  const { token }  = useAuth();
  const searchRef  = useRef();

  // ── Estado principal ───────────────────────────────────────────────────────
  const [returns,        setReturns]        = useState([]);
  const [products,       setProducts]       = useState([]);   // todos los productos
  const [saleId,         setSaleId]         = useState('');
  const [sale,           setSale]           = useState(null);
  const [selectedItems,  setSelectedItems]  = useState({});
  const [reason,         setReason]         = useState('');
  const [mode,           setMode]           = useState('dinero');
  const [alert,          setAlert]          = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [searching,      setSearching]      = useState(false);
  const [tab,            setTab]            = useState('nueva');
  const [policy,         setPolicy]         = useState(null);
  const [showPinModal,   setShowPinModal]   = useState(false);
  const [authorizedBy,   setAuthorizedBy]   = useState('');
  const [expandedReturn, setExpandedReturn] = useState(null);

  // ── Estado del producto a cambio ───────────────────────────────────────────
  const [exchangeQuery,   setExchangeQuery]   = useState('');   // texto de busqueda
  const [exchangeResults, setExchangeResults] = useState([]);   // resultados
  const [exchangeProduct, setExchangeProduct] = useState(null); // producto seleccionado
  const [exchangeQty,     setExchangeQty]     = useState(1);    // cantidad

  // ── Cargar datos iniciales ─────────────────────────────────────────────────
  const load = async () => {
    try { setReturns(await returnService.getAll(token)); } catch(e) {}
  };

  useEffect(() => {
    load();
    // Cargar todos los productos en memoria para búsqueda rápida
    productService.getAll(token)
      .then(data => setProducts(Array.isArray(data) ? data.filter(p => p.is_active !== false) : []))
      .catch(() => {});
    // Cargar política
    fetch('http://localhost:5000/api/policy/', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(p => {
        if (p) {
          setPolicy(p);
          if (p.return_mode === 'dinero') setMode('dinero');
          else if (p.return_mode === 'cambio') setMode('cambio');
        }
      }).catch(() => {});
  }, [token]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),5000); };

  // ── Buscar venta ───────────────────────────────────────────────────────────
  const handleSearchSale = async () => {
    if (!saleId) { showAlert('danger','Ingresa el número de venta'); return; }
    setSearching(true);
    try {
      const s = await returnService.getSale(parseInt(saleId), token);
      if (policy?.return_max_days) {
        const dias = Math.floor((Date.now() - new Date(s.created_at)) / 86400000);
        if (dias > policy.return_max_days) {
          showAlert('danger', `Esta venta supera los ${policy.return_max_days} días permitidos (hace ${dias} días)`);
          setSale(null); setSearching(false); return;
        }
      }
      setSale(s);
      setSelectedItems({});
      resetExchange();
      setAuthorizedBy('');
    } catch(e) { showAlert('danger', `Venta #${saleId} no encontrada`); setSale(null); }
    finally { setSearching(false); }
  };

  // ── Buscar producto a cambio ───────────────────────────────────────────────
  const handleExchangeKey = (e) => {
    const val = e.target.value;
    setExchangeQuery(val);
    setExchangeProduct(null);
    if (!val.trim()) { setExchangeResults([]); return; }
    const q = val.toLowerCase();
    const found = products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode === val.trim()
    ).slice(0, 8);
    setExchangeResults(found);
    // Si hay coincidencia exacta de barcode, seleccionar automáticamente
    const exact = products.find(p => p.barcode === val.trim());
    if (exact) selectExchangeProduct(exact);
  };

  const handleExchangeEnter = (e) => {
    if (e.key === 'Enter') {
      const exact = products.find(p => p.barcode === exchangeQuery.trim());
      if (exact) { selectExchangeProduct(exact); return; }
      if (exchangeResults.length === 1) selectExchangeProduct(exchangeResults[0]);
    }
  };

  const selectExchangeProduct = (product) => {
    setExchangeProduct(product);
    setExchangeQuery(product.name);
    setExchangeResults([]);
    setExchangeQty(1);
    setAuthorizedBy(''); // reset PIN si cambia el producto
  };

  const resetExchange = () => {
    setExchangeQuery('');
    setExchangeResults([]);
    setExchangeProduct(null);
    setExchangeQty(1);
  };

  // ── Carrito devoluciones ───────────────────────────────────────────────────
  const toggleItem = (item) => {
    setSelectedItems(prev => {
      if (prev[item.product_id]) {
        const { [item.product_id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.product_id]: { ...item, returnQty: item.quantity } };
    });
    setAuthorizedBy('');
  };

  const updateQty = (productId, qty) => {
    setSelectedItems(prev => ({ ...prev, [productId]: { ...prev[productId], returnQty: qty } }));
    setAuthorizedBy('');
  };

  // ── Calculos ───────────────────────────────────────────────────────────────
  const totalDevuelto   = Object.values(selectedItems).reduce((a,i) => a + (i.price * i.returnQty), 0);
  const itemsCount      = Object.keys(selectedItems).length;
  const precioEntregado = exchangeProduct ? (exchangeProduct.final_price ?? exchangeProduct.price) * exchangeQty : 0;
  const diferencia      = mode === 'cambio' ? precioEntregado - totalDevuelto : 0;
  // diferencia > 0 → cliente debe pagar más
  // diferencia < 0 → negocio devuelve dinero al cliente
  // diferencia = 0 → exacto

  // ── PIN ────────────────────────────────────────────────────────────────────
  const necesitaPin = () => {
    const pinMonto    = policy?.return_pin_monto    ?? 30000;
    const pinMultiple = policy?.return_pin_multiple ?? true;
    if (mode === 'dinero' && totalDevuelto > pinMonto) return true;
    if (pinMultiple && itemsCount > 1) return true;
    return false;
  };

  const razonPin = () => {
    const razones = [];
    const pinMonto = policy?.return_pin_monto ?? 30000;
    if (mode === 'dinero' && totalDevuelto > pinMonto) razones.push(`monto supera ${fmtMoney(pinMonto)}`);
    if ((policy?.return_pin_multiple ?? true) && itemsCount > 1) razones.push(`${itemsCount} productos`);
    return razones.join(' y ');
  };

  // ── Enviar devolución ──────────────────────────────────────────────────────
  const handleSubmit = () => {
    const items = Object.values(selectedItems).filter(i => i.returnQty > 0);
    if (items.length === 0) { showAlert('danger','Selecciona al menos un producto'); return; }
    if (policy?.return_reason_required && !reason) {
      showAlert('danger','El motivo de la devolución es obligatorio'); return;
    }
    if (mode === 'cambio' && !exchangeProduct) {
      showAlert('danger','Selecciona el producto que se entrega a cambio'); return;
    }
    if (mode === 'cambio' && exchangeProduct && exchangeProduct.stock < exchangeQty) {
      showAlert('danger', `Stock insuficiente de "${exchangeProduct.name}". Disponible: ${exchangeProduct.stock}`); return;
    }
    if (necesitaPin() && !authorizedBy) { setShowPinModal(true); return; }
    procesarDevolucion(authorizedBy);
  };

  const procesarDevolucion = async (adminName = '') => {
    const items = Object.values(selectedItems).filter(i => i.returnQty > 0);
    setLoading(true);
    try {
      await returnService.create({
        sale_id:             sale.id,
        reason,
        mode,
        exchange_product:    exchangeProduct?.name    || '',
        exchange_product_id: exchangeProduct?.id      || null,
        exchange_qty:        exchangeQty,
        exchange_price:      exchangeProduct ? (exchangeProduct.final_price ?? exchangeProduct.price) : 0,
        authorized_by:       adminName,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.returnQty, price: i.price }))
      }, token);
      showAlert('success', ' Devolución registrada correctamente');
      setSale(null); setSaleId(''); setSelectedItems({});
      setReason(''); resetExchange(); setAuthorizedBy('');
      load();
      setTab('historial');
    } catch(e) { showAlert('danger', e.message || 'Error al registrar la devolución'); }
    finally { setLoading(false); }
  };

const modeLabel = {
  dinero: (
    <>
      <i className="bi bi-cash-coin me-1"></i>
      En dinero
    </>
  ),
  cambio: (
    <>
      <i className="bi bi-arrow-left-right me-1"></i>
      Cambio de producto
    </>
  )
};

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>
       <h4 className="fw-bold mb-1">
  <i className="bi bi-arrow-return-left me-2"></i>
  Devoluciones
</h4>
        <p className="text-muted mb-4">Registra devoluciones de productos y revierte el stock</p>

        {/* Banner política */}
        {policy && (
          <div className="alert alert-info py-2 mb-4 d-flex align-items-center gap-2" style={{ fontSize:13 }}>
            <i className="bi bi-info-circle-fill"/>
            <span>
              Política: <strong>
                {policy.return_mode==='dinero' ? 'Solo devolución en dinero' :
                 policy.return_mode==='cambio' ? 'Solo cambio por otro producto' : 'Dinero o cambio'}
              </strong>
              {policy.return_reason_required && <span className="ms-2">— Motivo <strong>obligatorio</strong></span>}
              {policy.return_max_days && <span className="ms-2">— Máx. <strong>{policy.return_max_days} días</strong></span>}
              {policy.return_pin_monto > 0 && (
                <span className="ms-2">— PIN si dinero &gt; <strong>{fmtMoney(policy.return_pin_monto)}</strong>
                  {policy.return_pin_multiple && ' o varios productos'}
                </span>
              )}
            </span>
          </div>
        )}

        {alert && (
          <div className={`alert alert-${alert.type} alert-dismissible`}>
            {alert.msg}
            <button type="button" className="btn-close" onClick={()=>setAlert(null)}/>
          </div>
        )}

        {/* Tabs */}
        <div className="btn-group mb-4">
          <button className={`btn btn-sm ${tab==='nueva'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('nueva')}>
            <i className="bi bi-plus-circle me-1"></i>
             Nueva Devolución
          </button>
          <button className={`btn btn-sm ${tab==='historial'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setTab('historial')}>
            <i className="bi bi-card-list me-1"></i> Historial ({returns.length})
          </button>
        </div>

        {/* ── NUEVA DEVOLUCION ── */}
        {tab === 'nueva' && (
          <div className="row g-4">

            {/* Panel izquierdo — búsqueda y config */}
            <div className="col-lg-5">
              <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
                <div className="card-header border-0 fw-bold bg-white" style={{ borderRadius:'12px 12px 0 0' }}>
                  <i className="bi bi-search me-1"></i> Buscar Venta
                </div>
                <div className="card-body">
                  <div className="input-group mb-3">
                    <span className="input-group-text">#</span>
                    <input type="number" className="form-control" placeholder="Número de ticket"
                      value={saleId} onChange={e=>setSaleId(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && handleSearchSale()} />
                    <button className="btn btn-dark" onClick={handleSearchSale} disabled={searching}>
                      {searching ? '...' : 'Buscar'}
                    </button>
                  </div>

                  {sale && (
                    <>
                      {/* Info venta */}
                      <div className="p-3 rounded mb-3" style={{ background:'#f0fff4' }}>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted small">Venta</span>
                          <span className="fw-bold">#{String(sale.id).padStart(6,'0')}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span className="text-muted small">Fecha</span>
                          <span className="small">{fmtDate(sale.created_at)}</span>
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

                      {/* Modo */}
                      {(!policy || policy.return_mode === 'ambos') && (
                        <div className="mb-3">
                          <label className="form-label small fw-semibold">Tipo de devolución</label>
                          <div className="d-flex gap-2">
  {[
    {
      val: 'dinero',
      lb: (
        <>
          <i className="bi bi-cash-coin me-1"></i>
          En dinero
        </>
      )
    },
    {
      val: 'cambio',
      lb: (
        <>
          <i className="bi bi-arrow-left-right me-1"></i>
          Cambio
        </>
      )
    }
  ].map(opt => (
    <button
      key={opt.val}
      type="button"
      className={`btn btn-sm flex-fill ${
        mode === opt.val ? 'btn-primary' : 'btn-outline-secondary'
      }`}
      onClick={() => {
        setMode(opt.val);
        resetExchange();
        setAuthorizedBy('');
      }}
    >
      {opt.lb}
    </button>
  ))}
</div>
                        </div>
                      )}
                      {policy && policy.return_mode !== 'ambos' && (
                        <div className="mb-3 p-2 rounded" style={{ background:'#f1f5f9', fontSize:13 }}>
                          <i className="bi bi-lock-fill me-1 text-muted"/>
                          Modo fijo: <strong>{modeLabel[mode]}</strong>
                        </div>
                      )}

                      {/* ── MINI CARRITO PRODUCTO A CAMBIO ── */}
                      {mode === 'cambio' && (
                        <div className="mb-3">
                          <label className="form-label small fw-semibold bi-arrow-left-right">  Producto a entregar a cambio <span className="text-danger">*</span>
                          </label>

                          {/* Buscador */}
                          {!exchangeProduct && (
                            <div className="position-relative">
                              <input
                                ref={searchRef}
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Nombre o escanear código de barras..."
                                value={exchangeQuery}
                                onChange={handleExchangeKey}
                                onKeyDown={handleExchangeEnter}
                                autoComplete="off"
                              />
                              {/* Resultados */}
                              {exchangeResults.length > 0 && (
                                <div className="position-absolute w-100 bg-white border rounded shadow-sm"
                                  style={{ zIndex:999, top:'100%', maxHeight:200, overflowY:'auto' }}>
                                  {exchangeResults.map(p => (
                                    <div key={p.id}
                                      className="px-3 py-2 d-flex justify-content-between align-items-center"
                                      style={{ cursor:'pointer', borderBottom:'1px solid #f1f5f9', fontSize:13 }}
                                      onMouseDown={() => selectExchangeProduct(p)}>
                                      <div>
                                        <div className="fw-semibold">{p.name}</div>
                                        {p.barcode && <div className="text-muted bi-box-seam-fill" style={{ fontSize:11 }}> {p.barcode}</div>}
                                      </div>
                                      <div className="text-end">
                                        <div className="fw-bold text-success">{fmtMoney(p.final_price ?? p.price)}</div>
                                        <div className="text-muted" style={{ fontSize:11 }}>Stock: {p.stock}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Producto seleccionado — mini carrito */}
                          {exchangeProduct && (
                            <div className="border rounded p-3 mt-2" style={{ background:'#f0fff4' }}>
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <div className="fw-bold small">{exchangeProduct.name}</div>
                                  {exchangeProduct.barcode && (
                                    <div className="text-muted bi-box-seam-fill" style={{ fontSize:11 }}> {exchangeProduct.barcode}</div>
                                  )}
                                  <div className="text-success fw-semibold small mt-1">
                                    {fmtMoney(exchangeProduct.final_price ?? exchangeProduct.price)} / und
                                  </div>
                                  <div className="text-muted" style={{ fontSize:11 }}>
                                    Stock disponible: {exchangeProduct.stock}
                                  </div>
                                </div>
                                <button className="btn btn-sm btn-outline-danger" onClick={resetExchange}>✕</button>
                              </div>

                              {/* Cantidad */}
                              <div className="d-flex align-items-center gap-2 mt-3">
                                <label className="small fw-semibold mb-0">Cantidad:</label>
                                <button className="btn btn-sm btn-outline-secondary px-2 py-0"
                                  onClick={() => setExchangeQty(q => Math.max(1, q - 1))}>−</button>
                                <input type="number" className="form-control form-control-sm text-center"
                                  style={{ width:70 }} min="0.001" step="0.001"
                                  value={exchangeQty}
                                  onChange={e => setExchangeQty(parseFloat(e.target.value)||1)} />
                                <button className="btn btn-sm btn-outline-secondary px-2 py-0"
                                  onClick={() => setExchangeQty(q => q + 1)}>+</button>
                              </div>

                              {/* Total del producto a cambio */}
                              <div className="d-flex justify-content-between mt-2 pt-2 border-top">
                                <span className="small text-muted">Subtotal producto a cambio:</span>
                                <span className="fw-bold">{fmtMoney(precioEntregado)}</span>
                              </div>
                            </div>
                          )}

                          {/* Diferencia de precios */}
                          {exchangeProduct && itemsCount > 0 && (
                          <div
  className={`alert py-2 px-3 mt-2 mb-0 ${
    diferencia > 0 ? 'alert-warning' :
    diferencia < 0 ? 'alert-info' :
    'alert-success'
  }`}
  style={{ fontSize: 13 }}
>
  {diferencia > 0 && (
    <>
      <strong>
        <i className="bi bi-exclamation-triangle-fill me-1"></i>
        El cliente debe pagar {fmtMoney(diferencia)} adicional
      </strong>
      <div className="text-muted small">
        El producto a cambio cuesta más que el devuelto
      </div>
    </>
  )}

  {diferencia < 0 && (
    <>
      <strong>
        <i className="bi bi-cash-coin me-1"></i>
        Devolver {fmtMoney(Math.abs(diferencia))} al cliente
      </strong>
      <div className="text-muted small">
        El producto a cambio cuesta menos que el devuelto
      </div>
    </>
  )}

  {diferencia === 0 && (
    <strong>
      <i className="bi bi-check-circle-fill me-1"></i>
      Cambio exacto — sin diferencia de precio
    </strong>
  )}
</div>
                          )}
                        </div>
                      )}

                      {/* Motivo */}
                      <label className="form-label small fw-semibold">
                        Motivo {policy?.return_reason_required
                          ? <span className="text-danger">*</span>
                          : <span className="text-muted">(opcional)</span>}
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
                      {itemsCount > 0 && (
                        <div className="p-2 rounded mb-3" style={{ background:'#fff8f0' }}>
                          <div className="d-flex justify-content-between">
                            <span className="small text-muted">Productos devueltos:</span>
                            <span className="fw-bold text-danger">{fmtMoney(totalDevuelto)}</span>
                          </div>
                          {mode === 'cambio' && exchangeProduct && (
                            <div className="d-flex justify-content-between">
                              <span className="small text-muted">Producto a cambio:</span>
                              <span className="fw-bold">{fmtMoney(precioEntregado)}</span>
                            </div>
                          )}
                          {sale.customer && (
                           <div className="text-muted small mt-1">
  <i className="bi bi-star-fill me-1"></i>
  Se restarán {Math.floor(totalDevuelto / 1000)} puntos al cliente
</div>
                          )}
                          {necesitaPin() && !authorizedBy && (
  <div className="alert alert-warning py-1 px-2 mt-2 mb-0 small">
    <i className="bi bi-shield-lock me-1"></i>
    Requiere PIN del admin ({razonPin()})
  </div>
)}
                         {authorizedBy && (
  <div className="alert alert-success py-1 px-2 mt-2 mb-0 small">
    <i className="bi bi-check-circle-fill me-1"></i>
    Autorizado por: <strong>{authorizedBy}</strong>
  </div>
)}
                        </div>
                      )}

                     <button
  className="btn btn-danger w-100 fw-bold"
  onClick={handleSubmit}
  disabled={loading || itemsCount === 0}
>
  {loading ? (
    'Procesando...'
  ) : necesitaPin() && !authorizedBy ? (
    <>
      <i className="bi bi-shield-lock me-2"></i>
      Solicitar PIN y Confirmar
    </>
  ) : (
    <>
      <i className="bi bi-arrow-return-left me-2"></i>
      Confirmar Devolución
    </>
  )}
</button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Panel derecho — productos de la venta */}
            {sale && (
              <div className="col-lg-7">
                <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
                  <div className="card-header border-0 fw-bold bg-white bi-box-seam-fill" style={{ borderRadius:'12px 12px 0 0' }}>  Selecciona los productos a devolver
                  </div>
                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width:40 }}/>
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
                                {sel
                                  ? <span className="text-danger fw-bold">{fmtMoney(item.price * sel.returnQty)}</span>
                                  : fmtMoney(item.subtotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {itemsCount > 0 && (
                        <tfoot className="table-light">
                          <tr>
                            <td colSpan="4" className="text-end fw-bold">Total devuelto:</td>
                            <td className="text-end fw-bold text-danger">{fmtMoney(totalDevuelto)}</td>
                          </tr>
                          {mode === 'cambio' && exchangeProduct && (
                            <>
                              <tr>
                                <td colSpan="4" className="text-end fw-bold">Producto a cambio:</td>
                                <td className="text-end fw-bold">{fmtMoney(precioEntregado)}</td>
                              </tr>
                              <tr style={{ background: diferencia > 0 ? '#fef3c7' : diferencia < 0 ? '#dbeafe' : '#dcfce7' }}>
                                <td colSpan="4" className="text-end fw-bold">
  {diferencia > 0 ? (
    <>
      <i className="bi bi-exclamation-triangle-fill me-1"></i>
      Cliente paga:
    </>
  ) : diferencia < 0 ? (
    <>
      <i className="bi bi-cash-coin me-1"></i>
      Devolver al cliente:
    </>
  ) : (
    <>
      <i className="bi bi-check-circle-fill me-1"></i>
      Sin diferencia:
    </>
  )}
</td>
                                <td className="text-end fw-bold">
                                  {diferencia !== 0 ? fmtMoney(Math.abs(diferencia)) : '$0'}
                                </td>
                              </tr>
                            </>
                          )}
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORIAL ── */}
        {tab === 'historial' && (
          <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Venta</th>
                    <th>Cajero</th>
                    <th>Motivo</th>
                    <th>Modalidad</th>
                    <th>Autorizado por</th>
                    <th className="text-end">Total</th>
                    <th>Fecha</th>
                    <th/>
                  </tr>
                </thead>
                <tbody>
                  {returns.length === 0
                    ? <tr><td colSpan="9" className="text-center text-muted py-5">
                        <div style={{ fontSize:'2rem' }}>↩️</div>Sin devoluciones registradas
                      </td></tr>
                    : returns.map((r, i) => (
                      <React.Fragment key={r.id}>
                        <tr>
                          <td><span className="badge bg-secondary">{i+1}</span></td>
                          <td className="fw-bold">#{String(r.sale_id).padStart(6,'0')}</td>
                          <td className="small">{r.cashier}</td>
                          <td className="small text-muted">{r.reason || '—'}</td>
                          <td>
                            <span className={`badge ${r.mode === 'cambio' ? 'bg-info text-dark' : 'bg-success'}`}>
  {r.mode === 'cambio' ? (
    <>
      <i className="bi bi-arrow-left-right me-1"></i>
      Cambio
    </>
  ) : (
    <>
      <i className="bi bi-cash-coin me-1"></i>
      Dinero
    </>
  )}
</span>
                          </td>
                          <td>
                            {r.authorized_by
                              ? <span className="badge bg-warning text-dark">🔐 {r.authorized_by}</span>
                              : <span className="text-muted small">—</span>}
                          </td>
                          <td className="text-end fw-bold text-danger">{fmtMoney(r.total)}</td>
                          <td className="small text-muted">{fmtDate(r.created_at)}</td>
                          <td>
                            <button className="btn btn-outline-secondary btn-sm"
                              onClick={() => setExpandedReturn(expandedReturn===r.id ? null : r.id)}>
                              {expandedReturn===r.id?'▲':'▼'}
                            </button>
                          </td>
                        </tr>

                        {expandedReturn === r.id && (
                          <tr>
                            <td colSpan="9" className="p-0">
                              <div className="px-4 py-3 bg-light" style={{ borderBottom:'1px solid #dee2e6' }}>
                                <div className="row g-3">
                                  <div className="col-md-6">
                                    <div className="fw-semibold small mb-2 bi-box-seam-fill"> Productos devueltos:</div>
                                    <table className="table table-sm table-bordered mb-0">
                                      <thead className="table-light">
                                        <tr><th>Producto</th><th className="text-center">Cant.</th><th className="text-end">Subtotal</th></tr>
                                      </thead>
                                      <tbody>
                                        {r.items?.map((item,j) => (
                                          <tr key={j}>
                                            <td>{item.product_name}</td>
                                            <td className="text-center">{item.quantity}</td>
                                            <td className="text-end text-danger fw-bold">{fmtMoney(item.subtotal)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="table-light">
                                        <tr>
                                          <td colSpan="2" className="text-end fw-bold">Total:</td>
                                          <td className="text-end fw-bold text-danger">{fmtMoney(r.total)}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                  <div className="col-md-6">
                                    {r.mode === 'cambio' && (
                                      <div className="alert py-2 mb-2" style={{ background:'#eff6ff', border:'1px solid #bfdbfe' }}>
                                        <div className="fw-semibold small bi-repeat"> Producto entregado a cambio:</div>
                                        <div className="fw-bold text-primary">{r.exchange_product || '—'}</div>
                                        {r.exchange_qty && <div className="small text-muted">Cantidad: {r.exchange_qty} — Precio: {fmtMoney(r.exchange_price)}</div>}
                                        {r.diferencia !== 0 && (
                                         <div
  className={`small fw-bold mt-1 ${
    r.diferencia > 0 ? 'text-warning' : 'text-info'
  }`}
>
  {r.diferencia > 0 ? (
    <>
      <i className="bi bi-exclamation-triangle-fill me-1"></i>
      Cliente pagó {fmtMoney(r.diferencia)} adicional
    </>
  ) : (
    <>
      <i className="bi bi-cash-coin me-1"></i>
      Negocio devolvió {fmtMoney(Math.abs(r.diferencia))}
    </>
  )}
</div>
                                        )}
                                      </div>
                                    )}
                                    {r.authorized_by && (
                                      <div className="alert alert-warning py-2 mb-2">
                                        <strong>🔐 Autorizado por:</strong> {r.authorized_by}
                                      </div>
                                    )}
                                    <div className="small text-muted">
                                      <div><strong>Cajero:</strong> {r.cashier}</div>
                                      <div><strong>Motivo:</strong> {r.reason || 'No especificado'}</div>
                                      <div><strong>Fecha:</strong> {fmtDate(r.created_at)}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal PIN */}
        {showPinModal && (
          <AuthModal
            tipo="devolucion"
            detalle={`Devolución de ${fmtMoney(totalDevuelto)} — ${razonPin()}`}
            onAuthorized={(adminName) => {
              setAuthorizedBy(adminName);
              setShowPinModal(false);
              procesarDevolucion(adminName);
            }}
            onCancel={() => setShowPinModal(false)}
          />
        )}
      </main>
    </div>
  );
};

export default Returns;