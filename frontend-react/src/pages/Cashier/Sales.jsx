import PlanGuard from '../../components/PlanGuard';
import { usePlan } from '../../context/PlanContext';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal';
import CamaraIA from '../../components/CamaraIA';
import { productService } from '../../services/productService';
import { saleService } from '../../services/saleService';
import { customerService } from '../../services/customerService';
import { presentationService } from '../../services/presentationService';
import { apiFetch } from '../../services/api';
import AuthModal      from '../../components/AuthModal';
import useOfflineMode from '../../hooks/useOfflineMode';
import OfflineIndicator from '../../components/OfflineIndicator';
import BasculaWidget from '../../components/BasculaWidget';
import useCartReservations from '../../hooks/useCartReservations';
const todayStr = () => new Date().toISOString().slice(0, 10); // eslint-disable-line

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'America/Bogota' });
};

const fmtMoney = (n) => {
  const v = Number(n);
  return isNaN(v) ? '$0' : v.toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
};

// eslint-disable-next-line no-unused-vars
const logAudit = async (token, accion, descripcion) => {
  try {
    await fetch('/api/audit/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ accion, descripcion }),
    });
  } catch(e) { console.error('Audit log error:', e); }
};

const displayName = (p) => {
  if (!p) return '';
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const q = parseFloat(p.gramaje_cantidad);
    return `${p.name} · ${q === Math.floor(q) ? Math.floor(q) : q} ${p.gramaje_unidad}`;
  }
  return p.name;
};

const PESO_CATS = ['Frutas y verduras', 'Carnes y embutidos'];
const esPorPeso = (cat) => PESO_CATS.includes(cat);

const roundCOP = n => {
  const v = Math.abs(Number(n || 0));
  const neg = Number(n || 0) < 0;
  const centena = Math.floor(v / 100) * 100;
  const t = v - centena;
  let r = t <= 24 ? centena : t <= 74 ? centena + 50 : centena + 100;
  return neg ? -r : r;
};
const round50 = roundCOP;

let _tabCounter = 1;
// sinDian = true → pestaña creada con F5, no emite factura DIAN
const newTab = (sinDian = false) => ({
  id:               _tabCounter++,
  sinDian:          sinDian,
  cart:             [],
  paymentMethod:    'efectivo',
  cashReceived:     '',
  isMixto:          false,
  mixtoEfectivo:    '',
  mixtoSegundo:     'nequi',
  mixtoMonto2:      '',
  mixtoRef:         '',
  selectedCustomer: null,
  customerSearch:   '',
  customerResults:  [],
  showNewCustomer:  false,
  newCustomerForm:  { doc_type:'CC', doc_number:'', full_name:'', phone:'', email:'' },
  catFilter:        '',
  cuponCode:        '',
  cuponData:        null,
  cuponLoading:     false,
});

// ─── Ticket ────────────────────────────────────────────────────────────────
const Invoice = ({ sale, cashierName, onClose, mode = 'sin_dian' }) => {
  const printRef = useRef();
  const isDian = mode === 'dian';

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const css = `
      @page { size: 80mm auto; margin: 0 !important; }
      * { box-sizing: border-box; margin: 0; padding: 0; page-break-inside: avoid !important; break-inside: avoid !important; }
      html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; height: auto !important; }
      body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; background: #fff; padding: 6px 6mm 6px 6mm; }
      .c { text-align: center; }
      .r { text-align: right; }
      .b { font-weight: bold; }
      .sep { border: none; border-top: 1px dashed #000; margin: 3px 0; display: block; }
      .sep2 { border: none; border-top: 1px solid #000; margin: 1px 0; display: block; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      td, th { padding: 0 1px; line-height: 1.5; vertical-align: top; }
      .info-table td:first-child { white-space: nowrap; min-width: 55px; }
      .info-table td:last-child { text-align: right; }
      .prod-table th { font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 1px; }
      .prod-table td { border-bottom: 1px dashed #ccc; }
      .prod-table th:first-child, .prod-table td:first-child { text-align: left; width: 30%; }
      .prod-table th:nth-child(2), .prod-table td:nth-child(2) { text-align: center; width: 15%; }
      .prod-table th:nth-child(3), .prod-table td:nth-child(3) { text-align: right; width: 25%; }
      .prod-table th:last-child, .prod-table td:last-child { text-align: right; width: 30%; }
      .tot-table td:first-child { font-weight: bold; font-size: 12px; }
      .tot-table td:last-child { text-align: right; font-weight: bold; font-size: 12px; }
      .iva-row td { font-size: 9px; }
      .iva-row td:last-child { text-align: right; }
      .pago-table td:first-child { white-space: nowrap; min-width: 80px; }
      .pago-table td:last-child { text-align: right; }
    `;
    // Usar iframe oculto para evitar márgenes de Chrome
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:80mm;height:0;border:none;';
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

  const subtotalItems = sale.items?.reduce((a, i) => a + i.subtotal, 0) || 0;
  const total = sale.total ? Math.round(parseFloat(sale.total)) : subtotalItems;

  return (
    <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:9999 }}>
      <div className="modal-dialog" style={{ maxWidth:340 }}>
        <div className="modal-content">
          <div className="modal-header py-2" style={{ background: isDian ? '#1e3a5f' : '#374151', color:'#fff' }}>
            <h6 className="modal-title fw-bold">
              {isDian ? 'Factura DIAN generada' : 'Ticket generado'}
            </h6>
            <button className="btn-close btn-close-white btn-sm" onClick={onClose} />
          </div>
         <div
  className="modal-body p-0"
  style={{
    background:'#fafafa',
    display:'flex',
    justifyContent:'center'
  }}
>
            <div
  ref={printRef}
  style={{
    fontFamily:'"Courier New",Courier,monospace',
    fontSize:11,
    color:'#000',
    background:'#fff',
    padding:'6px 8px',
    width:'100%',
    maxWidth:'80mm',
    margin:'0 auto'
  }}
>

              {/* ENCABEZADO */}
              <div className="c" style={{ textAlign:'center' }}>
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

              {/* INFO */}
              <table className="info-table"><tbody>
                <tr><td>{isDian ? 'Factura No:' : 'Ticket No:'}</td><td style={{ textAlign:'right', fontWeight:'bold' }}>{isDian ? 'FACT-' : '#'}{String(sale.id).padStart(6,'0')}</td></tr>
                <tr><td>Fecha:</td><td style={{ textAlign:'right' }}>{fmtDate(sale.created_at)}</td></tr>
                <tr><td>Cajero:</td><td style={{ textAlign:'right' }}>{cashierName}</td></tr>
                <tr><td>Cliente:</td><td style={{ textAlign:'right' }}>{(sale.dianCliente?.nombre || sale.customer?.full_name || 'Consumidor Final').toUpperCase()}</td></tr>
                {(sale.dianCliente?.nit || sale.customer?.doc_number) && (
                  <tr><td>CC:</td><td style={{ textAlign:'right' }}>{sale.dianCliente?.nit || sale.customer?.doc_number}</td></tr>
                )}
                {isDian && sale.dianCliente?.direccion && <tr><td>Dir:</td><td style={{ textAlign:'right' }}>{sale.dianCliente.direccion}</td></tr>}
                {isDian && sale.dianCliente?.telefono  && <tr><td>Tel:</td><td style={{ textAlign:'right' }}>{sale.dianCliente.telefono}</td></tr>}
              </tbody></table>

              <hr className="sep"/>

              {/* PRODUCTOS */}
              <table className="prod-table">
                <thead><tr><th>Producto</th><th>Cant</th><th>P.Unit</th><th>Total</th></tr></thead>
                <tbody>
                  {sale.items?.map((item, i) => (
                    <tr key={i}>
                      <td>{item.product}{item.units_per_pack && <span style={{ fontSize:8 }}> {item.quantity}p×{item.units_per_pack}u</span>}</td>
                      <td style={{ textAlign:'center' }}>
                        {item.units_per_pack ? `${item.quantity}p`
                          : Number(item.quantity) % 1 === 0 ? `${item.quantity} und`
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
                return (<>
                  {Object.entries(ivaGrupos).filter(([,v]) => v > 0).map(([rate, v]) => (
                    <table key={rate} className="iva-row"><tbody>
                      <tr><td>IVA {rate}% (incluido):</td><td style={{ textAlign:'right' }}>${Math.round(v).toLocaleString('es-CO')}</td></tr>
                    </tbody></table>
                  ))}
                  <table className="tot-table"><tbody>
                    {subtotalItems > total && (
                      <tr><td>Descuento cupón:</td><td style={{textAlign:'right', color:'#16a34a'}}>-${(subtotalItems - total).toLocaleString('es-CO')}</td></tr>
                    )}
                    <tr><td>TOTAL:</td><td>${Number(total).toLocaleString('es-CO')}</td></tr>
                  </tbody></table>
                </>);
              })()}

              <hr className="sep"/>

              {/* PAGO */}
              <table className="pago-table"><tbody>
                {sale.mixtoSegundo ? (<>
                  <tr><td>Efectivo:</td><td style={{ textAlign:'right' }}>${Number(sale.efectivo||0).toLocaleString('es-CO')}</td></tr>
                  <tr><td>{sale.mixtoSegundo}:</td><td style={{ textAlign:'right' }}>${Number(sale.mixtoMonto2||0).toLocaleString('es-CO')}</td></tr>
                  {sale.mixtoRef && <tr><td>Ref:</td><td style={{ textAlign:'right' }}>{sale.mixtoRef}</td></tr>}
                  <tr><td>Cambio:</td><td style={{ textAlign:'right' }}>${Number(sale.cambio||0).toLocaleString('es-CO')}</td></tr>
                </>) : sale.payment_method === 'credito' ? (
                  <tr><td>Método de pago:</td><td style={{ textAlign:'right', fontWeight:'bold' }}>A CRÉDITO</td></tr>
                ) : (<>
                  <tr><td>Método de pago:</td><td style={{ textAlign:'right', fontWeight:'bold', textTransform:'uppercase' }}>{sale.payment_method || 'EFECTIVO'}</td></tr>
                  {(!sale.payment_method || sale.payment_method === 'efectivo') && <>
                    <tr><td>Recibido:</td><td style={{ textAlign:'right' }}>${Number(sale.efectivo||0).toLocaleString('es-CO')}</td></tr>
                    <tr><td>Cambio:</td><td style={{ textAlign:'right' }}>${Number(sale.cambio||0).toLocaleString('es-CO')}</td></tr>
                  </>}
                </>)}
              </tbody></table>

              <hr className="sep"/>

              {/* PIE */}
              <div style={{ textAlign:'center' }}>
                <div style={{ letterSpacing:3 }}>★ ★ ★ ★ ★ ★ ★ ★ ★ ★</div>
                {!isDian && sale.customer && <>
                  <div>Puntos ganados: +{Math.floor(total/1000)}</div>
                  <div>Puntos totales: {(sale.customer.points||0)+Math.floor(total/1000)}</div>
                </>}
                {isDian && <div style={{ fontSize:9 }}>Generado el {new Date().toLocaleDateString('es-CO', { timeZone:'America/Bogota' })}<br/>Vendedor autorizado por resolución DIAN</div>}
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
              Imprimir {isDian ? 'factura' : 'ticket'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Panel de una venta ────────────────────────────────────────────────────
const SalePanel = ({
  tab, products, presentations = [], onUpdate, onCompleted,
  onAddTab, showAlert, token, handleSaleRef, promosActivas = [],
  suspendedSales = [], onSuspend, onRecover, onOpenCamera,
  onAddTabSinDian,  isOnline,
  guardarVentaPendiente, tabs = [],
  camaraProductoPeso, onClearCamaraProductoPeso,
}) => {
  const { hasFeature, soloLectura, planVencido } = usePlan();
  const queryRef  = useRef();
  const weightRef = useRef();
  const pinRef    = useRef();


  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [weightModal, setWeightModal] = useState(null);
  const [weightInput, setWeightInput] = useState('');
  const [pinModal,    setPinModal]    = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [pinLoading,  setPinLoading]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [priceModal,  setPriceModal]  = useState(false);
  const [priceQuery,  setPriceQuery]  = useState('');
  const [priceResult, setPriceResult] = useState(null);
  const [calcModal,   setCalcModal]   = useState(false);
  const [calcTotal,   setCalcTotal]   = useState('');
  const [calcPago,    setCalcPago]    = useState('');
  const [recoverModal,setRecoverModal]= useState(false);
  const [helpModal,   setHelpModal]   = useState(false);

  // Modal DIAN
  const [dianModal,   setDianModal]   = useState(false);
  const [dianForm,    setDianForm]    = useState({ tipoDoc:'NIT', nit:'', nombre:'', direccion:'', telefono:'' });
  const [dianLoading, setDianLoading] = useState(false);
  
  const calcRef  = useRef();
  const priceRef = useRef();

  useEffect(() => { queryRef.current?.focus(); }, []);
  useEffect(() => { if (weightModal) setTimeout(() => weightRef.current?.focus(), 100); }, [weightModal]);

  // Abrir modal de peso cuando la cámara IA detecta un producto por peso
  useEffect(() => {
    if (camaraProductoPeso) {
      setWeightInput('');
      setWeightModal(camaraProductoPeso);
      if (typeof onClearCamaraProductoPeso === 'function') onClearCamaraProductoPeso();
    }
  }, [camaraProductoPeso]);
  useEffect(() => { if (pinModal)    setTimeout(() => pinRef.current?.focus(),    100); }, [pinModal]);
  useEffect(() => { if (calcModal)   setTimeout(() => calcRef.current?.focus(),   100); }, [calcModal]);
  useEffect(() => { if (priceModal)  setTimeout(() => priceRef.current?.focus(),  100); }, [priceModal]);

  const today = todayStr();
  const in7d  = (() => { const d = new Date(); d.setDate(d.getDate()+7); return d.toISOString().slice(0,10); })();

  const productWarning = useCallback((p) => {
    if (!p.expiry_date) return null;
    if (p.expiry_date < today) return { level:'danger',  msg:'Vencido ' + p.expiry_date };
    if (p.expiry_date <= in7d) return { level:'warning', msg:'Vence ' + p.expiry_date };
    return null;
  }, [today, in7d]);

  const set = (field, value) => onUpdate(tab.id, d => ({ ...d, [field]: value }));

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) { setResults([]); setShowResults(false); return; }
    const q = val.toLowerCase();
    const foundProds = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(q) ||
        (p.display_name && p.display_name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      const matchCat = !tab.catFilter || (p.category || '') === tab.catFilter;
      return matchSearch && matchCat;
    }).map(p => ({ ...p, _type:'product' }));

    const foundPres = presentations.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.product_name?.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).map(p => ({
      ...p,
      _type:           'presentation',
      product_id:      p.product_id ?? p.base_product_id,
      stock_available: (() => {
        const base = p.base_stock || 0;
        const factor = p.units_per_pack || 1;
        const pid = p.product_id ?? p.base_product_id;
        // Descontar unidades directas y packs de TODAS las pestañas
        const allCarts = tabs ? tabs.map(t => t.cart).flat() : [];
        const directas = allCarts.filter(c => c.product_id === pid && !c.is_presentation).reduce((a,c) => a+(parseFloat(c.quantity)||0),0);
        const enPacks  = allCarts.filter(c => c.product_id === pid && c.is_presentation).reduce((a,c) => a+(parseFloat(c.quantity)||0)*(parseFloat(c.factor)||1),0);
        const libre = Math.max(0, base - directas - enPacks);
        return Math.floor(libre / factor);
      })(),
    }));

    const combined = [...foundPres, ...foundProds].slice(0, 12);
    setResults(combined);
    setShowResults(combined.length > 0);
  };

  const handleQueryKey = (e) => {
    if (e.key === 'Enter') {
      const val = query.trim();
      if (!val) return;
      const byBarcodePres = presentations.find(p => p.barcode === val);
      if (byBarcodePres) {
        const sp = typeof byBarcodePres.stock_packs === 'number' ? byBarcodePres.stock_packs
                   : (byBarcodePres.base_stock && byBarcodePres.units_per_pack ? Math.floor(byBarcodePres.base_stock / byBarcodePres.units_per_pack) : 0);
        addToCart({ ...byBarcodePres, _type:'presentation', stock_available: sp, product_id: byBarcodePres.product_id ?? byBarcodePres.base_product_id });
        return;
      }
      const byBarcode = products.find(p => p.barcode === val);
      if (byBarcode) { addToCart({ ...byBarcode, _type:'product' }); return; }
      if (results.length === 1) { addToCart(results[0]); return; }
      if (!results.length) { showAlert('danger', 'Producto no encontrado: ' + val); setQuery(''); }
    }
    if (e.key === 'Escape') { setQuery(''); setResults([]); setShowResults(false); }
  };

  const clearQuery = () => {
    setQuery(''); setResults([]); setShowResults(false);
    queryRef.current?.focus();
  };

  const applyCupon = async () => {
    if (!tab.cuponCode) return;
    onUpdate(tab.id, d => ({ ...d, cuponLoading: true }));
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo:      tab.cuponCode,
          customer_id: tab.selectedCustomer?.id || null,
          total:       total,
        })
      });
      const data = await res.json();
      if (data.valid) {
        onUpdate(tab.id, d => ({ ...d, cuponData: data, cuponLoading: false }));
      } else {
        showAlert('danger', data.message || 'Cupón no válido');
        onUpdate(tab.id, d => ({ ...d, cuponData: null, cuponLoading: false }));
      }
    } catch(e) {
      showAlert('danger', 'Error al validar el cupón');
      onUpdate(tab.id, d => ({ ...d, cuponLoading: false }));
    }
  };

  const stockDisponible = useCallback((productId, cart, prods) => {
    const prod = (prods || products).find(p => p.id === productId);
    if (!prod) return 0;
    const stockTotal = prod.stock || 0;
    // Sumar comprometido en TODAS las pestañas, no solo la activa
    const allCarts = tabs ? tabs.map(t => t.cart).flat() : cart;
    const unidadesDirectas = allCarts
      .filter(c => c.product_id === productId && !c.is_presentation)
      .reduce((a, c) => a + (parseFloat(c.quantity) || 0), 0);
    const unidadesPacks = allCarts
      .filter(c => c.product_id === productId && c.is_presentation)
      .reduce((a, c) => a + (parseFloat(c.quantity) || 0) * (parseFloat(c.factor) || 1), 0);
    return Math.max(0, stockTotal - unidadesDirectas - unidadesPacks);
  }, [products, tabs]);

  const addToCart = useCallback((item) => {
    if (item._type === 'presentation') {
      onUpdate(tab.id, draft => {
        const key        = 'pres_' + item.id;
        const exists     = draft.cart.find(c => c.cart_key === key);
        const packActual = exists?.quantity || 0;
        const factor     = item.units_per_pack || 1;
        const unidadesEnPacks = draft.cart
          .filter(c => c.product_id === item.product_id && c.is_presentation)
          .reduce((a, c) => a + (parseFloat(c.quantity) || 0) * (parseFloat(c.factor) || 1), 0);
        const unidadesDirectas = draft.cart
          .filter(c => c.product_id === item.product_id && !c.is_presentation)
          .reduce((a, c) => a + (parseFloat(c.quantity) || 0), 0);
        const prod = products.find(p => p.id === item.product_id);
        const stockBase = prod?.stock || 0;
        const stockLibre = Math.max(0, stockBase - unidadesDirectas - unidadesEnPacks);
        const packsAdicionales = Math.floor(stockLibre / factor);
        if (packsAdicionales <= 0) {
          const udsLibres = stockBase - unidadesDirectas - unidadesEnPacks;
          showAlert('danger', item.name + ' sin stock disponible (' + Math.max(0, udsLibres) + ' uds libres)');
          return draft;
        }
        const nuevoQty = packActual + 1;
        if (nuevoQty > packActual + packsAdicionales) {
          showAlert('warning', 'Solo se puede agregar ' + packsAdicionales + ' pack(s) más de ' + item.name + ' (' + stockLibre + ' uds libres)');
          return draft;
        }
        const newCart = exists
          ? draft.cart.map(c => c.cart_key === key ? { ...c, quantity: c.quantity + 1 } : c)
          : [...draft.cart, {
              cart_key:        key,
              product_id:      item.product_id,
              presentation_id: item.id,
              name:            item.name + (item.units_per_pack ? ' (' + item.units_per_pack + ' uds)' : ''),
              price:           parseFloat(item.price),
              original_price:  parseFloat(item.price),
              discount_pct:    0,
              quantity:        1,
              stock:           packActual + packsAdicionales,
              expiry_date:     null,
              porPeso:         false,
              editingPrice:    false,
              is_presentation: true,
              factor:          item.units_per_pack,
              base_name:       item.base_product,
            }];
        return { ...draft, cart: newCart };
      });
      clearQuery();
      return;
    }

    const product = item;
    const warn = productWarning(product);
    if (warn?.level === 'danger') { showAlert('danger', warn.msg); return; }
    if (product.stock === 0) { showAlert('danger', displayName(product) + ' sin stock'); return; }

    const UNIDADES_PESO = ['kg', 'g', 'lb', 'oz'];
    const esPeso = esPorPeso(product.category) && UNIDADES_PESO.includes(product.gramaje_unidad);

    if (esPeso) {
      setWeightInput('');
      setWeightModal(product);
      clearQuery();
      return;
    }

    onUpdate(tab.id, draft => {
      const exists      = draft.cart.find(c => c.product_id === product.id && !c.is_presentation);
      const stockReal   = stockDisponible(product.id, draft.cart, products);
      const directaActual = exists?.quantity || 0;
      const disponible    = stockReal;
      // eslint-disable-next-line no-unused-vars
      const totalQty      = directaActual + 1;
      if (stockReal <= 0) {
        const packsComprometidos = draft.cart
          .filter(c => c.product_id === product.id && c.is_presentation)
          .reduce((a,c) => a + (parseFloat(c.quantity)||0)*(parseFloat(c.factor)||1), 0);
        const msg = packsComprometidos > 0
          ? 'Solo hay ' + disponible + ' uds libres (' + packsComprometidos + ' comprometidas en packs)'
          : 'Solo hay ' + (disponible + directaActual) + ' uds de ' + displayName(product);
        showAlert('warning', msg);
        return draft;
      }
      if (warn?.level === 'warning') showAlert('warning', warn.msg);
      const newCart = exists
        ? (() => {
            const updated = draft.cart.map(c => (c.product_id === product.id && !c.is_presentation && !c.is_promo_free) ? { ...c, quantity: c.quantity + 1 } : c);
            const mainItem = updated.find(c => c.product_id === product.id && !c.is_presentation && !c.is_promo_free);
            const promo = promosActivas.find(pr => pr.product_id === product.id && pr.type === 'lleva_gratis' && pr.is_valid_today);
            if (promo && mainItem) {
              const buyQty = promo.buy_quantity || 1;
              const freeQty = promo.free_quantity || 1;
              const freeKey = 'promo_gratis_' + product.id;
              const gratuitos = Math.floor(mainItem.quantity / buyQty) * freeQty;
              const sinGratis = updated.filter(c => c.cart_key !== freeKey);
              if (gratuitos > 0) {
                sinGratis.push({ cart_key: freeKey, product_id: product.id, name: displayName(product), price: 0, original_price: parseFloat(product.price), discount_pct: 100, promo_label: '🎁 GRATIS', quantity: gratuitos, stock: product.stock, porPeso: false, editingPrice: false, is_promo_free: true });
              }
              return sinGratis;
            }
            return updated;
          })()
        : [...draft.cart, (() => {
            const precioBase = parseFloat(product.price);  // precio SIN descuento
            // Buscar promo activa para este producto
            const promo = promosActivas.find(pr => pr.product_id === product.id && pr.is_valid_today);
            let precio = product.final_price ?? precioBase;  // final_price ya tiene promo del backend
            let descPct = product.active_discount || 0;
            let promoLabel = null;
            if (promo && promo.is_valid_today) {
              if (promo.type === 'descuento_pct' && promo.discount_value > 0) {
                descPct = promo.discount_value;
                precio  = round50(precioBase * (1 - promo.discount_value / 100));
                promoLabel = `-${promo.discount_value}%`;
              } else if (promo.type === 'descuento_fijo' && promo.discount_value > 0) {
                precio  = Math.max(0, round50(precioBase - promo.discount_value));
                descPct = Math.round((promo.discount_value / precioBase) * 100);
                promoLabel = `-$${Number(promo.discount_value).toLocaleString('es-CO')}`;
              }
            }
            return {
              cart_key:       'prod_' + product.id,
              product_id:     product.id,
              name:           displayName(product),
              price:          precio,
              original_price: precioBase,
              discount_pct:   descPct,
              promo_label:    promoLabel,
              quantity:       1,
              stock:          product.stock,
              expiry_date:    product.expiry_date || null,
              porPeso:        false,
              editingPrice:   false,
            };
          })()];
      return { ...draft, cart: newCart };
    });
    clearQuery();
  }, [tab.id, onUpdate, productWarning, showAlert, stockDisponible, products, promosActivas]);

  const confirmWeight = () => {
    const kg = parseFloat(weightInput);
    if (!kg || kg <= 0) { showAlert('danger', 'Ingresa un peso valido'); return; }
    const product = weightModal;
    onUpdate(tab.id, draft => {
      const exists = draft.cart.find(c => c.product_id === product.id);
      const newCart = exists
        ? draft.cart.map(c => c.product_id === product.id
            ? { ...c, quantity: parseFloat((c.quantity + kg).toFixed(3)) }
            : c)
        : [...draft.cart, {
            product_id:     product.id,
            name:           displayName(product),
            price:          product.final_price ?? parseFloat(product.price),
            original_price: product.final_price ?? parseFloat(product.price),
            discount_pct:   0,
            quantity:       kg,
            stock:          product.stock,
            expiry_date:    product.expiry_date || null,
            porPeso:        true,
            editingPrice:   false,
          }];
      return { ...draft, cart: newCart };
    });
    setWeightModal(null);
    setTimeout(() => queryRef.current?.focus(), 100);
  };

   const requestPin = (action, detail, label, onConfirm) => {
    setPinModal({ action, detail, label, onConfirm });
  };

  const updateQtyDirect = (cartKey, q) => {
    onUpdate(tab.id, draft => {
      const item = draft.cart.find(c => c.cart_key === cartKey);
      if (!item) return draft;
      if (item.porPeso) {
        const kg = parseFloat(q);
        if (!kg || kg <= 0) return draft;
        return { ...draft, cart: draft.cart.map(c => c.cart_key === cartKey ? { ...c, quantity: parseFloat(kg.toFixed(3)) } : c) };
      }
      if (q < 1) return draft;
      if (item.is_presentation) {
        const factor    = item.factor || 1;
        const prod      = products.find(p => p.id === item.product_id);
        const stockBase = prod?.stock || 0;
        const otrosPacks = draft.cart
          .filter(c => c.is_presentation && c.product_id === item.product_id && c.cart_key !== item.cart_key)
          .reduce((a, c) => a + (parseFloat(c.quantity) || 0) * (parseFloat(c.factor) || 1), 0);
        const directas  = draft.cart
          .filter(c => c.product_id === item.product_id && !c.is_presentation)
          .reduce((a, c) => a + (parseFloat(c.quantity) || 0), 0);
        const packsActual = (item.quantity || 0) * factor;
        const stockLibre = Math.max(0, stockBase - directas - otrosPacks - packsActual);
        const maxPacks   = Math.floor(stockLibre / factor) + (item.quantity || 0);
        if (q > maxPacks) {
          showAlert('warning', 'Stock maximo: ' + maxPacks + ' packs (' + (maxPacks * factor) + ' uds disponibles)');
          return draft;
        }
      } else {
        const stockReal  = stockDisponible(item.product_id, draft.cart, products);
        const disponible = stockReal;
        if (q > disponible + item.quantity) {
          showAlert('warning', 'Stock maximo: ' + (disponible + item.quantity) + ' unidades');
          return draft;
        }
      }
      // ── Lógica lleva_gratis ─────────────────────────────────────
      const updatedItem2 = draft.cart.find(c => c.cart_key === cartKey);
      if (updatedItem2 && !updatedItem2.is_presentation && !updatedItem2.porPeso) {
        const promo = promosActivas.find(pr =>
          pr.product_id === updatedItem2.product_id &&
          pr.type === 'lleva_gratis' &&
          pr.is_valid_today
        );
        if (promo) {
          const buyQty  = promo.buy_quantity  || 2;
          const freeQty = promo.free_quantity || 1;
          const freeKey = 'promo_gratis_' + updatedItem2.product_id;
          const gruposCompletos = Math.floor(q / (buyQty + freeQty));
          const gratuitos = gruposCompletos * freeQty;
          const cobrados = q - gratuitos;
          // Actualizar item principal con cantidad cobrada real
          const sinGratis = draft.cart
            .map(c => c.cart_key === cartKey ? { ...c, quantity: q, _cobrados: cobrados } : c)
            .filter(c => c.cart_key !== freeKey);
          if (gratuitos > 0) {
            sinGratis.push({
              cart_key: freeKey,
              product_id: updatedItem2.product_id,
              name: updatedItem2.name,
              price: 0,
              original_price: parseFloat(updatedItem2.original_price || updatedItem2.price),
              discount_pct: 100,
              promo_label: '🎁 GRATIS',
              quantity: gratuitos,
              stock: updatedItem2.stock,
              porPeso: false,
              editingPrice: false,
              is_promo_free: true,
            });
          }
          return { ...draft, cart: sinGratis };
        }
      }
      // ────────────────────────────────────────────────────────────
      return { ...draft, cart: draft.cart.map(c => c.cart_key === cartKey ? { ...c, quantity: q } : c) };
    });
  };

  const updateQty = (id, newQ) => {
    const item = tab.cart.find(c => c.product_id === id);
    const oldQ = item?.quantity || 0;
    if (!item?.porPeso && newQ < oldQ) {
      requestPin(
        'cambiar_cantidad',
        item.name + ': ' + oldQ + ' a ' + newQ,
        'Reducir "' + item.name + '" de ' + oldQ + ' a ' + newQ,
        () => updateQtyDirect(item.cart_key, newQ)
      );
    } else {
      updateQtyDirect(item.cart_key, newQ);
    }
  };

  const removeFromCart = (id) => {
    const item = tab.cart.find(c => c.product_id === id);
    if (!item) return;
    requestPin(
      'eliminar_producto',
      'Eliminar: ' + item.name,
      'Eliminar "' + item.name + '" del carrito',
      () => onUpdate(tab.id, d => ({ ...d, cart: d.cart.filter(c => c.product_id !== id) }))
    );
  };

  const handleCustomerSearch = async (q) => {
    set('customerSearch', q);
    if (q.length < 2) { set('customerResults', []); return; }
    try {
      const res = await customerService.search(q, token);
      set('customerResults', res);
    } catch(e) {}
  };

  const handleRegisterNewCustomer = async () => {
    if (!tab.newCustomerForm.doc_number || !tab.newCustomerForm.full_name) {
      showAlert('danger', 'Documento y nombre son obligatorios');
      return;
    }
    try {
      const c = await customerService.create(tab.newCustomerForm, token);
      onUpdate(tab.id, d => ({
        ...d,
        selectedCustomer: c,
        showNewCustomer:  false,
        customerSearch:   c.full_name,
        customerResults:  [],
      }));
      showAlert('success', 'Cliente ' + c.full_name + ' registrado');
    } catch(e) { showAlert('danger', e.message); }
  };

  // ── Motor de venta ──────────────────────────────────────────────────────
  const _ejecutarVenta = async (mode, dianCliente = null) => {
    if (handleSaleRef) handleSaleRef.current = () => _ejecutarVenta(mode, dianCliente);

    // Aplicar descuento de cupón si existe
    const descuentoCupon = tab.cuponData ? Math.round(tab.cuponData.descuento) : 0;
    const totalFinal = Math.max(0, total - descuentoCupon);

    if (tab.isMixto) {
      const ef2 = parseFloat(tab.mixtoEfectivo || 0);
      const m2  = parseFloat(tab.mixtoMonto2   || 0);
      if (ef2 + m2 < totalFinal) {
        showAlert('danger', 'La suma ' + fmtMoney(ef2+m2) + ' es menor al total ' + fmtMoney(totalFinal));
        return;
      }
      if (!tab.mixtoRef && (tab.mixtoSegundo === 'nequi' || tab.mixtoSegundo === 'transferencia')) {
        showAlert('danger', 'Ingresa la referencia de la transferencia');
        return;
      }
    } else if (tab.paymentMethod === 'credito') {
      if (!tab.selectedCustomer) { showAlert('danger', 'Selecciona un cliente para pagar a credito'); return; }
      if ((tab.selectedCustomer.credit_limit || 0) <= 0) { showAlert('danger', 'Este cliente no tiene credito habilitado'); return; }
      const creditAvailable = tab.selectedCustomer.credit_available !== undefined
        ? tab.selectedCustomer.credit_available
        : Math.max(0, (tab.selectedCustomer.credit_limit||0) - (tab.selectedCustomer.credit_balance||0));
      if (total > creditAvailable) {
        showAlert('danger', 'Supera el credito disponible ' + fmtMoney(creditAvailable));
        return;
      }
    } else if (tab.paymentMethod === 'efectivo') {
      if (parseFloat(tab.cashReceived || 0) < totalFinal) {
        showAlert('danger', 'El efectivo recibido es insuficiente');
        return;
      }
    }

    setLoading(true);
    try {
      const pm = tab.isMixto
        ? ('mixto:efectivo+' + tab.mixtoSegundo)
        : tab.paymentMethod;

      const ef2 = parseFloat(tab.mixtoEfectivo || 0);
      const m2  = parseFloat(tab.mixtoMonto2   || 0);
      const cambioEfectivo = tab.isMixto
        ? Math.max(0, round50(ef2 - (totalFinal - m2)))
        : Math.max(0, round50(parseFloat(tab.cashReceived||0) - totalFinal));

      const payments = tab.isMixto ? [
        { metodo: 'efectivo',       monto: ef2,   cambio: cambioEfectivo, referencia: null },
        { metodo: tab.mixtoSegundo, monto: m2,    cambio: 0,              referencia: tab.mixtoRef || null },
      ] : [
        {
          metodo:     tab.paymentMethod,
          // Si es efectivo guardamos lo que el cliente entrego, no el total
          monto:      tab.paymentMethod === 'efectivo'
                        ? parseFloat(tab.cashReceived || totalFinal)
                        : totalFinal,
          cambio:     cambioEfectivo,
          referencia: null,
        },
      ];

 
let sale;
if (!isOnline) {
  // Sin internet — guardar localmente
  const ventaData = {
    items:          tab.cart.filter(c => !c.is_promo_free).map(c => ({ product_id: c.product_id, presentation_id: c.presentation_id || null, quantity: c.quantity, price: c.price })),
    customer_id:    tab.selectedCustomer?.id || null,
    payment_method: pm,
    payments,
    cambio:         cambioEfectivo,
    sale_mode:      mode,
  };
  await guardarVentaPendiente(ventaData);
  // Crear venta local temporal para mostrar ticket
  sale = {
    id:         Date.now(),
    created_at: new Date().toISOString(),
    items:      tab.cart.map(c => ({ product: c.name, quantity: c.quantity, price: c.price, subtotal: c.price * c.quantity })),
    offline:    true,
  };
} else {
  sale = await saleService.create({
    items:          tab.cart.filter(c => !c.is_promo_free).map(c => ({ product_id: c.product_id, presentation_id: c.presentation_id || null, quantity: c.quantity, price: c.price })),
    customer_id:    tab.selectedCustomer?.id || null,
    payment_method: pm,
    payments,
    cambio:         cambioEfectivo,
    sale_mode:      mode,
    cupon_id:       tab.cuponData?.cupon_id || null,
    descuento_cupon: tab.cuponData?.descuento || 0,
  }, token);
}

      onCompleted(tab.id, {
        ...sale,
        saleMode:     mode,
        dianCliente:  dianCliente,
        customer:     tab.selectedCustomer,
        mixtoSegundo: tab.isMixto ? tab.mixtoSegundo : null,
        mixtoMonto2:  tab.isMixto ? m2               : null,
        mixtoRef:     tab.isMixto ? tab.mixtoRef      : null,
        efectivo: tab.isMixto
          ? ef2
          : tab.paymentMethod === 'efectivo' ? parseFloat(tab.cashReceived || 0) : 0,
        cambio: tab.isMixto
          ? Math.max(0, ef2 - (total - m2))
          : tab.paymentMethod === 'efectivo' ? Math.max(0, parseFloat(tab.cashReceived || 0) - totalConCupon) : 0,
      });
    } catch(e) {
      if (e.status === 409) {
        showAlert('warning', `${e.message} — Haz clic en "Reintentar" para intentar de nuevo.`, true);
      } else {
        showAlert('danger', e.message || 'Error al registrar la venta');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Cobrar: bifurca según sinDian ───────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSale = async () => {
    if (!tab.cart.length) { showAlert('danger', 'Agrega al menos un producto'); return; }

    const LIMITE_CONSUMIDOR_FINAL = 100000; // ajusta según tu negocio

    // Si no tiene plan DIAN → siempre sin DIAN
    if (!hasFeature('dian') || tab.sinDian) {
      await _ejecutarVenta('sin_dian', null);
      return;
    }

// Si ya hay cliente → no pedir datos
if (tab.selectedCustomer) {
  await _ejecutarVenta('dian', {
    tipoDoc: tab.selectedCustomer.doc_type || 'CC',
    nit: tab.selectedCustomer.doc_number,
    nombre: tab.selectedCustomer.full_name,
    direccion: tab.selectedCustomer.address || '—',
    telefono: tab.selectedCustomer.phone || '—'
  });
  return;
}

// Si NO hay cliente pero venta pequeña → consumidor final
if (total <= LIMITE_CONSUMIDOR_FINAL) {
  await _ejecutarVenta('dian', {
    tipoDoc: 'CC',
    nit: '222222222222',
    nombre: 'Consumidor Final',
    direccion: '—',
    telefono: '—'
  });
  return;
}

// Si es venta grande → pedir datos
setDianModal(true);
  };

  // ── Atajos de teclado ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const isInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
        && document.activeElement !== queryRef.current;
      if (isInput) return;
      if (pinModal) return;

      switch(e.key) {
        case 'F1': // Mostrar/ocultar ayuda
          e.preventDefault();
          setHelpModal(h => !h);
          break;
        case 'F2': // Consultar precio
          e.preventDefault();
          setPriceQuery('');
          setPriceResult(null);
          setPriceModal(true);
          break;
        case 'F3': // Nueva venta sin factura DIAN
          e.preventDefault();
          onAddTabSinDian && onAddTabSinDian();
          break;
        case 'F4': // Descuento a toda la venta (requiere PIN)
          e.preventDefault();
          if (!tab.cart.length) { showAlert('warning','Agrega productos al carrito primero'); break; }
          {
            const pct = window.prompt('Descuento % para toda la venta (0-100):');
            if (pct === null) break;
            const p = parseFloat(pct);
            if (isNaN(p) || p < 0 || p > 100) { showAlert('danger','Descuento inválido'); break; }
            requestPin(
              'descuento_venta',
              'Descuento ' + p + '% a toda la venta',
              'Aplicar ' + p + '% de descuento a todos los productos',
              () => onUpdate(tab.id, d => ({
                ...d,
                cart: d.cart.map(c => ({
                  ...c,
                  original_price: c.original_price ?? c.price,
                  price: parseFloat(((c.original_price ?? c.price) * (1 - p/100)).toFixed(2)),
                  discount_pct: p,
                }))
              }))
            );
          }
          break;
        case 'F5': // Suspender venta
          e.preventDefault();
          if (!tab.cart.length) { showAlert('warning','El carrito está vacío'); break; }
          onSuspend && onSuspend(tab.id, [...tab.cart]);
          break;
        case 'F6': // Recuperar venta suspendida
          e.preventDefault();
          if (!suspendedSales.length) { showAlert('warning','No hay ventas suspendidas'); break; }
          setRecoverModal(true);
          break;
        case 'F7': // Historial de ventas — manejado en Sales principal
          e.preventDefault();
          break;
        case 'F8': // Devoluciones
          e.preventDefault();
          window.location.href = '/cajero/devoluciones';
          break;
        case 'F9': // Abrir cajón de dinero
          e.preventDefault();
          showAlert('info','Abriendo cajón de dinero...');
          // Aquí se puede agregar comando al cajón USB cuando esté disponible
          break;
        case 'F10': // Cierre de turno — manejado en Sales principal
          e.preventDefault();
          break;
        case 'F11': // Etiquetas de productos
          e.preventDefault();
          window.location.href = '/admin/etiquetas';
          break;
        case 'F12': // Cobrar
          e.preventDefault();
          handleSale();
          break;
        case 'Escape':
          e.preventDefault();
          setPriceModal(false);
          setCalcModal(false);
          setRecoverModal(false);
          setHelpModal(false);
          setDianModal(false);
          setQuery('');
          setResults([]);
          setShowResults(false);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tab, pinModal, suspendedSales, onSuspend, onUpdate, showAlert, onAddTabSinDian, handleSale]);

  const total  = round50(tab.cart.reduce((a, c) => a + (parseFloat(c.price) || 0) * (parseFloat(c.quantity) || 0), 0));
  const descuentoCupon = tab.cuponData ? Math.round(tab.cuponData.descuento) : 0;
  const totalConCupon  = Math.max(0, total - descuentoCupon);
  const cambio = parseFloat(tab.cashReceived || 0) - totalConCupon;

  const stockBadge = (item) => {
    let maxStock;
    if (item.is_presentation) {
      // Recalcular packs disponibles en tiempo real
      const factor = item.factor || item.units_per_pack || 1;
      const prod   = products.find(p => p.id === item.product_id);
      const base   = prod?.stock || 0;
      const allCarts = tabs ? tabs.map(t => t.cart).flat() : tab.cart;
      const directas = allCarts.filter(c => c.product_id === item.product_id && !c.is_presentation).reduce((a,c) => a+(parseFloat(c.quantity)||0), 0);
      const enPacks  = allCarts.filter(c => c.product_id === item.product_id && c.is_presentation).reduce((a,c) => a+(parseFloat(c.quantity)||0)*(parseFloat(c.factor)||1), 0);
      const libre    = Math.max(0, base - directas - enPacks) + (parseFloat(item.quantity)||0) * factor;
      maxStock = Math.floor(libre / factor);
    } else {
      maxStock = stockDisponible(item.product_id, tab.cart, products) + item.quantity;
    }
    const left = maxStock - item.quantity;
    if (left <= 0) return 'bg-danger';
    if (left <= 3) return 'bg-warning text-dark';
    return 'bg-success';
  };

  const ef2  = parseFloat(tab.mixtoEfectivo || 0);
  const m2   = parseFloat(tab.mixtoMonto2   || 0);
  const suma = ef2 + m2;
  const camb = ef2 - (total - m2);
  const falta= total - suma;

  return (
    <div className="row g-3">

      {/* ── Carrito (izquierda) ── */}
      <div className="col-lg-5">
        <div className="card border-0 shadow-sm h-100" style={{ borderRadius:12 }}>
          <div className="card-header border-0 bg-white d-flex justify-content-between align-items-center" style={{ borderRadius:'12px 12px 0 0' }}>
            <span className="fw-bold">
              Carrito
              {tab.cart.length > 0 && <span className="badge bg-success ms-2">{tab.cart.length}</span>}
              {tab.sinDian && <span className="badge bg-secondary ms-2" style={{fontSize:10}}>Sin DIAN</span>}
            </span>
            {tab.cart.length > 0 && (
              <button className="btn btn-outline-danger btn-sm"
                onClick={() => { if(window.confirm('Vaciar carrito?')) onUpdate(tab.id, d => ({...d, cart:[]})); }}>
                Vaciar
              </button>
            )}
          </div>

          {tab.cart.length === 0 ? (
            <div className="card-body d-flex flex-column align-items-center justify-content-center text-muted" style={{ minHeight:300 }}>
              <div style={{ fontSize:'3rem' }}></div>
              <div className="fw-semibold mt-2">Carrito vacio</div>
              <div className="small">Escanea un codigo o busca un producto</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light" style={{ fontSize:'0.8rem' }}>
                  <tr>
                    <th>Producto</th>
                    <th className="text-center" style={{ width:130 }}>Cantidad</th>
                    <th className="text-end">P. Unit.</th>
                    <th className="text-end">Subtotal</th>
                    <th style={{ width:60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {tab.cart.map(c => {
                    const p      = products.find(x => x.id === c.product_id);
                    const maxQty = c.is_presentation ? (c.stock || 0) : stockDisponible(c.product_id, tab.cart, products) + c.quantity;
                    const warn   = p ? productWarning(p) : null;
                    return (
                      <tr key={c.product_id}>
                        <td>
                          <div className="fw-semibold small">{c.name}</div>
                          {c.promo_label && (
                            <span className="badge bg-success" style={{ fontSize:'0.65rem' }}>{c.promo_label}</span>
                          )}
                          {!c.promo_label && c.discount_pct > 0 && (
                            <span className="badge bg-danger" style={{ fontSize:'0.65rem' }}>-{c.discount_pct}%</span>
                          )}
                          {c.porPeso && (
                            <span className="badge bg-info text-dark ms-1" style={{ fontSize:'0.65rem' }}>kg</span>
                          )}
                          {warn && (
                            <div style={{ fontSize:'0.7rem' }}>
                              <span className={'badge bg-' + (warn.level === 'danger' ? 'danger' : 'warning') + ' text-' + (warn.level === 'warning' ? 'dark' : 'white')}>
                                {warn.msg}
                              </span>
                            </div>
                          )}
                          {!c.porPeso && (
                            <div style={{ fontSize:'0.7rem' }}>
                              {c.is_presentation ? (() => {
                                const factor = c.factor || c.units_per_pack || 1;
                                const prod   = products.find(p => p.id === c.product_id);
                                const base   = prod?.stock || 0;
                                const allCarts = tabs ? tabs.map(t => t.cart).flat() : tab.cart;
                                const directas = allCarts.filter(x => x.product_id === c.product_id && !x.is_presentation).reduce((a,x) => a+(parseFloat(x.quantity)||0), 0);
                                const enPacks  = allCarts.filter(x => x.product_id === c.product_id && x.is_presentation).reduce((a,x) => a+(parseFloat(x.quantity)||0)*(parseFloat(x.factor)||1), 0);
                                const libre    = Math.max(0, base - directas - enPacks) + (parseFloat(c.quantity)||0) * factor;
                                const dispPacks = Math.floor(libre / factor);
                                const left = dispPacks - c.quantity;
                                return <span className={'badge ' + (left<=0?'bg-danger':left<=3?'bg-warning text-dark':'bg-success')}>Disp: {left} pack{left!==1?'s':''}</span>;
                              })() : (
                                <span className={'badge ' + stockBadge(c)}>Disp: {maxQty - c.quantity}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          {c.porPeso ? (
                            <div className="d-flex align-items-center gap-1 justify-content-center">
                              <input type="number" className="form-control form-control-sm text-center"
                                style={{ width:80 }} min="0.001" step="0.001"
                                value={c.quantity}
                                onChange={e => updateQtyDirect(c.cart_key, e.target.value)} />
                              <span className="text-muted small">kg</span>
                            </div>
                          ) : (
                            <div className="d-flex align-items-center gap-1 justify-content-center">
                              <button className="btn btn-outline-secondary btn-sm px-2 py-0" style={{ lineHeight:1.5 }}
                                onClick={() => updateQty(c.product_id, c.quantity - 1)}>-</button>
                              <input type="number" className="form-control form-control-sm text-center"
                                style={{ width:52 }} min="1" max={maxQty}
                                value={c.quantity}
                                onChange={e => updateQty(c.product_id, parseInt(e.target.value) || 1)} />
                              <button className="btn btn-outline-secondary btn-sm px-2 py-0" style={{ lineHeight:1.5 }}
                                onClick={() => updateQtyDirect(c.cart_key, c.quantity + 1)}>+</button>
                            </div>
                          )}
                        </td>
                        <td className="text-end small">
                          {c.editingPrice ? (
                            <div className="input-group input-group-sm" style={{ width:100, marginLeft:'auto' }}>
                              <span className="input-group-text" style={{ fontSize:10 }}>$</span>
                              <input type="number" className="form-control text-end" style={{ fontSize:10 }}
                                defaultValue={Math.round(c.price)}
                                autoFocus
                                onBlur={e => {
                                  const np = parseFloat(e.target.value);
                                  onUpdate(tab.id, d => ({ ...d, cart: d.cart.map(x => x.product_id === c.product_id ? { ...x, editingPrice:false } : x) }));
                                  if (!isNaN(np) && np > 0) {
                                    requestPin(
                                      'editar_precio',
                                      c.name + ': $' + Math.round(c.price) + ' a $' + Math.round(np),
                                      'Cambiar precio de "' + c.name + '" a ' + fmtMoney(np),
                                      () => onUpdate(tab.id, d => ({ ...d, cart: d.cart.map(x => x.product_id === c.product_id ? { ...x, price: np, original_price: x.original_price ?? x.price } : x) }))
                                    );
                                  }
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Escape') {
                                    onUpdate(tab.id, d => ({ ...d, cart: d.cart.map(x => x.product_id === c.product_id ? { ...x, editingPrice:false } : x) }));
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <span
                              style={{ cursor:'pointer', textDecoration:'underline dotted' }}
                              title="Clic para editar precio"
                              onClick={() => onUpdate(tab.id, d => ({ ...d, cart: d.cart.map(x => x.product_id === c.product_id ? { ...x, editingPrice:true } : x) }))}>
                              {fmtMoney(c.price)}{c.porPeso ? '/kg' : ''}
                            </span>
                          )}
                        </td>
                        <td className="text-end fw-bold text-success small">
                          {fmtMoney((parseFloat(c.price) || 0) * (parseFloat(c.quantity) || 0))}
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1 align-items-center">
                            <button className="btn btn-link btn-sm text-warning p-0" title="Descuento"
                              onClick={() => {
                                const pct = window.prompt('Descuento % para "' + c.name + '" (0-100):');
                                if (pct === null) return;
                                const p = parseFloat(pct);
                                if (isNaN(p) || p < 0 || p > 100) { showAlert('danger', 'Descuento invalido'); return; }
                                const base = c.original_price ?? c.price;
                                requestPin(
                                  'aplicar_descuento',
                                  c.name + ': ' + p + '%',
                                  'Descuento ' + p + '% en "' + c.name + '"',
                                  () => onUpdate(tab.id, d => ({
                                    ...d,
                                    cart: d.cart.map(x => x.product_id === c.product_id
                                      ? { ...x, original_price: base, price: parseFloat((base * (1 - p/100)).toFixed(2)), discount_pct: p }
                                      : x)
                                  }))
                                );
                              }}>
                              %
                            </button>
                            <button className="btn btn-link btn-sm text-danger p-0" title="Eliminar"
                              onClick={() => removeFromCart(c.product_id)}>
                              X
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <td colSpan="3" className="text-end fw-bold">TOTAL:</td>
                    <td className="text-end fw-bold text-success fs-6">{fmtMoney(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal F2: Consultar precio ── */}
      {priceModal && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:10001 }}>
          <div className="modal-dialog modal-sm" style={{ marginTop:'15vh' }}>
            <div className="modal-content">
              <div className="modal-header py-2" style={{ background:'#1e3a5f', color:'#fff' }}>
                <h6 className="modal-title fw-bold">F2 — Consultar precio</h6>
                <button className="btn-close btn-close-white btn-sm" onClick={() => setPriceModal(false)} />
              </div>
              <div className="modal-body">
                <label className="form-label small fw-semibold">Nombre o código de barras</label>
                <input ref={priceRef} className="form-control mb-2"
                  placeholder="Escribe o escanea..."
                  value={priceQuery}
                  onChange={e => {
                    const q = e.target.value;
                    setPriceQuery(q);
                    if (!q.trim()) { setPriceResult(null); return; }
                    const found = products.find(p =>
                      p.barcode === q || p.name.toLowerCase().includes(q.toLowerCase())
                    );
                    setPriceResult(found || null);
                  }}
                  onKeyDown={e => e.key === 'Escape' && setPriceModal(false)}
                />
                {priceResult ? (
                  <div className="p-3 rounded" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
                    <div className="fw-bold">{priceResult.name}</div>
                    <div className="text-muted small">{priceResult.category || '—'}</div>
                    {priceResult.barcode && <div className="text-muted small" style={{ fontFamily:'monospace' }}>{priceResult.barcode}</div>}
                    <div className="d-flex gap-3 mt-2">
                      <div>
                        <div className="text-muted" style={{ fontSize:11 }}>Precio</div>
                        <div className="fs-5 fw-bold text-success">{fmtMoney(priceResult.final_price ?? priceResult.price)}</div>
                      </div>
                      <div>
                        <div className="text-muted" style={{ fontSize:11 }}>Stock</div>
                        <div className={`fs-5 fw-bold ${priceResult.stock === 0 ? 'text-danger' : priceResult.stock <= 5 ? 'text-warning' : 'text-success'}`}>{priceResult.stock}</div>
                      </div>
                    </div>
                  </div>
                ) : priceQuery.length >= 1 ? (
                  <div className="text-muted small text-center py-2">No encontrado</div>
                ) : null}
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setPriceModal(false)}>Cerrar (ESC)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal F4: Calculadora de cambio ── */}
      {calcModal && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:10001 }}>
          <div className="modal-dialog modal-sm" style={{ marginTop:'15vh' }}>
            <div className="modal-content">
              <div className="modal-header py-2" style={{ background:'#065f46', color:'#fff' }}>
                <h6 className="modal-title fw-bold">F4 — Calculadora de cambio</h6>
                <button className="btn-close btn-close-white btn-sm" onClick={() => setCalcModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Total a cobrar</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input ref={calcRef} type="number" className="form-control form-control-lg text-end"
                      value={calcTotal}
                      onChange={e => setCalcTotal(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && setCalcModal(false)} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Efectivo recibido</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input type="number" className="form-control form-control-lg text-end"
                      value={calcPago}
                      onChange={e => setCalcPago(e.target.value)} />
                  </div>
                </div>
                {calcTotal && calcPago && (
                  <div className={`p-3 rounded text-center ${parseFloat(calcPago) >= parseFloat(calcTotal) ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}`}>
                    {parseFloat(calcPago) >= parseFloat(calcTotal) ? (
                      <div>
                        <div className="text-muted small">Cambio</div>
                        <div className="fs-3 fw-bold text-success">{fmtMoney(parseFloat(calcPago) - parseFloat(calcTotal))}</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-muted small">Faltan</div>
                        <div className="fs-3 fw-bold text-danger">{fmtMoney(parseFloat(calcTotal) - parseFloat(calcPago))}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setCalcModal(false)}>Cerrar (ESC)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal F9: Recuperar venta suspendida ── */}
      {recoverModal && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:10001 }}>
          <div className="modal-dialog" style={{ marginTop:'15vh' }}>
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title fw-bold">F9 — Ventas suspendidas</h6>
                <button className="btn-close btn-sm" onClick={() => setRecoverModal(false)} />
              </div>
              <div className="modal-body p-0">
                {!suspendedSales.length ? (
                  <div className="text-center text-muted py-4">No hay ventas suspendidas</div>
                ) : suspendedSales.map(s => (
                  <div key={s.id} className="px-3 py-2 border-bottom d-flex align-items-center gap-3">
                    <div style={{ flex:1 }}>
                      <div className="fw-semibold small">Venta suspendida — {s.ts}</div>
                      <div className="text-muted" style={{ fontSize:11 }}>
                        {s.cart.length} producto{s.cart.length!==1?'s':''} —
                        Total: {fmtMoney(s.cart.reduce((a,c)=>(a+(parseFloat(c.price)||0)*(parseFloat(c.quantity)||0)),0))}
                      </div>
                      <div className="text-muted" style={{ fontSize:10 }}>
                        {s.cart.map(c=>c.name).join(', ')}
                      </div>
                    </div>
                    <button className="btn btn-success btn-sm"
                      onClick={() => { onRecover && onRecover(s); setRecoverModal(false); }}>
                      Recuperar
                    </button>
                  </div>
                ))}
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setRecoverModal(false)}>Cerrar (ESC)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal F1: Ayuda de teclado ── */}
      {helpModal && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:10001 }}>
          <div className="modal-dialog" style={{ marginTop:'10vh' }}>
            <div className="modal-content">
              <div className="modal-header py-2" style={{ background:'#1e3a5f', color:'#fff' }}>
                <h6 className="modal-title fw-bold bi-collection-fill"> Comandos de teclado</h6>
                <button className="btn-close btn-close-white btn-sm" onClick={() => setHelpModal(false)} />
              </div>
              <div className="modal-body p-0">
                <table className="table table-hover mb-0" style={{ fontSize:13 }}>
                  <thead className="table-light">
                    <tr><th style={{ width:60 }}>Tecla</th><th>Acción</th></tr>
                  </thead>
                 <tbody>
  {[
    ['F1', 'Mostrar/ocultar esta ayuda'],
    ['F2', 'Consultar precio de un producto'],
    ['F3', 'Nueva venta sin factura DIAN (ticket interno)'],
    ['F4', 'Descuento a toda la venta (requiere PIN)'],
    ['F5', 'Suspender venta (guardar para después)'],
    ['F6', 'Recuperar venta suspendida'],
    ['F7', 'Ir a historial de ventas'],
    ['F8', 'Devoluciones'],
    ['F9', 'Abrir cajón de dinero'],
    ['F10', 'Ir a cierre de turno'],
    ['F11', <>Etiquetas de productos</>],
    ['F12', 'Cobrar'],
    ['Enter', 'Agregar producto escaneado'],
    ['ESC', 'Cerrar modal / cancelar búsqueda'],
  ].map(([key, action]) => (
    <tr key={key}>
      <td>
        <kbd
          className="bg-dark text-white px-2 py-1 rounded"
          style={{ fontSize: 12 }}
        >
          {key}
        </kbd>
      </td>
      <td>{action}</td>
    </tr>
  ))}
</tbody>
                </table>
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setHelpModal(false)}>Cerrar (ESC)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal peso */}
     {weightModal && (
  <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:9999 }}>
    <div className="modal-dialog modal-sm" style={{ marginTop:'10vh' }}>
      <div className="modal-content">
        <div className="modal-header">
          <h6 className="modal-title fw-bold">
            ️ Pesar: {displayName(weightModal)}
          </h6>
          <button className="btn-close" onClick={() => setWeightModal(null)} />
        </div>
        <div className="modal-body">
          <p className="text-muted small mb-3">
            Precio: {fmtMoney(weightModal.final_price ?? weightModal.price)}/kg
          </p>
 
          {/* Widget de báscula — se usa si el cliente tiene báscula USB */}
          <BasculaWidget
            productoNombre={displayName(weightModal)}
            onPesoConfirmado={(kg) => {
              if (kg && kg > 0) {
                setWeightInput(String(kg));
              }
            }}
          />
 
          {/* Input manual como alternativa */}
          <div className="mt-3">
            <label className="form-label small fw-semibold text-muted">
              O ingresar peso manualmente:
            </label>
            <div className="input-group">
              <input
                ref={weightRef}
                type="number"
                className="form-control form-control-lg text-center"
                placeholder="0.000"
                min="0.001"
                step="0.001"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmWeight()}
              />
              <span className="input-group-text fw-bold">kg</span>
            </div>
          </div>
 
          {weightInput && parseFloat(weightInput) > 0 && (
            <div className="mt-2 p-2 bg-success bg-opacity-10 rounded text-center">
              <span className="fw-bold text-success">
                {fmtMoney((weightModal.final_price ?? weightModal.price) * parseFloat(weightInput))}
              </span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setWeightModal(null)}>
            Cancelar
          </button>
          <button className="btn btn-success fw-bold" onClick={confirmWeight}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  </div>
)}

      {/* Modal PIN */}
     {/* AuthModal reemplaza el modal PIN */}
      {pinModal && (
        <AuthModal
          tipo={pinModal.action}
          detalle={pinModal.label}
          onAuthorized={(adminNombre) => {
            showAlert('success', 'Autorizado por ' + adminNombre);
            pinModal.onConfirm();
            setPinModal(null);
          }}
          onCancel={() => setPinModal(null)}
        />
      )}

      {/* ── Modal DIAN ── */}
      {dianModal && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,0.7)', zIndex:10002 }}>
          <div className="modal-dialog" style={{ marginTop:'8vh' }}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                <h5 className="modal-title fw-bold">Factura DIAN — Datos del cliente</h5>
                <button className="btn-close btn-close-white" onClick={() => setDianModal(false)} />
              </div>
              <div className="modal-body">
                <div className="alert alert-info py-2 small mb-3">
                  Para emitir factura electrónica DIAN se requieren los datos del cliente.
                </div>
                <div className="row g-3">
                  <div className="col-4">
                    <label className="form-label fw-semibold small">Tipo doc *</label>
                    <select className="form-select" value={dianForm.tipoDoc}
                      onChange={e => setDianForm(f => ({ ...f, tipoDoc: e.target.value }))}>
                      {['NIT','CC','CE','Pasaporte'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-8">
                    <label className="form-label fw-semibold small">
                      {dianForm.tipoDoc === 'NIT' ? 'NIT' : 'Número de documento'} *
                    </label>
                    <input className="form-control" placeholder="Ej: 900123456-1"
                      value={dianForm.nit}
                      onChange={e => setDianForm(f => ({ ...f, nit: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold small">
                      {dianForm.tipoDoc === 'NIT' ? 'Razón social' : 'Nombre completo'} *
                    </label>
                    <input className="form-control" placeholder="Nombre o razón social"
                      value={dianForm.nombre}
                      onChange={e => setDianForm(f => ({ ...f, nombre: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold small">Dirección *</label>
                    <input className="form-control" placeholder="Dirección del cliente"
                      value={dianForm.direccion}
                      onChange={e => setDianForm(f => ({ ...f, direccion: e.target.value }))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold small">Teléfono *</label>
                    <input className="form-control" placeholder="Teléfono de contacto"
                      value={dianForm.telefono}
                      onChange={e => setDianForm(f => ({ ...f, telefono: e.target.value }))} />
                  </div>
                </div>
                <div className="mt-3 p-2 rounded" style={{ background:'#f8fafc', fontSize:12 }}>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Total a facturar:</span>
                    <span className={`fw-bold fs-6 ${tab.cuponData ? 'text-decoration-line-through text-muted' : 'text-success'}`}>{fmtMoney(total)}</span>
                  </div>
                  {tab.cuponData && (
                    <>
                      <div className="d-flex justify-content-between mt-1">
                        <span className="text-success small"><i className="bi bi-ticket-perforated me-1"></i>Cupón {tab.cuponCode}:</span>
                        <span className="text-success small fw-bold">-{fmtMoney(tab.cuponData.descuento)}</span>
                      </div>
                      <div className="d-flex justify-content-between mt-1">
                        <span className="fw-bold">Total con cupón:</span>
                        <span className="fw-bold text-success fs-6">{fmtMoney(Math.max(0, total - tab.cuponData.descuento))}</span>
                      </div>
                    </>
                  )}
                  <div className="d-flex justify-content-between mt-1">
                    <span className="text-muted">Resolución DIAN:</span>
                    <span className="text-muted">No. 18764050366042</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setDianModal(false)}>Cancelar</button>
                <button
                  className="btn btn-primary fw-bold px-4"
                  disabled={dianLoading || !dianForm.nit || !dianForm.nombre || !dianForm.direccion || !dianForm.telefono}
                  onClick={async () => {
                    setDianLoading(true);
                    setDianModal(false);
                    await _ejecutarVenta('dian', { ...dianForm });
                    setDianLoading(false);
                    setDianForm({ tipoDoc:'NIT', nit:'', nombre:'', direccion:'', telefono:'' });
                  }}>
                  {dianLoading
                    ? <><span className="spinner-border spinner-border-sm me-2"/>Procesando...</>
                    : 'Emitir factura DIAN'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Buscador/opciones (derecha) ── */}
      <div className="col-lg-7">

        {/* Buscador */}
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius:12 }}>
          <div className="card-body py-3">
            <label className="form-label fw-semibold small text-uppercase text-muted mb-1">
              Buscar por nombre o codigo de barras
            </label>
            {(() => {
              const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
              if (!cats.length) return null;
              return (
                <div className="d-flex gap-1 flex-wrap mb-2">
                  <button
                    className={'btn btn-xs btn-sm py-0 px-2 ' + (!tab.catFilter ? 'btn-dark' : 'btn-outline-secondary')}
                    style={{ fontSize:11 }}
                    onClick={() => { set('catFilter', ''); setResults([]); setShowResults(false); }}>
                    Todas
                  </button>
                  {cats.map(cat => (
                    <button key={cat}
                      className={'btn btn-xs btn-sm py-0 px-2 ' + (tab.catFilter===cat ? 'btn-primary' : 'btn-outline-secondary')}
                      style={{ fontSize:11 }}
                      onClick={() => {
                        set('catFilter', cat);
                        if (!query.trim()) {
                          const r = products.filter(p => p.category === cat).slice(0,12)
                            .map(p => ({ ...p, _type:'product' }));
                          setResults(r);
                          setShowResults(r.length > 0);
                        }
                      }}>
                      {cat}
                    </button>
                  ))}
                </div>
              );
            })()}
            <div className="input-group">
              <span className="input-group-text bg-dark text-white">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.442 1.398a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
                </svg>
              </span>
              <input
                ref={queryRef}
                className="form-control form-control-lg"
                placeholder="Nombre, codigo de barras o escanea..."
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleQueryKey}
                onFocus={() => results.length > 0 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 180)}
                autoComplete="off"
              />
              {query && (
                <button className="btn btn-outline-secondary" onClick={clearQuery}>x</button>
              )}
              <button
                className={`btn ${hasFeature('camara_ia') ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                title={hasFeature('camara_ia') ? 'Cámara IA — Identificar frutas y verduras' : 'Cámara IA — Requiere Plan Premium'}
                onClick={() => hasFeature('camara_ia') && onOpenCamera && onOpenCamera()}
                style={{ position:'relative' }}>
                <i className="bi bi-camera-fill"></i>
                {!hasFeature('camara_ia') && (
                  <i className="bi bi-lock-fill" style={{
                    position:'absolute', top:-4, right:-4,
                    fontSize:10, background:'#6b7280', color:'#fff',
                    borderRadius:'50%', padding:'2px 3px'
                  }}></i>
                )}
              </button>
            </div>
            <div className="d-flex align-items-center justify-content-between mt-1">
              <div className="text-muted" style={{ fontSize:11 }}>
                Escanea el codigo para agregar directo | Escribe nombre y elige del listado
              </div>
              <button className="btn btn-link btn-sm text-muted p-0" style={{ fontSize:10 }}
                onClick={() => setHelpModal(true)}>
                ⌨️ F1 ayuda
              </button>
            </div>

            {showResults && results.length > 0 && (
              <div className="mt-2 border rounded shadow-sm" style={{ maxHeight:300, overflowY:'auto', position:'relative', zIndex:20 }}>
                {results.map(p => {
                  const warn    = productWarning(p);
                  const inCart  = tab.cart.find(c => c.product_id === p.id);
                  const blocked = warn?.level === 'danger' || p.stock === 0;
                  const porPeso = esPorPeso(p.category) && ['kg','g','lb','oz'].includes(p.gramaje_unidad);
                  return (
                    <div key={p.id} className="px-3 py-2 border-bottom"
                      style={{ background: blocked ? '#fff5f5' : inCart ? '#f0fff4' : 'white' }}>
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ flex:1, minWidth:0 }}>
                          <div className="fw-semibold small">
                            {p._type === 'presentation' && (
                              <span className="badge bg-warning text-dark me-1" style={{ fontSize:9 }}>Presentación</span>
                            )}
                            {p._type === 'presentation' ? p.name : displayName(p)}
                            {p._type === 'presentation' && p.units_per_pack && (
                              <span className="text-muted ms-1" style={{ fontSize:10 }}>({p.units_per_pack} uds)</span>
                            )}
                            {p._type !== 'presentation' && p.gramaje_cantidad && p.gramaje_unidad && (
                              <span className="badge bg-light text-dark border ms-1" style={{ fontSize:9 }}>
                                ️ {p.gramaje_cantidad} {p.gramaje_unidad}
                              </span>
                            )}
                            {p.barcode && (
                              <span className="text-muted ms-2" style={{ fontSize:10, fontFamily:'monospace' }}>
                                {p.barcode}
                              </span>
                            )}
                          </div>
                          <div className="d-flex gap-1 flex-wrap align-items-center mt-1" style={{ fontSize:11 }}>
                            <span className="text-success fw-bold">
                              {fmtMoney(p.final_price ?? p.price)}{porPeso ? '/kg' : ''}
                            </span>
                            {p.active_discount > 0 && (
                              <span className="badge bg-danger">-{p.active_discount}%</span>
                            )}
                            {/* Badge de promo activa para este producto */}
                            {promosActivas.find(pr => pr.product_id === p.id && pr.is_valid_today) && (() => {
                              const pr = promosActivas.find(x => x.product_id === p.id && x.is_valid_today);
                              return (
                                <span className="badge bg-warning text-dark" style={{fontSize:9}}>
                                  <i className="bi bi-tag-fill me-1"></i>
                                  {pr.type === 'descuento_pct' && `-${pr.discount_value}%`}
                                  {pr.type === 'descuento_fijo' && `-$${Number(pr.discount_value).toLocaleString('es-CO')}`}
                                  {pr.type === 'lleva_gratis' && `${pr.buy_quantity}x${pr.buy_quantity + pr.free_quantity}`}
                                </span>
                              );
                            })()}
                            {p.category && (
                              <span className="badge bg-light text-dark border" style={{ fontSize:9 }}>{p.category}</span>
                            )}
                            {p.line_name && (
                              <span className="badge px-1" style={{ background: p.line_color || '#6b7280', color:'#fff', fontSize:9 }}>
                                {p.line_name}
                              </span>
                            )}
                            {porPeso && <span className="badge bg-info text-dark">Por peso</span>}
                            {p._type === 'presentation' ? (
                              <span className={`badge ${p.stock_available === 0 ? 'bg-danger' : p.stock_available <= 3 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                Disp: {p.stock_available}
                              </span>
                            ) : (
                              <span className={`badge ${stockDisponible(p.id, tab.cart, products) === 0 ? 'bg-danger' : stockDisponible(p.id, tab.cart, products) <= (p.min_stock ?? 5) ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                                Stock: {stockDisponible(p.id, tab.cart, products)}
                              </span>
                            )}
                            {warn && (
                              <span className={`badge bg-${warn.level === 'danger' ? 'danger' : 'warning'} text-${warn.level === 'warning' ? 'dark' : 'white'}`}>
                                {warn.msg}
                              </span>
                            )}
                            {inCart && (
                              <span className="badge bg-success">En carrito ({inCart.quantity})</span>
                            )}
                          </div>
                        </div>
                        <button
                          className={`btn btn-sm flex-shrink-0 ${blocked ? 'btn-secondary' : porPeso ? 'btn-info' : 'btn-success'}`}
                          disabled={blocked}
                          onMouseDown={e => { e.preventDefault(); if (!blocked) addToCart(p); }}
                        >
                          {blocked ? 'Sin stock' : porPeso ? 'Pesar' : '+ Agregar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {query.length >= 1 && results.length === 0 && (
              <div className="mt-2 px-3 py-2 border rounded text-muted small text-center" style={{ background:'#fff5f5' }}>
                No se encontro "{query}"
              </div>
            )}
          </div>
        </div>

        {/* Cliente */}
        <div className="card border-0 shadow-sm mb-3" style={{ borderRadius:12 }}>
          <div className="card-header border-0 fw-bold bg-white d-flex justify-content-between align-items-center" style={{ borderRadius:'12px 12px 0 0' }}>
            <span>Cliente</span>
            {!tab.selectedCustomer && (
              <span className="badge bg-secondary" style={{fontSize:11}}>Consumidor Final</span>
            )}
          </div>
          <div className="card-body py-3">
            {tab.selectedCustomer ? (
              <div className="d-flex align-items-center justify-content-between p-2 rounded" style={{ background:'#f0fff4' }}>
                <div>
                  <div className="fw-bold">{tab.selectedCustomer.full_name}
                    {tab.selectedCustomer.price_list_nombre && (
                      <span className="badge bg-success ms-2 bi-percent" style={{fontSize:10}}>
                        ️ {tab.selectedCustomer.price_list_nombre}
                      </span>
                    )}
                  </div>
                  <div className="text-muted small">{tab.selectedCustomer.doc_type}: {tab.selectedCustomer.doc_number}</div>
                  <div className="text-warning small">Puntos: {tab.selectedCustomer.points}</div>
                  {(tab.selectedCustomer.credit_limit > 0) && (
                    <div className="small text-muted">
                      Crédito disponible: <strong className="text-success">
                        {fmtMoney(tab.selectedCustomer.credit_available !== undefined
                          ? tab.selectedCustomer.credit_available
                          : Math.max(0, (tab.selectedCustomer.credit_limit||0) - (tab.selectedCustomer.credit_balance||0)))}
                      </strong>
                    </div>
                  )}
                </div>
                <button className="btn btn-outline-danger btn-sm"
                  onClick={() => onUpdate(tab.id, d => ({ ...d, selectedCustomer:null, customerSearch:'' }))}>
                  ×
                </button>
              </div>
            ) : (
              <>
                <input className="form-control mb-2" placeholder="Buscar por cedula o nombre..."
                  value={tab.customerSearch}
                  onChange={e => handleCustomerSearch(e.target.value)} />
                {tab.customerResults.length > 0 && (
                  <div className="border rounded mb-2" style={{ maxHeight:150, overflowY:'auto' }}>
                    {tab.customerResults.map(c => (
                      <div key={c.id} className="px-3 py-2 border-bottom" style={{ cursor:'pointer' }}
                        onClick={async () => {
                          try {
                            const fresh = await customerService.getById(c.id, token);
                            const customer = fresh || c;
                            if (customer.credit_limit > 0 && customer.credit_available === undefined) {
                              customer.credit_available = Math.max(0, customer.credit_limit - (customer.credit_balance || 0));
                            }
                            onUpdate(tab.id, d => ({ ...d, selectedCustomer: customer, customerSearch: customer.full_name, customerResults:[] }));
                          } catch(e) {
                            const customer = { ...c, credit_available: Math.max(0, (c.credit_limit||0) - (c.credit_balance||0)) };
                            onUpdate(tab.id, d => ({ ...d, selectedCustomer: customer, customerSearch: c.full_name, customerResults:[] }));
                          }
                        }}>
                        <div className="fw-semibold small">{c.full_name}</div>
                        <div className="text-muted" style={{ fontSize:11 }}>{c.doc_type}: {c.doc_number} · Puntos: {c.points}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-secondary btn-sm flex-fill"
                    onClick={() => onUpdate(tab.id, d => ({ ...d, showNewCustomer:!d.showNewCustomer }))}>
                    + Registrar nuevo
                  </button>
                  <button className="btn btn-outline-secondary btn-sm"
                    onClick={() => onUpdate(tab.id, d => ({ ...d, selectedCustomer:null, customerSearch:'', customerResults:[] }))}>
                    Sin cliente
                  </button>
                </div>
                {tab.showNewCustomer && (
                  <div className="mt-2 p-2 border rounded" style={{ background:'#f8fafc' }}>
                    <div className="row g-2">
                      <div className="col-4">
                        <select className="form-select form-select-sm"
                          value={tab.newCustomerForm.doc_type}
                          onChange={e => onUpdate(tab.id, d => ({ ...d, newCustomerForm:{...d.newCustomerForm, doc_type:e.target.value} }))}>
                          {['CC','CE','NIT','Pasaporte'].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-8">
                        <input className="form-control form-control-sm" placeholder="Num. documento *"
                          value={tab.newCustomerForm.doc_number}
                          onChange={e => onUpdate(tab.id, d => ({ ...d, newCustomerForm:{...d.newCustomerForm, doc_number:e.target.value} }))} />
                      </div>
                      <div className="col-12">
                        <input className="form-control form-control-sm" placeholder="Nombre completo *"
                          value={tab.newCustomerForm.full_name}
                          onChange={e => onUpdate(tab.id, d => ({ ...d, newCustomerForm:{...d.newCustomerForm, full_name:e.target.value} }))} />
                      </div>
                      <div className="col-6">
                        <input className="form-control form-control-sm" placeholder="Telefono"
                          value={tab.newCustomerForm.phone}
                          onChange={e => onUpdate(tab.id, d => ({ ...d, newCustomerForm:{...d.newCustomerForm, phone:e.target.value} }))} />
                      </div>
                      <div className="col-6">
                        <input className="form-control form-control-sm" placeholder="Correo"
                          value={tab.newCustomerForm.email}
                          onChange={e => onUpdate(tab.id, d => ({ ...d, newCustomerForm:{...d.newCustomerForm, email:e.target.value} }))} />
                      </div>
                      <div className="col-12">
                        <button className="btn btn-success btn-sm w-100" onClick={handleRegisterNewCustomer}>
                          Registrar cliente
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Cupón de descuento — solo Plan Estándar+ */}
        {hasFeature('cupones') && (
        <div className="mb-3 px-1">
          <div className="fw-semibold small mb-1"><i className="bi bi-ticket-perforated me-1"></i>Cupón de descuento</div>
          <div className="d-flex gap-2">
            <input className="form-control form-control-sm"
              placeholder="Código del cupón..."
              value={tab.cuponCode || ''}
              onChange={e => onUpdate(tab.id, d => ({ ...d, cuponCode: e.target.value.toUpperCase(), cuponData: null }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCupon(); } }}
            />
            <button className="btn btn-sm btn-outline-primary fw-bold"
              disabled={!tab.cuponCode || tab.cuponLoading}
              onClick={applyCupon}>
              {tab.cuponLoading ? <span className="spinner-border spinner-border-sm"/> : 'Aplicar'}
            </button>
            {tab.cuponData && (
              <button className="btn btn-sm btn-outline-danger" onClick={() => onUpdate(tab.id, d => ({ ...d, cuponCode:'', cuponData:null }))}>
                <i className="bi bi-x"></i>
              </button>
            )}
          </div>
          {tab.cuponData && (
            <div className="alert alert-success py-1 px-2 mt-1 small mb-0">
              <i className="bi bi-check-circle-fill me-1"></i>
              {tab.cuponData.message} — Ahorro: <strong>{fmtMoney(tab.cuponData.descuento)}</strong>
            </div>
          )}
        </div>
        )}

        {/* Pago */}
        <div className="card border-0 shadow-sm" style={{ borderRadius:12 }}>
          <div className="card-header border-0 fw-bold bg-white" style={{ borderRadius:'12px 12px 0 0' }}>
            Metodo de Pago
          </div>
          <div className="card-body">
            <div className="d-flex gap-2 mb-3">
              <button
                className={'btn btn-sm flex-fill ' + (!tab.isMixto ? 'btn-dark' : 'btn-outline-secondary')}
                onClick={() => set('isMixto', false)}>
                Un solo metodo
              </button>
              <button
                className={'btn btn-sm flex-fill ' + (tab.isMixto ? 'btn-warning fw-bold' : 'btn-outline-warning')}
                onClick={() => set('isMixto', true)}>
                Pago mixto
              </button>
            </div>

            {!tab.isMixto && (
              <>
                <div className="d-flex gap-2 mb-3 flex-wrap">
                  {[
                    { val:'efectivo',      label:'Efectivo'      },
                    { val:'tarjeta',       label:'Tarjeta',       feature:'datafono' },
                    { val:'transferencia', label:'Transferencia' },
                    { val:'nequi',         label:'Nequi'         },
                    { val:'credito',       label:'A credito'     },
                  ].map(m => (
                    <button key={m.val}
                      disabled={m.feature && !hasFeature(m.feature)}
                      title={m.feature && !hasFeature(m.feature) ? 'Requiere Plan Estándar o superior' : ''}
                      className={'btn btn-sm flex-fill ' + (tab.paymentMethod === m.val
                        ? (m.val === 'credito' ? 'btn-warning fw-bold' : 'btn-dark')
                        : 'btn-outline-secondary')}
                      onClick={() => set('paymentMethod', m.val)}>
                      {m.label}
                    </button>
                  ))}
                </div>

                {tab.paymentMethod === 'efectivo' && (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Efectivo recibido</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input type="number" className="form-control" placeholder="0" min="0"
                        value={tab.cashReceived}
                        onChange={e => set('cashReceived', e.target.value)} />
                    </div>
                    {tab.cashReceived && (
                      <div className={'mt-2 p-2 rounded text-center fw-bold ' + (cambio >= 0 ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger')}>
                        {cambio >= 0 ? 'Cambio: ' + fmtMoney(cambio) : 'Faltan: ' + fmtMoney(Math.abs(cambio))}
                      </div>
                    )}
                  </div>
                )}

                {(tab.paymentMethod === 'tarjeta' || tab.paymentMethod === 'transferencia' || tab.paymentMethod === 'nequi') && (
                  <div className="mb-3 p-2 rounded text-center" style={{ background:'#f0f9ff' }}>
                    <div className="text-muted small">
                      {tab.paymentMethod === 'tarjeta'       && 'Confirme el pago en el datáfono'}
                      {tab.paymentMethod === 'transferencia' && 'Verifique el comprobante de transferencia'}
                      {tab.paymentMethod === 'nequi'         && 'Verifique la notificación de Nequi'}
                    </div>
                  </div>
                )}

                {tab.paymentMethod === 'credito' && (
                  <div className="mb-3 p-3 rounded" style={{ background:'#fffbeb', border:'1px solid #fde68a' }}>
                    {!tab.selectedCustomer ? (
                      <div className="text-warning fw-semibold small">
                        Selecciona un cliente para habilitar el credito
                      </div>
                    ) : (tab.selectedCustomer.credit_limit || 0) <= 0 ? (
                      <div className="text-danger small">
                        {tab.selectedCustomer.full_name} no tiene credito habilitado
                      </div>
                    ) : (
                      <div style={{ fontSize:13 }}>
                        <div className="fw-semibold mb-1">{tab.selectedCustomer.full_name}</div>
                        <div className="d-flex gap-3 flex-wrap">
                          <span>Deuda: <strong className="text-danger">{fmtMoney(tab.selectedCustomer.credit_balance || 0)}</strong></span>
                          <span>Disponible: <strong className="text-success">{fmtMoney(tab.selectedCustomer.credit_available || 0)}</strong></span>
                        </div>
                        {total > (tab.selectedCustomer.credit_available || 0) && (
                          <div className="text-danger fw-bold mt-1" style={{ fontSize:12 }}>
                            Supera el credito disponible {fmtMoney(tab.selectedCustomer.credit_available || 0)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {tab.isMixto && (
              <div>
                <div className="p-2 rounded mb-3" style={{ background:'#fffbeb', border:'1px solid #fde68a', fontSize:12 }}>
                  Total: {fmtMoney(totalConCupon)} = Efectivo + segundo metodo
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Efectivo recibido</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input type="number" className="form-control" placeholder="0" min="0"
                      value={tab.mixtoEfectivo}
                      onChange={e => set('mixtoEfectivo', e.target.value)} />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label small fw-semibold">Segundo metodo</label>
                  <div className="d-flex gap-2 mb-2">
                    {[
                      { val:'nequi',         label:'Nequi'         },
                      { val:'tarjeta',       label:'Tarjeta'       },
                      { val:'transferencia', label:'Transferencia' },
                    ].map(m => (
                      <button key={m.val}
                      disabled={m.feature && !hasFeature(m.feature)}
                      title={m.feature && !hasFeature(m.feature) ? 'Requiere Plan Estándar o superior' : ''}
                        className={'btn btn-sm flex-fill ' + (tab.mixtoSegundo === m.val ? 'btn-primary' : 'btn-outline-secondary')}
                        onClick={() => set('mixtoSegundo', m.val)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="input-group mb-2">
                    <span className="input-group-text">$</span>
                    <input type="number" className="form-control" placeholder="0" min="0"
                      value={tab.mixtoMonto2}
                      onChange={e => set('mixtoMonto2', e.target.value)} />
                  </div>
                  {(tab.mixtoSegundo === 'nequi' || tab.mixtoSegundo === 'transferencia') && (
                    <input className="form-control form-control-sm" placeholder="Referencia de la transferencia *"
                      value={tab.mixtoRef}
                      onChange={e => set('mixtoRef', e.target.value)} />
                  )}
                </div>
                <div className="p-2 rounded" style={{
                  background: falta > 0.5 ? '#fff5f5' : camb < -0.5 ? '#fff5f5' : '#f0fdf4',
                  border: '1px solid ' + (falta > 0.5 ? '#fca5a5' : camb < -0.5 ? '#fca5a5' : '#bbf7d0'),
                  fontSize:12
                }}>
                  <div className="d-flex justify-content-between">
                    <span>Efectivo:</span><span className="fw-bold">{fmtMoney(ef2)}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span>{tab.mixtoSegundo}:</span><span className="fw-bold">{fmtMoney(m2)}</span>
                  </div>
                  <div className="d-flex justify-content-between border-top mt-1 pt-1">
                    <span>Suma:</span>
                    <span className={'fw-bold ' + (suma >= total ? 'text-success' : 'text-danger')}>{fmtMoney(suma)}</span>
                  </div>
                  {falta > 0.5 && <div className="text-danger fw-bold mt-1">Faltan: {fmtMoney(falta)}</div>}
                  {suma >= total && camb >= 0 && <div className="text-success fw-bold mt-1">Cambio en efectivo: {fmtMoney(camb)}</div>}
                </div>
              </div>
            )}

            <div className="border-top pt-2 mt-3">
              <div className="d-flex justify-content-between fw-bold fs-5">
                <span>TOTAL:</span>
                <span className="text-success">{fmtMoney(totalConCupon)}</span>
              </div>
            </div>

            {/* Botón cobrar — cambia según sinDian */}
           <button
  className={`btn btn-lg w-100 mt-3 fw-bold ${
    tab.sinDian ? 'btn-secondary' : 'btn-success'
  }`}
  onClick={handleSale}
  disabled={loading || tab.cart.length === 0}
  style={{ borderRadius: 8 }}
>
  {loading ? (
    <>
      <span className="spinner-border spinner-border-sm me-2" />
      Procesando...
    </>
  ) : tab.sinDian || !hasFeature('dian') ? (
    <>
      <i className="bi bi-check-circle me-2"></i>
      Cobrar — {fmtMoney(totalConCupon)}
    </>
  ) : (
    <>
      <i className="bi bi-file-earmark-text me-2"></i>
      Cobrar con DIAN — {fmtMoney(totalConCupon)}
    </>
  )}
</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────
const Sales = () => {
  const { token, user, logout } = useAuth();
  const { hasFeature, soloLectura, planVencido } = usePlan();
  const navigate = useNavigate();
  const [shiftOk,        setShiftOk]        = React.useState(null);
  const [shiftData,      setShiftData]      = React.useState(null);
  const [showAbrirTurno, setShowAbrirTurno] = React.useState(false);
  const [showCerrarTurno,setShowCerrarTurno]= React.useState(false);
  const [cajasDisponibles, setCajasDisponibles] = React.useState([]);
  const [cajaSeleccionada, setCajaSeleccionada] = React.useState('');
  const [efectivoInicial,setEfectivoInicial]= React.useState('');
  const [efectivoContado,setEfectivoContado]= React.useState('');
  const [cierreLoading,  setCierreLoading]  = React.useState(false);
  const [products,       setProducts]       = useState([]);
  const [presentations,  setPresentations]  = useState([]);
  const [promosActivas,  setPromosActivas]  = useState([]);
  const [tabs,           setTabs]           = useState(() => [newTab()]);
  const [activeTabId,    setActiveTabId]    = useState(tabs[0].id);
  const [alert,          setAlert]          = useState(null);
  const [confirmCancelVenta, setConfirmCancelVenta] = useState(null);
  const [showCamaraIA,       setShowCamaraIA]       = useState(false);
  const [camaraProductoPeso, setCamaraProductoPeso] = useState(null);
  const [lastSale,       setLastSale]       = useState(null);
  const [suspendedSales, setSuspendedSales] = useState([]);
  const handleSaleRef = React.useRef(null);
  // eslint-disable-next-line no-unused-vars
  const reservaciones = useCartReservations(token);
  const MAX_TABS = 5;
  const [pedidosCatalogo, setPedidosCatalogo] = useState([]);
  const [showPedidos,       setShowPedidos]       = useState(false);
  const [modalDomiciliario, setModalDomiciliario] = useState(null);
  const [formDom,           setFormDom]           = useState({nombre:'',celular:'',cedula:'',marca_moto:'',placa:''});

  // Consultar pedidos del catálogo asignados a este cajero cada 30s
  useEffect(() => {
    if (!token || !user?.id) return;
    const cargar = () => {
      apiFetch(`/domicilios/`, {}, token)
        .then(data => setPedidosCatalogo(Array.isArray(data) ? data.filter(d =>
          (d.numero_pedido?.startsWith('CAT-')) &&
          !['entregado','cancelado'].includes(d.estado)
        ) : []))
        .catch(() => {});
    };
    cargar();
    const interval = setInterval(cargar, 30000);
    return () => clearInterval(interval);
  }, [token, user?.id]);


  useEffect(() => {
    productService.getAll(token).then(setProducts).catch(console.error);
    presentationService.getAll(token).then(setPresentations).catch(console.error);
    // Cargar promociones activas del día
    fetch('/api/promotions/?activas=true', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.ok ? r.json() : [])
      .then(data => setPromosActivas(Array.isArray(data) ? data.filter(p => p.is_valid_today) : []))
      .catch(() => {});
    fetch('/api/shifts/active', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.id && data.status === 'abierto') {
          setShiftOk(true);
          setShiftData(data);
        } else {
          setShiftOk(false);
          fetch('/api/cajas/mis-cajas', {
            headers: { 'Authorization': 'Bearer ' + token }
          }).then(r => r.ok ? r.json() : [])
            .then(cajas => {
              const lista = Array.isArray(cajas) ? cajas : [];
              setCajasDisponibles(lista);
              setCajaSeleccionada(lista.length >= 1 ? String(lista[0].id) : '');
            }).catch(() => setCajasDisponibles([]));
          setShowAbrirTurno(true); // Mostrar modal automáticamente
        }
      })
      .catch(() => { setShiftOk(false); setShowAbrirTurno(true); });
  }, [token]);

  const asignarDomiciliarioS = async () => {
    if (!formDom.nombre.trim() || !formDom.celular.trim()) {
      showAlert('danger', 'Nombre y celular del domiciliario son obligatorios');
      return;
    }
    const codigo = Math.floor(1000 + Math.random() * 9000).toString();
    try {
      await apiFetch(`/domicilios/${modalDomiciliario.id}/estado`, {
        method:'PUT',
        body: JSON.stringify({
          estado:               'en_camino',
          domiciliario_nombre:  formDom.nombre,
          domiciliario_celular: formDom.celular,
          domiciliario_cedula:  formDom.cedula,
          domiciliario_moto:    formDom.marca_moto,
          domiciliario_placa:   formDom.placa,
        })
      }, token);
      // Imprimir comprobante de envio
      imprimirComprobanteEnvio(modalDomiciliario, formDom);
      showAlert('success', `Enviado · Código de entrega: ${codigo}`);
      setModalDomiciliario(null);
      setFormDom({nombre:'',celular:'',cedula:'',marca_moto:'',placa:''});
      apiFetch(`/domicilios?cajero_id=${user.id}&estado=en_camino`, {}, token)
        .then(data => setPedidosCatalogo(Array.isArray(data) ? data.filter(d =>
          d.numero_pedido?.startsWith('CAT-') || d.numero_pedido?.startsWith('DOM-')) : []));
    } catch { showAlert('danger', 'Error asignando domiciliario'); }
  };

  // Imprimir comprobante de envío
  const imprimirComprobanteEnvio = (pedido, domiciliario) => {
    const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');
    const css = `
      @page { size: 72mm auto; margin: 0; }
      body { font-family: 'Courier New', monospace; font-size: 11px; padding: 6px 8px; width: 72mm; color: #000; }
      .c { text-align: center; } .b { font-weight: bold; }
      .sep { border-top: 1px dashed #000; margin: 4px 0; }
      table { width: 100%; font-size: 10px; border-collapse: collapse; }
      td { padding: 1px 2px; vertical-align: top; }
      td:last-child { text-align: right; }
    `;
    const html = `
      <div class="c b" style="font-size:14px">COMPROBANTE DE ENVÍO</div>
      <div class="c">LA ESQUINA DE DULCE</div>
      <div class="sep"></div>
      <table>
        <tr><td>Pedido:</td><td><b>${pedido.numero_pedido}</b></td></tr>
        <tr><td>Cliente:</td><td>${pedido.cliente_nombre}</td></tr>
        <tr><td>Dirección:</td><td>${pedido.cliente_direccion}</td></tr>
        <tr><td>Teléfono:</td><td>${pedido.cliente_telefono}</td></tr>
      </table>
      <div class="sep"></div>
      <div class="b" style="font-size:10px">DOMICILIARIO</div>
      <table>
        <tr><td>Nombre:</td><td>${domiciliario.nombre}</td></tr>
        <tr><td>Celular:</td><td>${domiciliario.celular}</td></tr>
        ${domiciliario.marca_moto ? `<tr><td>Moto:</td><td>${domiciliario.marca_moto}</td></tr>` : ''}
        ${domiciliario.placa ? `<tr><td>Placa:</td><td>${domiciliario.placa}</td></tr>` : ''}
      </table>
      <div class="sep"></div>
      <div class="b" style="font-size:10px">PRODUCTOS</div>
      <table>
        ${(pedido.items||[]).map(i => `<tr><td>${i.product_name} x${i.quantity}</td><td>${fmt(i.subtotal)}</td></tr>`).join('')}
        <tr><td><b>TOTAL:</b></td><td><b>${fmt(pedido.total)}</b></td></tr>
      </table>
      <div class="sep"></div>
      <div class="sep"></div>
      <div class="c" style="font-size:11px;font-weight:bold">ENVIAR FOTO DE COMPROBANTE AL:</div>
      <div class="c" style="font-size:14px;font-weight:900">WhatsApp: 3203308547</div>
      <div class="c" style="font-size:9px">(Foto del comprobante firmado por el cliente)</div>
      <div class="sep"></div>
      <div class="c" style="font-size:9px">Fecha: ${new Date().toLocaleString('es-CO', { timeZone:'America/Bogota' })}</div>
    `;
    const w = window.open('','_blank','width=400,height=600');
    w.document.write(`<html><head><style>${css}</style></head><body>${html}<script>window.onload=function(){window.print();window.close();}<\/script></body></html>`);
    w.document.close();
  };



    const showAlert = useCallback((type, msg, retryable = false) => {
    setAlert({ type, msg, retryable });
    if (!retryable) setTimeout(() => setAlert(null), 4500);
  }, []);
  const { isOnline, pendingCount, syncing, guardarVentaPendiente, sincronizarPendientes } = useOfflineMode(token, showAlert);

  const abrirTurno = async () => {
    if (cajasDisponibles.length > 1 && !cajaSeleccionada) {
      showAlert('danger', 'Selecciona una caja para continuar'); return;
    }
    const monto = parseFloat(efectivoInicial) || 0;
    try {
      const res = await fetch('/api/shifts/open', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ initial_cash: monto, cash_register_id: cajaSeleccionada ? parseInt(cajaSeleccionada) : null })
      });
      if (res.ok) {
        const data = await res.json();
        setShiftData(data.shift || data);
        setShiftOk(true);
        setShowAbrirTurno(false);
        setEfectivoInicial('');
      } else {
        showAlert('danger', 'Error al abrir el turno. Intenta de nuevo.');
      }
    } catch(e) { showAlert('danger', 'Error de conexión: ' + e.message); }
  };

  const solicitarCierreTurno = () => {
    setEfectivoContado('');
    setShowCerrarTurno(true);
  };

  const cerrarTurnoYSesion = async () => {
    setCierreLoading(true);
    try {
      const contado = parseFloat(efectivoContado) || 0;
      if (shiftData?.id) {
        await fetch('/api/shifts/close', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ shift_id: shiftData.id, cash_counted: contado })
        });
      }
      setShowCerrarTurno(false);
      logout();
    } catch(e) {
      logout();
    } finally { setCierreLoading(false); }
  };
  const updateTab = useCallback((id, updater) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== id) return t;
      return typeof updater === 'function' ? updater(t) : { ...t, ...updater };
    }));
  }, []);

  const addTab = () => {
    if (tabs.length >= MAX_TABS) { showAlert('warning', 'Maximo ' + MAX_TABS + ' ventas simultaneas'); return; }
    const t = newTab(false);
    setTabs(prev => [...prev, t]);
    setActiveTabId(t.id);
  };

  // F5: nueva pestaña marcada como sinDian
  const addTabSinDian = useCallback(() => {
    if (tabs.length >= MAX_TABS) { showAlert('warning', 'Maximo ' + MAX_TABS + ' ventas simultaneas'); return; }
    const t = newTab(true);
    setTabs(prev => [...prev, t]);
    setActiveTabId(t.id);
  }, [tabs.length, showAlert]);

  const closeTab = (id) => {
    const tab = tabs.find(t => t.id === id);
    if (tab?.cart.length > 0) { setConfirmCancelVenta(id); return; }
    _doCloseTab(id);
  };

  const _doCloseTab = (id) => {
    const remaining = tabs.filter(t => t.id !== id);
    if (remaining.length === 0) {
      const t = newTab();
      setTabs([t]);
      setActiveTabId(t.id);
    } else {
      setTabs(remaining);
      if (activeTabId === id) setActiveTabId(remaining[remaining.length - 1].id);
    }
  };

  const handleCompleted = (id, sale) => {
    // Recargar stock en todas las pestañas tras cualquier venta (DIAN o sin DIAN)
    productService.getAll(token).then(setProducts).catch(console.error);
    presentationService.getAll(token).then(setPresentations).catch(console.error);
    setLastSale(sale);
    if (tabs.length > 1) {
      const remaining = tabs.filter(t => t.id !== id);
      setTabs(remaining);
      setActiveTabId(remaining[remaining.length - 1].id);
    } else {
      const t = newTab();
      setTabs([t]);
      setActiveTabId(t.id);
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const { darkMode, toggleDarkMode } = useTheme();
  const [showCierreModal, setShowCierreModal] = useState(false);

  // F10 → modal cierre de turno
  // F7  → historial de ventas
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F10') { e.preventDefault(); setShowCierreModal(true); }
      if (e.key === 'F7')  { e.preventDefault(); navigate('/cajero/historial'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const ATAJOS = [
    { key:'F1',  label:'Ayuda' },
    { key:'F2',  label:'Precio' },
    { key:'F3',  label:'Sin DIAN' },
    { key:'F4',  label:'Descuento' },
    { key:'F5',  label:'Suspender' },
    { key:'F6',  label:'Recuperar' },
    { key:'F7',  label:'Historial' },
    { key:'F8',  label:'Devoluciones' },
    { key:'F9',  label:'Cajón' },
    { key:'F10', label:'Cierre', highlight: true },
    { key:'F11', label:'Etiquetas' },
    { key:'F12', label:'Cobrar', highlight: true },
    { key:'ESC', label:'Cancelar' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#f0f2f5', display:'flex', flexDirection:'column' }}>

      {/* ── BARRA SUPERIOR ── */}
      <div style={{
        background:'#fff', borderBottom:'1px solid #dee2e6',
        padding:'10px 20px', display:'flex', alignItems:'center',
        justifyContent:'space-between', flexShrink:0,
        boxShadow:'0 1px 4px rgba(0,0,0,.06)',
      }}>
        {/* Izquierda: título + fecha */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src="/creatsoft-logo.png.jpeg" alt="Creatsoft"
            style={{ width:48, height:48, objectFit:'contain', borderRadius:10 }}/>
          <div>
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <div style={{ fontWeight:800, fontSize:18, lineHeight:1.1, color:'#1e3a5f' }}>SmartMerca</div>
              <div style={{ fontSize:9, color:'#38bdf8', letterSpacing:2, textTransform:'uppercase', fontWeight:600 }}>by Creatsoft</div>
            </div>
          <div style={{ fontSize:12, color:'#64748b' }}>
            Cajero: <strong>{user?.name}</strong> — {new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', timeZone:'America/Bogota' })}
          </div>
          </div>
        </div>

        {/* Derecha: offline + luna + nombre + logout */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <OfflineIndicator
            isOnline={isOnline}
            pendingCount={pendingCount}
            syncing={syncing}
            onSync={sincronizarPendientes}
          />
          {/* Luna */}
          <button onClick={toggleDarkMode} title={darkMode ? 'Modo claro' : 'Modo oscuro'}
            style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', padding:'2px 6px', borderRadius:8,
              color:'#64748b', transition:'.2s' }}
            onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            {darkMode ? <i className="bi bi-sun-fill"></i> : <i className="bi bi-moon-stars-fill"></i>}
          </button>
          {/* Nombre cajero */}
          <div style={{ fontSize:13, fontWeight:600, color:'#374151', display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:13 }}>
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            {user?.name}
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main style={{ flex:1, padding:'14px 20px', overflow:'auto' }}>

        {alert && (
          <div className={'alert alert-' + alert.type + ' alert-dismissible py-2 mb-3 d-flex align-items-center justify-content-between'}>
            <span>{alert.msg}</span>
            <div className="d-flex gap-2">
              {alert.retryable && (
                <button className="btn btn-sm btn-warning fw-bold"
                  onClick={() => { setAlert(null); handleSaleRef.current && handleSaleRef.current(); }}>
                  Reintentar
                </button>
              )}
              <button type="button" className="btn-close" onClick={() => setAlert(null)} />
            </div>
          </div>
        )}

        {/* Pestañas */}
        <div className="d-flex align-items-end gap-1 mb-0" style={{ borderBottom:'2px solid #dee2e6' }}>
          {tabs.map(t => {
            const isActive  = t.id === activeTabId;
            const itemCount = t.cart.length;
            const tabTotal  = t.cart.reduce((a, c) => a + (parseFloat(c.price)||0) * (parseFloat(c.quantity)||0), 0);
            return (
              <div key={t.id}
                onClick={() => setActiveTabId(t.id)}
                style={{
                  cursor:'pointer', padding:'8px 14px', borderRadius:'8px 8px 0 0',
                  background: isActive ? '#fff' : (t.sinDian ? '#e2e8f0' : '#e9ecef'),
                  border:'1px solid #dee2e6',
                  borderBottom: isActive ? '2px solid #fff' : '1px solid #dee2e6',
                  marginBottom: isActive ? '-2px' : 0,
                  minWidth:130, maxWidth:200, transition:'0.15s',
                }}>
                <div className="d-flex align-items-center gap-2">
                  <div>
                    <div className="fw-semibold" style={{ fontSize:13 }}>
                      Venta {t.id}
                      {t.sinDian && <span className="badge bg-secondary ms-1" style={{ fontSize:9 }}>Sin DIAN</span>}
                      {itemCount > 0 && <span className="badge bg-success ms-1" style={{ fontSize:10 }}>{itemCount}</span>}
                    </div>
                    <div className={itemCount > 0 ? 'text-success fw-bold' : 'text-muted'} style={{ fontSize:11 }}>
                      {itemCount > 0 ? fmtMoney(tabTotal) : 'Carrito vacio'}
                    </div>
                  </div>
                  <button className="btn btn-link p-0 ms-auto text-muted" style={{ fontSize:14, lineHeight:1 }}
                    onClick={e => { e.stopPropagation(); closeTab(t.id); }} title="Cerrar">x</button>
                </div>
              </div>
            );
          })}
          {tabs.length < MAX_TABS && (
            <button className="btn btn-outline-primary btn-sm"
              style={{ borderRadius:'8px 8px 0 0', border:'1px solid #dee2e6', padding:'8px 14px', height:58, fontSize:13 }}
              onClick={addTab}>
              + Nueva venta
            </button>
          )}
        </div>

        {/* Panel activo */}
        <div style={{ background:'#fff', border:'1px solid #dee2e6', borderTop:'none', borderRadius:'0 0 12px 12px', padding:16, marginBottom:12 }}>
          {shiftOk === false && (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
              <div style={{ fontSize:'4rem' }}></div>
              <h4 className="fw-bold mt-3 text-danger">Sin turno activo</h4>
              <p className="text-muted mb-4" style={{ maxWidth:400 }}>
                Para comenzar a vender debes abrir tu turno de caja.
              </p>
              <button className="btn btn-primary fw-bold px-4" onClick={()=>setShowAbrirTurno(true)}>
                Abrir turno de caja
              </button>
            </div>
          )}
          {shiftOk === null && (
            <div className="d-flex align-items-center justify-content-center py-5">
              <div className="spinner-border text-secondary me-2" />
              <span className="text-muted">Verificando turno...</span>
            </div>
          )}
          {shiftOk === true && activeTab && (
            <>
            {/* Banner promociones activas */}
            <SalePanel
              isOnline={isOnline}
              guardarVentaPendiente={guardarVentaPendiente}
              tabs={tabs}
              key={activeTab.id}
              tab={activeTab}
              products={products}
              presentations={presentations}
              onUpdate={updateTab}
              onCompleted={handleCompleted}
              onAddTab={addTab}
              onAddTabSinDian={addTabSinDian}
              showAlert={showAlert}
              token={token}
              handleSaleRef={handleSaleRef}
              suspendedSales={suspendedSales}
              onSuspend={(tabId, cartData) => {
                setSuspendedSales(prev => [...prev, { id: Date.now(), tabId, cart: cartData, ts: new Date().toLocaleTimeString('es-CO') }]);
                updateTab(tabId, d => ({ ...d, cart: [] }));
                showAlert('success', 'Venta suspendida — recupérala con F6');
              }}
              onRecover={(suspended) => {
                setSuspendedSales(prev => prev.filter(s => s.id !== suspended.id));
                updateTab(activeTabId, d => ({ ...d, cart: suspended.cart }));
                showAlert('success', 'Venta recuperada');
              }}
              onOpenCamera={() => setShowCamaraIA(true)}
              camaraProductoPeso={camaraProductoPeso}
              onClearCamaraProductoPeso={() => setCamaraProductoPeso(null)}
              promosActivas={promosActivas}
            />
            </>
          )}
        </div>
      </main>

      {/* ── BARRA DE ATAJOS INFERIOR ── */}
      <div style={{
        background:'#1e293b', borderTop:'1px solid #334155',
        padding:'6px 16px', display:'flex', alignItems:'center',
        gap:4, flexWrap:'wrap', flexShrink:0,
      }}>
        {ATAJOS.map(a => (
          <div key={a.key} style={{
            display:'flex', alignItems:'center', gap:4,
            padding:'3px 8px', borderRadius:6,
            background: a.highlight ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)',
            border: `1px solid ${a.highlight ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.1)'}`,
          }}>
            <kbd style={{
              background: a.highlight ? '#16a34a' : '#334155',
              color:'#fff', borderRadius:4, padding:'1px 6px',
              fontSize:10, fontWeight:700, fontFamily:'monospace',
            }}>{a.key}</kbd>
            <span style={{ fontSize:10, color: a.highlight ? '#4ade80' : '#94a3b8', whiteSpace:'nowrap' }}>
              {a.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── MODAL CIERRE DE TURNO (F10) ── */}
      {showCierreModal && (
        <div className="modal d-block" style={{ background:'rgba(0,0,0,.7)', zIndex:9999 }}>
          <div className="modal-dialog" style={{ marginTop:'12vh', maxWidth:420 }}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-box-arrow-right me-2"></i>Cierre de turno
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setShowCierreModal(false)} />
              </div>
              <div className="modal-body text-center py-4">
                <i className="bi bi-cash-register" style={{fontSize:'3rem', color:'#1e3a5f'}}></i>
                <h5 className="fw-bold mt-3 mb-2">¿Listo para cerrar tu turno?</h5>
                <p className="text-muted mb-4" style={{ fontSize:14 }}>
                  Ingresarás el conteo de efectivo y el turno se cerrará automáticamente.
                </p>
                <div className="d-flex flex-column gap-2">
                  <button className="btn btn-danger fw-bold py-2" onClick={() => {
                    setShowCierreModal(false);
                    solicitarCierreTurno();
                  }}>
                    <i className="bi bi-box-arrow-right me-2"></i>Cerrar turno
                  </button>
                  <hr className="my-1"/>
                  <button className="btn btn-outline-danger py-2" onClick={() => {
                    setShowCierreModal(false);
                    logout();
                    navigate('/login');
                  }}>
                    <i className="bi bi-door-open me-2"></i>Cerrar sesión sin cerrar turno
                  </button>
                </div>
              </div>
              <div className="modal-footer py-2 justify-content-center">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowCierreModal(false)}>
                  <i className="bi bi-arrow-left me-1"></i>Volver a ventas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {lastSale && (
        <Invoice
          sale={lastSale}
          cashierName={user?.name}
          onClose={() => setLastSale(null)}
          mode={lastSale.saleMode || 'sin_dian'}
        />
      )}

      {/* ── Botón pedidos catálogo — solo Plan Estándar+ ── */}
      {hasFeature('catalogo_qr') && (
        <div style={{position:'fixed',bottom:24,right:24,zIndex:8888}}>
          <button className="btn btn-warning fw-bold shadow-lg"
            style={{borderRadius:50,padding:'12px 20px',fontSize:15,position:'relative'}}
            onClick={()=>setShowPedidos(true)}>
            Pedidos
            <span className="badge bg-danger ms-2" style={{fontSize:12}}>{pedidosCatalogo.length}</span>
          </button>
        </div>
      )}

      {/* ── Modal pedidos catálogo ── */}
      {showPedidos && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9990}}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                <h5 className="modal-title fw-bold">Pedidos del catálogo asignados a ti</h5>
                <button className="btn-close btn-close-white" onClick={()=>setShowPedidos(false)}/>
              </div>
              <div className="modal-body p-3">
                {pedidosCatalogo.map(p => {
                  const tel = (p.cliente_telefono||'').replace(/\D/g,'');
                  const waLink = `https://wa.me/${tel.startsWith('57') ? tel : '57'+tel}`;
                  const estadoColor = {
                    pendiente:'warning', asignado:'info', en_camino:'primary', entregado:'success', cancelado:'secondary'
                  }[p.estado] || 'secondary';
                  const estadoLabel = {
                    pendiente:'⏳ Pendiente', asignado:'Asignado', en_camino:'En camino',
                    entregado:'Entregado', cancelado:'Cancelado'
                  }[p.estado] || p.estado;
                  return (
                  <div key={p.id} className={`card mb-3 border-${estadoColor} border-2`}>
                    <div className="card-header py-2 d-flex justify-content-between align-items-center"
                      style={{background:`var(--bs-${estadoColor}-bg-subtle,#fff)`}}>
                      <div>
                        <span className="fw-bold">{p.numero_pedido}</span>
                        <span className="text-muted small ms-2">{new Date(p.created_at).toLocaleString('es-CO', { timeZone:'America/Bogota' })}</span>
                      </div>
                      <span className={`badge bg-${estadoColor} text-${estadoColor==='warning'?'dark':'white'}`}>
                        {estadoLabel}
                      </span>
                    </div>
                    <div className="card-body p-3">

                      {/* Info cliente */}
                      <div className="p-2 rounded mb-2" style={{background:'#f8fafc'}}>
                        <div className="fw-semibold">{p.cliente_nombre}</div>
                        <div className="small">{p.cliente_telefono}</div>
                        <div className="small">{p.cliente_direccion}</div>
                        {p.notas && <div className="small text-muted">{p.notas}</div>}
                      </div>

                      {/* Productos */}
                      <div className="mb-2" style={{fontSize:12}}>
                        {p.items?.map((item,i) => (
                          <div key={i} className="d-flex justify-content-between">
                            <span>{item.quantity} × {item.product_name}</span>
                            <span className="fw-semibold">${Number(item.subtotal).toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                        <div className="d-flex justify-content-between fw-bold border-top pt-1 mt-1">
                          <span>Total</span>
                          <span className="text-success">${Number(p.total).toLocaleString('es-CO')}</span>
                        </div>
                      </div>

                      {/* Info domiciliario si ya fue asignado */}
                      {p.domiciliario_nombre && (
                        <div className="p-2 rounded mb-2" style={{background:'#eff6ff',fontSize:12}}>
                          <div className="fw-semibold text-primary">Domiciliario asignado:</div>
                          <div>{p.domiciliario_nombre} · {p.domiciliario_celular}</div>
                          {p.domiciliario && p.domiciliario.vehiculo && <div>Moto: {p.domiciliario.vehiculo}</div>}
                          {p.domiciliario && p.domiciliario.placa && <div>Placa: {p.domiciliario.placa}</div>}
                          <div className="mt-1 small text-muted">
                            El domiciliario debe enviar foto del comprobante al WhatsApp de la tienda
                          </div>
                        </div>
                      )}

                      {/* Botones de acción */}
                      <div className="d-flex gap-2 flex-wrap mt-2">
                        {/* Contactar cliente siempre disponible */}
                        <a href={waLink} target="_blank" rel="noreferrer"
                          className="btn btn-success btn-sm fw-semibold">
                          Contactar cliente
                        </a>

                        {/* Asignar domiciliario — solo si no tiene */}
                        {p.estado !== 'entregado' && p.estado !== 'cancelado' && !p.domiciliario_nombre && (
                          <button className="btn btn-warning btn-sm fw-semibold"
                            onClick={() => { setModalDomiciliario(p); setFormDom({nombre:'',celular:'',cedula:'',marca_moto:'',placa:''}); }}>
                            Asignar domiciliario
                          </button>
                        )}

                        {/* Confirmar entrega — directo, sin código */}
                        {p.estado === 'en_camino' && (
                          <button className="btn btn-success btn-sm fw-bold"
                            onClick={() => {
                              if (!window.confirm(`¿Confirmar que el pedido ${p.numero_pedido} fue entregado al cliente?`)) return;
                              apiFetch(`/domicilios/${p.id}/estado`,
                                { method:'PUT', body: JSON.stringify({ estado:'entregado' }) }, token)
                              .then(() => {
                                showAlert('success', `Pedido ${p.numero_pedido} marcado como entregado`);
                                apiFetch(`/domicilios?cajero_id=${user.id}`, {}, token)
                                  .then(data => setPedidosCatalogo(
                                    Array.isArray(data) ? data.filter(d =>
                                      ['CAT-','DOM-'].some(prefix => d.numero_pedido?.startsWith(prefix)) &&
                                      d.estado !== 'entregado' && d.estado !== 'cancelado'
                                    ) : []
                                  ));
                              })
                              .catch(() => showAlert('danger','Error al confirmar entrega'));
                            }}>
                            Confirmar entrega
                          </button>
                        )}

                        {/* Cancelar pedido */}
                        {p.estado !== 'entregado' && p.estado !== 'cancelado' && (
                          <button className="btn btn-outline-danger btn-sm"
                            onClick={() => {
                              if (!window.confirm('¿Cancelar este pedido?')) return;
                              apiFetch(`/domicilios/${p.id}/estado`,
                                {method:'PUT', body:JSON.stringify({estado:'cancelado'})}, token)
                              .then(() => {
                                apiFetch(`/domicilios?cajero_id=${user.id}&estado=en_camino`, {}, token)
                                  .then(data => setPedidosCatalogo(Array.isArray(data)
                                    ? data.filter(d => ['CAT-','DOM-'].some(p => d.numero_pedido?.startsWith(p))) : []));
                              });
                            }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCamaraIA && (
        <CamaraIA
          products={products}
          onAddToCart={(prod) => {
            setShowCamaraIA(false);
            // Si es por peso → abrir weightModal en el SalePanel activo
            const PESO_CATS = ['Frutas y Verduras', 'Carnes y Embutidos'];
            if (PESO_CATS.includes(prod.category)) {
              // Disparar evento para que SalePanel abra el modal de peso
              setCamaraProductoPeso(prod);
              return;
            }
            // Producto normal → agregar directo al carrito
            setTabs(prev => prev.map(t => {
              if (t.id !== activeTabId) return t;
              const key    = 'prod_' + prod.id;
              const existe = t.cart.find(c => c.cart_key === key);
              const newCart = existe
                ? t.cart.map(c => c.cart_key === key ? { ...c, quantity: c.quantity + 1 } : c)
                : [...t.cart, {
                    cart_key:       key,
                    product_id:     prod.id,
                    name:           prod.name,
                    price:          parseFloat(prod.sale_price || prod.price || 0),
                    original_price: parseFloat(prod.sale_price || prod.price || 0),
                    discount_pct:   0,
                    quantity:       1,
                    _type:          'product',
                    iva_type:       prod.iva_type || 'no_iva',
                    iva_pct:        parseFloat(prod.iva_pct || 0),
                  }];
              return { ...t, cart: newCart };
            }));
          }}
          onClose={() => setShowCamaraIA(false)}
        />
      )}

      {/* ── Modal Abrir Turno ── */}
      {showAbrirTurno && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.7)',zIndex:9999,position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:420,width:'90%',margin:'auto'}}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header" style={{background:'#1e3a5f',color:'#fff',borderRadius:'8px 8px 0 0'}}>
                <h5 className="modal-title fw-bold">Abrir Turno de Caja</h5>
              </div>
              <div className="modal-body p-4 text-center">
              <div style={{ fontSize: 52, marginBottom: 12 }}>
  </div>
                <p className="text-muted mb-3">
                  Bienvenido/a <strong>{user?.name}</strong>.
                </p>
                {cajasDisponibles.length > 1 && (
                  <div className="mb-3 text-start">
                    <label className="form-label fw-semibold small">
                      <i className="bi bi-display me-1"></i>¿En qué caja vas a trabajar? *
                    </label>
                    <select className="form-select" value={cajaSeleccionada}
                      onChange={e => setCajaSeleccionada(e.target.value)}>
                      <option value="">— Selecciona una caja —</option>
                      {cajasDisponibles.map(cj => (
                        <option key={cj.id} value={String(cj.id)}>{cj.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                {cajasDisponibles.length === 1 && (
                  <div className="alert alert-success py-2 small mb-3 text-start">
                    <i className="bi bi-display me-1"></i>
                    Caja: <strong>{cajasDisponibles[0].nombre}</strong>
                  </div>
                )}
              </div>
              <div className="modal-footer justify-content-center border-0 pb-4">
                <button className="btn btn-success btn-lg fw-bold px-5" onClick={abrirTurno}>
                  Abrir turno y comenzar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Cerrar Turno ── */}
      {showCerrarTurno && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.7)',zIndex:9999,position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div className="modal-dialog modal-dialog-centered" style={{maxWidth:440,width:'90%',margin:'auto'}}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header" style={{background:'#1e3a5f',color:'#fff',borderRadius:'8px 8px 0 0'}}>
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-box-arrow-right me-2"></i>Cerrar Turno
                </h5>
              </div>
              <div className="modal-body p-4">
                <div className="mb-3">
                  <label className="form-label fw-semibold">
                    <i className="bi bi-cash-coin me-1"></i>Total contado en caja
                  </label>
                  <div className="input-group input-group-lg">
                    <span className="input-group-text fw-bold">$</span>
                    <input type="number" className="form-control form-control-lg text-end fw-bold"
                      placeholder="0" value={efectivoContado}
                      onChange={e=>setEfectivoContado(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') cerrarTurnoYSesion(); }}
                      autoFocus/>
                  </div>
                </div>
              </div>
              <div className="modal-footer justify-content-between border-0 pb-4">
                <button className="btn btn-outline-secondary" onClick={()=>setShowCerrarTurno(false)}>
                  Cancelar
                </button>
                <button className="btn btn-danger fw-bold px-4" disabled={cierreLoading} onClick={cerrarTurnoYSesion}>
                  {cierreLoading
                    ? <><span className="spinner-border spinner-border-sm me-2"/>Cerrando...</>
                    : <><i className="bi bi-box-arrow-right me-2"></i>Cerrar turno y salir</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        show={!!confirmCancelVenta}
        titulo="¿Cancelar esta venta?"
        mensaje="El carrito será eliminado y los productos no se descontarán. Esta acción no se puede deshacer."
        txtConfirmar="Sí, cancelar venta"
        onConfirmar={() => { _doCloseTab(confirmCancelVenta); setConfirmCancelVenta(null); }}
        onCancelar={() => setConfirmCancelVenta(null)}
      />

      {/* Modal Asignar Domiciliario */}
      {modalDomiciliario && (
        <div className="modal d-block" style={{background:'rgba(0,0,0,0.6)',zIndex:9995,position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:'#fff',borderRadius:14,overflow:'hidden',maxWidth:400,width:'90%',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
            <div style={{background:'#1e3a5f',padding:'14px 20px'}}>
              <h5 style={{margin:0,fontWeight:700,color:'#fff'}}>Asignar Domiciliario</h5>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.75)'}}>Pedido {modalDomiciliario.numero_pedido}</div>
            </div>
            <div style={{padding:20}}>
              <div className="row g-2 mb-2">
                <div className="col-12">
                  <label className="form-label fw-semibold small mb-1">Nombre del domiciliario *</label>
                  <input className="form-control" placeholder="Ej: Juan Pérez" autoFocus
                    value={formDom.nombre} onChange={e=>setFormDom(f=>({...f,nombre:e.target.value}))}/>
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold small mb-1">Celular *</label>
                  <input className="form-control" placeholder="Ej: 3001234567" type="tel"
                    value={formDom.celular} onChange={e=>setFormDom(f=>({...f,celular:e.target.value}))}/>
                </div>
                <div className="col-12">
                  <label className="form-label fw-semibold small mb-1">Cédula</label>
                  <input className="form-control" placeholder="Ej: 1234567890"
                    value={formDom.cedula} onChange={e=>setFormDom(f=>({...f,cedula:e.target.value}))}/>
                </div>
                <div className="col-7">
                  <label className="form-label fw-semibold small mb-1">Marca de la moto</label>
                  <input className="form-control" placeholder="Ej: Honda, Yamaha..."
                    value={formDom.marca_moto} onChange={e=>setFormDom(f=>({...f,marca_moto:e.target.value}))}/>
                </div>
                <div className="col-5">
                  <label className="form-label fw-semibold small mb-1">Placa</label>
                  <input className="form-control" placeholder="Ej: ABC123"
                    value={formDom.placa}
                    onChange={e=>setFormDom(f=>({...f,placa:e.target.value.toUpperCase()}))}/>
                </div>
              </div>
              <div className="alert alert-info py-2 small mb-0">
                Se imprimirá el comprobante de envío con el código de entrega automáticamente.
              </div>
            </div>
            <div style={{padding:'0 20px 20px',display:'flex',gap:10}}>
              <button className="btn btn-outline-secondary flex-fill"
                onClick={()=>{ setModalDomiciliario(null); setFormDom({nombre:'',celular:'',cedula:'',marca_moto:'',placa:''}); }}>
                Cancelar
              </button>
              <button className="btn btn-warning fw-bold flex-fill" onClick={asignarDomiciliarioS}>
                <i className="bi bi-scooter"></i> Enviar pedido
              </button>
            </div>
          </div>
        </div>
      )}


      </div>
  );
};

export default Sales;