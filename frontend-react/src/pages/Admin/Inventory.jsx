import React, { useEffect, useState, useRef, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { inventoryService } from '../../services/inventoryService';
import { productService } from '../../services/productService';
import { supplierService } from '../../services/supplierService';
import { apiFetch } from '../../services/api';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n) =>
  n != null ? Number(n).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }) : '—';

const dname = (p) => {
  if (!p) return '';
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const q = parseFloat(p.gramaje_cantidad);
    return `${p.name} · ${q === Math.floor(q) ? Math.floor(q) : q} ${p.gramaje_unidad}`;
  }
  return p.name;
};
// Parsea números colombianos: "3.400" → 3000, "3,4" → 3.4
const parseCOP = (val) => {
  if (!val && val !== 0) return NaN;
  const s = String(val).trim();
  if (s.includes('.') && s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.'));
  if (s.includes('.')) {
    const parts = s.split('.');
    if (parts[1]?.length === 3) return parseFloat(s.replace('.', ''));
  }
  return parseFloat(s);
};
const autoPrice = (costo, gPct, ivaTipo = 19) => {
  const c = parseCOP(costo), g = parseCOP(gPct), v = parseFloat(ivaTipo) / 100;
  if (!c || isNaN(g)) return '';
  return Math.round(c * (1 + g / 100) * (1 + v));
};

const IVA_OPTS = [
  { v:19, label:'19% — procesados, bebidas, snacks' },
  { v: 5, label:'5%  — canasta básica' },
  { v: 0, label:'0%  — frutas, verduras, carnes, huevos, leche, pan, arroz' },
];
const CATS = [
  '🥦 Frutas y Verduras','🥩 Carnes y Embutidos','🥛 Lácteos y Huevos',
  '🍞 Panadería y Repostería','🥤 Bebidas y Jugos','🍺 Bebidas Alcohólicas',
  '🍿 Snacks y Dulces','🥫 Enlatados y Conservas','🌾 Granos y Cereales',
  '🫙 Aceites y Condimentos','🧊 Congelados','🧹 Limpieza del Hogar',
  '🧴 Higiene Personal','👶 Bebés y Maternidad','🐾 Mascotas',
  '📝 Papelería','🔋 Electrónica y Pilas','💊 Medicamentos Básicos','📦 Otros',
];

const stockColor = (p) => {
  if (!p) return 'bg-secondary';
  const t = p.min_stock ?? 5;
  if (p.stock <= t)   return 'bg-danger';
  if (p.stock <= t*2) return 'bg-warning text-dark';
  return 'bg-success';
};

/* ─── Buscador unificado (nombre + código) ────────────────────────────────── */
const Searcher = ({ products, onSelect, excludeIds = [], placeholder }) => {
  const [q,    setQ]    = useState('');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const run = (val) => {
    setQ(val);
    if (!val.trim()) { setList([]); setOpen(false); return; }
    const found = products
      .filter(p => !excludeIds.includes(p.id))
      .filter(p =>
        p.name.toLowerCase().includes(val.toLowerCase()) ||
        dname(p).toLowerCase().includes(val.toLowerCase()) ||
        (p.barcode && p.barcode.includes(val))
      ).slice(0, 12);
    setList(found);
    setOpen(found.length > 0);
  };

  const pick = (p) => {
    onSelect(p);
    setQ(''); setList([]); setOpen(false);
    setTimeout(() => ref.current?.focus(), 80);
  };

  const onKey = (e) => {
    if (e.key === 'Enter') {
      const exact = products.find(p => p.barcode === q.trim());
      if (exact) { pick(exact); return; }
      if (list.length === 1) { pick(list[0]); return; }
    }
    if (e.key === 'Escape') { setQ(''); setList([]); setOpen(false); }
  };

  return (
    <div style={{ position:'relative' }}>
      <div className="input-group">
        <span className="input-group-text bg-dark text-white">🔍</span>
        <input ref={ref} className="form-control" autoComplete="off"
          placeholder={placeholder || 'Nombre o código de barras — escanear o escribir...'}
          value={q}
          onChange={e => run(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => list.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {q && <button type="button" className="btn btn-outline-secondary"
          onClick={() => { setQ(''); setList([]); setOpen(false); ref.current?.focus(); }}>✕</button>}
      </div>
      <div className="text-muted mt-1" style={{ fontSize:11 }}>
        📦 Escanea → agrega directo &nbsp;|&nbsp; ✍️ Escribe nombre → elige del listado
      </div>

      {open && (
        <div className="border rounded shadow" style={{ position:'absolute', zIndex:200, top:'100%', left:0, right:0, maxHeight:300, overflowY:'auto', background:'#fff' }}>
          {list.map(p => (
            <div key={p.id} className="px-3 py-2 border-bottom"
              style={{ cursor:'pointer', background: p.stock===0 ? '#fff5f5':'white' }}
              onMouseDown={e => { e.preventDefault(); pick(p); }}>
              <div className="fw-semibold" style={{ fontSize:13 }}>
                {dname(p)}
                {p.barcode && <span className="text-muted ms-2" style={{ fontSize:10, fontFamily:'monospace' }}>📦 {p.barcode}</span>}
              </div>
              <div className="d-flex gap-2 flex-wrap align-items-center mt-1" style={{ fontSize:11 }}>
                <span className="text-success fw-bold">{fmt(p.price)}</span>
                <span className="text-muted">{p.category || '—'}</span>
                <span className={`badge ${stockColor(p)}`}>Stock: {p.stock}</span>
                {p.line_name && <span className="badge px-1" style={{ background:p.line_color||'#6b7280', color:'#fff', fontSize:9 }}>{p.line_name}</span>}
                {p.stock_alert && <span className="badge bg-danger" style={{ fontSize:9 }}>⚠️ Bajo</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {q.length >= 1 && list.length === 0 && (
        <div className="px-3 py-2 border rounded mt-1 text-muted small text-center" style={{ background:'#fff5f5' }}>
          ❌ No se encontró "{q}"
        </div>
      )}
    </div>
  );
};

/* ─── Historial ────────────────────────────────────────────────────────────── */
const Historial = ({ movements, products }) => {
  const entries = movements.filter(m => m.type === 'entrada');
  const exits   = movements.filter(m => m.type === 'salida');
  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-header fw-semibold">📥 Entradas registradas</div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize:13 }}>
              <thead className="table-light">
                <tr><th>Producto</th><th>Stock</th><th>Costo unit.</th><th>Egreso total</th><th>Vencimiento</th><th>Proveedor</th><th>Razón</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {entries.length === 0
                  ? <tr><td colSpan="8" className="text-center text-muted py-4">Sin entradas registradas</td></tr>
                  : entries.map(m => {
                    const p = products.find(x => x.id === m.product_id);
                    return (
                      <tr key={m.id}>
                       <td className="fw-semibold">
                         {p ? dname(p) : m.product}
                        {p?.stock_alert && <span className="badge bg-danger ms-1" style={{ fontSize:9 }}>⚠️</span>}
                         </td>
                        <td><span className={`badge ${stockColor(p)}`}>{p?.stock ?? '—'}</span></td>
                        <td>{m.unit_cost ? fmt(m.unit_cost) : <span className="text-muted">—</span>}</td>
                        <td className="fw-bold text-danger">{m.total_cost ? fmt(m.total_cost) : '—'}</td>
                        <td>{m.expiry_date ? <span className="badge bg-warning text-dark">📅 {m.expiry_date}</span> : <span className="text-muted">—</span>}</td>
                        <td className="text-muted">{m.supplier || '—'}</td>
                        <td className="text-muted" style={{ maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.reason}</td>
                        <td className="text-muted">{m.created_at?.slice(0,10)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col-12">
        <div className="card border-0 shadow-sm">
          <div className="card-header fw-semibold">📤 Salidas registradas</div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize:13 }}>
              <thead className="table-light">
                <tr><th>Producto</th><th>Stock</th><th>Motivo</th><th>Fecha</th></tr>
              </thead>
              <tbody>
                {exits.length === 0
                  ? <tr><td colSpan="4" className="text-center text-muted py-4">Sin salidas registradas</td></tr>
                  : exits.map(m => {
                    const p = products.find(x => x.id === m.product_id);
                    return (
                      <tr key={m.id}>
                        <td className="fw-semibold">{p ? dname(p) : m.product}</td>
                        <td><span className={`badge ${stockColor(p)}`}>{p?.stock ?? '—'}</span></td>
                        <td>{m.reason}</td>
                        <td className="text-muted">{m.created_at?.slice(0,10)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Panel de edición de una fila (modal inline) ──────────────────────────── */
const RowEditor = ({ row, products, onSave, onCancel }) => {
  const [r, setR] = useState({ ...row });
  const p = r.product;
  const iva = p?.iva_type ?? r.iva_type ?? 19;
  const ivaRate = iva / 100;

  const set = (k, v) => {
    setR(prev => {
      const upd = { ...prev, [k]: v };
      if (!prev.price_manual && (k==='unit_cost'||k==='ganancia_pct')) {
        const c = k==='unit_cost'    ? v : prev.unit_cost;
        const g = k==='ganancia_pct' ? v : prev.ganancia_pct;
        const pv = autoPrice(c, g, iva);
        if (pv !== '') upd.price = String(pv);
      }
      if (k==='iva_type' && !prev.price_manual) {
        const pv = autoPrice(prev.unit_cost, prev.ganancia_pct, v);
        if (pv !== '') upd.price = String(pv);
      }
      return upd;
    });
  };

  const pv    = parseCOP(r.price)     || 0;
  const costo = parseCOP(r.unit_cost) || 0; 
  const sinIva   = pv > 0 ? (ivaRate > 0 ? pv/(1+ivaRate) : pv) : 0;
  const ivaDian  = pv - sinIva;
  const ganBruta = costo > 0 ? sinIva - costo : 0;
  const margen   = costo > 0 ? (ganBruta/costo*100).toFixed(1) : null;
  const egreso   = costo > 0 && r.quantity ? costo * parseInt(r.quantity||0) : null;
  const verif    = costo > 0 && pv > 0 && Math.abs((costo+ivaDian+ganBruta)-pv) < 1;

  return (
    <div className="p-3" style={{ background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
      {/* Cabecera del editor */}
      <div className="fw-semibold mb-3 d-flex align-items-center gap-2" style={{ fontSize:13 }}>
        {r.mode === 'new'
          ? <><span className="badge bg-success">✨ Nuevo</span> {r.name || 'Producto nuevo'}</>
          : <><span className="badge bg-dark">📦</span> {dname(r.product)}</>
        }
      </div>

      {/* Datos del producto NUEVO */}
      {r.mode === 'new' && (
        <div className="row g-2 mb-3 pb-3 border-bottom">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Nombre *</label>
            <input className="form-control form-control-sm" value={r.name}
              onChange={e => set('name', e.target.value)} placeholder="Ej: Arroz Diana" />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Código de barras</label>
            <input className="form-control form-control-sm" value={r.barcode}
              onChange={e => set('barcode', e.target.value)} placeholder="Opcional" />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Categoría</label>
            <select className="form-select form-select-sm" value={r.category}
              onChange={e => set('category', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Gramaje</label>
            <input className="form-control form-control-sm" placeholder="500"
              value={r.gramaje_cantidad} onChange={e => set('gramaje_cantidad', e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Unidad</label>
            <select className="form-select form-select-sm" value={r.gramaje_unidad}
              onChange={e => set('gramaje_unidad', e.target.value)}>
              <option value="">—</option>
              {['g','kg','ml','L','und','oz','lb'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">🏛️ Tipo de IVA</label>
            <select className="form-select form-select-sm" value={r.iva_type}
              onChange={e => set('iva_type', parseInt(e.target.value))}>
              {IVA_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">⚠️ Stock mínimo para alerta</label>
            <div className="input-group input-group-sm">
              <input className="form-control" type="number" min="0" value={r.min_stock}
                onChange={e => set('min_stock', e.target.value)} />
              <span className="input-group-text">uds</span>
            </div>
          </div>
        </div>
      )}

      {/* Campos de precios — comunes para existente y nuevo */}
      <div className="row g-2 align-items-end mb-3">
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Cantidad *</label>
          <input className="form-control form-control-sm" type="number" min="1" placeholder="0"
            value={r.quantity} onChange={e => set('quantity', e.target.value)} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Precio llegada *</label>
          <div className="input-group input-group-sm">
            <span className="input-group-text">$</span>
            <input className="form-control" type="number" min="0" step="1" placeholder="0"
              value={r.unit_cost} onChange={e => set('unit_cost', e.target.value)} />
          </div>
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small fw-semibold">% Ganancia</label>
          <div className="input-group input-group-sm">
            <input className="form-control" type="number" min="0" step="0.1" placeholder="71"
              value={r.ganancia_pct} onChange={e => set('ganancia_pct', e.target.value)} />
            <span className="input-group-text">%</span>
          </div>
          {p && <div className="form-text" style={{ fontSize:10 }}>IVA: <b>{p.iva_type ?? 19}%</b></div>}
        </div>
        <div className="col-6 col-md-4">
          <label className="form-label small fw-semibold d-flex align-items-center gap-1">
            Precio de venta *
            <span className="badge bg-light text-dark border" style={{ fontSize:9, fontWeight:400 }}>
              {!r.price_manual && r.unit_cost && r.ganancia_pct ? '⚡ Auto' : '✏️ Manual'}
            </span>
          </label>
          <div className="input-group input-group-sm">
            <span className="input-group-text">$</span>
            <input className="form-control" type="number" min="0" step="1" value={r.price}
              onChange={e => setR(prev => ({ ...prev, price: e.target.value, price_manual: true }))} />
            {r.price_manual && (
              <button type="button" className="btn btn-outline-secondary btn-sm" title="Recalcular automático"
                onClick={() => {
                  const pv = autoPrice(r.unit_cost, r.ganancia_pct, iva);
                  if (pv !== '') setR(prev => ({ ...prev, price: String(pv), price_manual: false }));
                }}>⚡</button>
            )}
          </div>
        </div>
        <div className="col-md-4">
          <label className="form-label small fw-semibold">📅 Vencimiento del lote</label>
          <input className="form-control form-control-sm" type="date"
            value={r.expiry_date} onChange={e => set('expiry_date', e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label small fw-semibold">🏷️ Número de lote</label>
          <input className="form-control form-control-sm" type="text"
            placeholder="Ej: L-2026-001 (opcional)"
            value={r.numero_lote||''} onChange={e => set('numero_lote', e.target.value)} />
        </div>
      </div>

      {/* Preview financiero */}
      {pv > 0 && costo > 0 && (
        <div className="rounded px-3 py-2 mb-3 d-flex flex-wrap gap-3" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:12 }}>
          <span>💵 Costo: <b>{fmt(costo)}</b></span>
          <span>🏷️ Venta: <b>{fmt(pv)}</b></span>
          <span>🏛️ IVA/ud: <b style={{ color:'#7c3aed' }}>{fmt(Math.round(ivaDian))}</b></span>
          <span>💰 Ganancia: <b style={{ color: ganBruta>=0?'#059669':'#dc2626' }}>{fmt(Math.round(ganBruta))}</b></span>
          {margen !== null && (
            <span>📊 Margen: <b style={{ color: parseFloat(margen)<10?'#dc2626':parseFloat(margen)<25?'#d97706':'#059669' }}>{margen}%</b></span>
          )}
          {egreso !== null && r.quantity && (
            <span>📦 Egreso: <b className="text-danger">{fmt(egreso)}</b></span>
          )}
          {verif && <span style={{ color:'#059669', fontSize:10 }}>✅ Verificado</span>}
        </div>
      )}

      {/* Acciones */}
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-success btn-sm px-4 fw-bold"
          onClick={() => onSave(r)}>
          ✅ Guardar en pedido
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm"
          onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
};

/* ─── Comprobante de entrada ─────────────────────────────────────────────── */
const Comprobante = ({ result, header, suppliers, onClose }) => {
  const ref = useRef();
  const sup = suppliers.find(s => s.id === parseInt(header.supplier_id));

  const print = () => {
    const w = window.open('', '_blank', 'width=600,height=800');
    w.document.write(`<html><head><title>Comprobante de Entrada</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}
    table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;}
    th{background:#f0f0f0;font-weight:bold;}.total{font-weight:bold;font-size:14px;}</style>
    </head><body>${ref.current.innerHTML}
    <script>window.onload=function(){window.print();window.close();}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="modal d-block" style={{ background:'rgba(0,0,0,0.6)', zIndex:9999 }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h6 className="modal-title fw-bold">🧾 Comprobante de entrada</h6>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body" style={{ background:'#fafafa' }}>
            <div ref={ref} style={{ background:'#fff', padding:20 }}>
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <div style={{ fontSize:18, fontWeight:'bold' }}>COMPROBANTE DE ENTRADA</div>
                  <div className="text-muted" style={{ fontSize:12 }}>SmartMerca POS</div>
                </div>
                <div className="text-end" style={{ fontSize:12 }}>
                  <div><b>Fecha:</b> {new Date().toLocaleString('es-CO')}</div>
                  {header.invoice_num && <div><b>Factura proveedor:</b> {header.invoice_num}</div>}
                  {sup && <div><b>Proveedor:</b> {sup.company_name || sup.name}</div>}
                  <div><b>Razón:</b> {header.reason}</div>
                </div>
              </div>
              <hr />
              <table>
                <thead>
                  <tr>
                    <th>Código</th><th>Producto</th><th>Cantidad</th>
                    <th>Costo unit.</th><th>Total egreso</th><th>P. Venta</th><th>Vencimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {result.itemsSaved?.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily:'monospace', fontSize:10 }}>{item.barcode || '—'}</td>
                      <td><b>{item.name}</b></td>
                      <td>{item.quantity}</td>
                      <td>{fmt(item.unit_cost)}</td>
                      <td className="total">{fmt(item.unit_cost && item.quantity ? item.unit_cost * item.quantity : null)}</td>
                      <td>{fmt(item.price)}</td>
                      <td>{item.expiry_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4" style={{ textAlign:'right', fontWeight:'bold', background:'#f0f0f0' }}>TOTAL EGRESO DEL PEDIDO:</td>
                    <td style={{ fontWeight:'bold', fontSize:14, background:'#f0f0f0' }}>{fmt(result.total_egreso)}</td>
                    <td colSpan="2" style={{ background:'#f0f0f0' }}></td>
                  </tr>
                </tfoot>
              </table>
              {result.errors?.length > 0 && (
                <div style={{ marginTop:12, padding:8, background:'#fff3cd', borderRadius:4, fontSize:11 }}>
                  <b>Con errores:</b> {result.errors.join(' | ')}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cerrar</button>
            <button className="btn btn-dark fw-bold" onClick={print}>🖨️ Imprimir comprobante</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Componente principal ─────────────────────────────────────────────────── */
const Inventory = () => {
  const { token } = useAuth();
  const [movements, setMovements] = useState([]);
  const [products,  setProducts]  = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [batches,   setBatches]   = useState([]);
  const [tab,       setTab]       = useState('historial');
  const [alert,     setAlert]     = useState(null);
  const [loading,   setLoading]   = useState(false);

  /* Encabezado del pedido */
  const [header, setHeader] = useState({
    supplier_id: '', invoice_num: '', reason: 'Llegada de mercancía',
  });

  /* Filas confirmadas en la tabla del pedido */
  const [rows, setRows] = useState([]);

  /* Fila en edición (null = ninguna, 'new_existing', 'new_new', o _id de fila) */
  const [editing, setEditing] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

  /* Comprobante final */
  const [comprobante, setComprobante] = useState(null);

  /* Salida */
  const [exitProduct, setExitProduct] = useState(null);
  const [exitQty,     setExitQty]     = useState('');
  const [exitReason,  setExitReason]  = useState('Producto dañado');

  const load = useCallback(async () => {
    try {
      const [mv, pr, su, bt] = await Promise.all([
        inventoryService.getAll(token),
        productService.getAll(token),
        supplierService.getAll(token),
        apiFetch('/inventory/batches', {}, token).catch(()=>[]),
      ]);
      setMovements(mv); setProducts(pr); setSuppliers(su);
      setBatches(Array.isArray(bt) ? bt : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4500); };

  /* Abrir editor para producto EXISTENTE seleccionado del buscador */
  const openExisting = (prod) => {
    setEditingRow({
      _id:         Date.now(),
      mode:        'existing',
      product:     prod,
      product_id:  prod.id,
      name:        '',
      category:    '',
      barcode:     prod.barcode || '',
      iva_type:    prod.iva_type ?? 19,
      min_stock:   prod.min_stock ?? 5,
      gramaje_cantidad: '',
      gramaje_unidad:   '',
      quantity:    '',
      unit_cost:   '',
      ganancia_pct:'',
      price:       String(prod.price),
      price_manual:false,
      expiry_date: prod.expiry_date || '',
    });
    setEditing('editor');
  };

  /* Abrir editor para producto NUEVO */
  const openNew = () => {
    setEditingRow({
      _id:         Date.now(),
      mode:        'new',
      product:     null,
      product_id:  null,
      name:        '',
      category:    '',
      barcode:     '',
      iva_type:    19,
      min_stock:   5,
      gramaje_cantidad: '',
      gramaje_unidad:   '',
      quantity:    '',
      unit_cost:   '',
      ganancia_pct:'',
      price:       '',
      price_manual:false,
      expiry_date: '',
      numero_lote: '',
    });
    setEditing('editor');
  };

  /* Editar fila ya confirmada */
  const editRow = (row) => { setEditingRow({ ...row }); setEditing('editor'); };

  /* Guardar fila desde el editor */
  const saveRow = (r) => {
    if (r.mode === 'existing' && !r.product_id) { showAlert('danger','Selecciona un producto'); return; }
    if (r.mode === 'new' && !r.name) { showAlert('danger','El nombre es requerido'); return; }
    if (!r.quantity || !r.unit_cost || !r.price) { showAlert('danger','Completa cantidad, costo y precio de venta'); return; }

    setRows(prev => {
      const exists = prev.find(x => x._id === r._id);
      if (exists) return prev.map(x => x._id === r._id ? r : x);
      return [...prev, r];
    });
    setEditing(null);
    setEditingRow(null);
  };

  /* Eliminar fila */
  const deleteRow = (id) => setRows(prev => prev.filter(r => r._id !== id));

  /* Confirmar pedido completo */
  const confirmOrder = async () => {
    if (!rows.length) { showAlert('danger','Agrega al menos un producto al pedido'); return; }
    setLoading(true);
    try {
      const items = rows.map(r => ({
        product_id:       r.product_id || null,
        name:             r.name || null,
        category:         r.category || null,
        barcode:          r.barcode || null,
        iva_type:         r.iva_type ?? 19,
        min_stock:        r.min_stock ?? 5,
        gramaje_cantidad: r.gramaje_cantidad || null,
        gramaje_unidad:   r.gramaje_unidad || null,
        iva_type:         parseInt(r.iva_type) || 19,
        quantity:         parseInt(r.quantity),
        unit_cost:        parseCOP(r.unit_cost),
        price:            parseFloat(r.price),
        expiry_date:      r.expiry_date || null,
        numero_lote:      r.numero_lote || null,
      }));

      const res = await inventoryService.addEntryBatch({ header, items }, token);

      // Si la factura quedó pendiente, crear en Cuentas por Pagar
      if (header.factura_pendiente === 'si' && header.supplier_id) {
        try {
          const totalPedidoCalc = rows.reduce((a,r)=>(a+(parseCOP(r.unit_cost)||0)*(parseInt(r.quantity)||0)),0);
          await apiFetch('/supplier-invoices/', {
            method: 'POST',
            body: JSON.stringify({
              supplier_id:    header.supplier_id,
              numero_factura: header.invoice_num || `AUTO-${Date.now()}`,
              fecha_emision:  new Date().toISOString().slice(0,10),
              fecha_vencimiento: header.fecha_limite_pago || null,
              monto_total:    totalPedidoCalc,
              descripcion:    `Generada automáticamente desde entrada de inventario — ${header.reason}`,
            })
          }, token);
          showAlert('success', '✅ Pedido registrado y factura agregada a Cuentas por Pagar');
        } catch(fe) {
          showAlert('success', '✅ Pedido registrado (no se pudo crear la factura pendiente)');
        }
      }

      // Armar comprobante
      setComprobante({
        ...res,
        itemsSaved: rows.map(r => ({
          barcode:     r.barcode || r.product?.barcode || '',
          name:        r.mode === 'existing' ? dname(r.product) : r.name,
          quantity:    r.quantity,
          unit_cost:   parseCOP(r.unit_cost),
          price:       parseFloat(r.price),
          expiry_date: r.expiry_date || '',
        })),
      });

      setRows([]);
      setHeader({ supplier_id:'', invoice_num:'', reason:'Llegada de mercancía' });
      setEditing(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  /* Salida */
  const handleExit = async (e) => {
    e.preventDefault();
    if (!exitProduct) { showAlert('danger','Selecciona un producto'); return; }
    setLoading(true);
    try {
      await inventoryService.addExit({
        product_id: exitProduct.id,
        quantity:   parseInt(exitQty),
        reason:     exitReason,
      }, token);

      // Si el motivo es de merma, registrar automáticamente
      const motivosMerma = ['Producto dañado','Producto vencido','Robo o pérdida','Muestra/degustación'];
      if (motivosMerma.some(m => exitReason.includes(m.split('/')[0]))) {
        try {
          await apiFetch('/shrinkage/', {
            method: 'POST',
            body: JSON.stringify({
              product_id:  exitProduct.id,
              tipo:        exitReason.includes('dañado') ? 'averia' :
                           exitReason.includes('vencido') ? 'vencimiento' :
                           exitReason.includes('Robo') ? 'robo' : 'merma',
              cantidad:    parseInt(exitQty),
              costo_total: parseFloat(exitProduct.price || 0) * parseInt(exitQty),
              descripcion: `Registrado automáticamente desde salida de inventario`,
            })
          }, token);
        } catch(me) { console.warn('Merma no registrada:', me.message); }
      }

      showAlert('success','Salida registrada' + (motivosMerma.some(m=>exitReason.includes(m.split('/')[0])) ? ' y merma registrada automáticamente' : ''));
      setExitProduct(null); setExitQty(''); setExitReason('Producto dañado');
      load();
    } catch(e) { showAlert('danger',e.message); }
    finally { setLoading(false); }
  };

  const totalPedido = rows.reduce((a,r) => a + (parseCOP(r.unit_cost)||0)*(parseInt(r.quantity)||0), 0);
  const idsEnPedido = rows.filter(r=>r.mode==='existing').map(r=>r.product_id);

  /* ── Paso visual ── */
  const Step = ({ n, label, active, done }) => (
    <div className="d-flex align-items-center gap-2">
      <div style={{
        width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
        fontWeight:'bold', fontSize:13, flexShrink:0,
        background: done ? '#059669' : active ? '#1e3a5f' : '#e2e8f0',
        color: done || active ? '#fff' : '#94a3b8',
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize:13, fontWeight: active ? 700 : 400, color: active ? '#1e3a5f' : '#64748b' }}>
        {label}
      </span>
    </div>
  );

  const paso = editing === 'editor' ? 3 : rows.length > 0 ? 5 : 2;

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, minHeight:'100vh', background:'#f8fafc' }}>
        <h4 className="fw-bold mb-4">📦 Inventario</h4>

        {alert && <div className={`alert alert-${alert.type} alert-dismissible mb-3`}>{alert.msg}</div>}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          {[['historial','📜 Historial'],['lotes','📦 Lotes activos'],['entrada','📦 Registrar Pedido'],['salida','📤 Registrar Salida']].map(([k,l]) => (
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* ══════════════════════ HISTORIAL ══════════════════════ */}
        {tab === 'historial' && <Historial movements={movements} products={products} />}

        {/* ══════════════════════ LOTES ACTIVOS ══════════════════════ */}
        {tab === 'lotes' && (
          <div>
            {!batches.length ? (
              <div className="text-center text-muted py-5">
                <div className="fs-2">📦</div>
                <div>No hay lotes activos. Los lotes se crean automáticamente al registrar entradas de inventario.</div>
              </div>
            ) : (
              (() => {
                // Agrupar lotes por producto
                const byProduct = {};
                batches.forEach(b => {
                  if (!byProduct[b.product_id]) byProduct[b.product_id] = { name: b.product_name, lotes: [] };
                  byProduct[b.product_id].lotes.push(b);
                });
                const hoy = new Date(); hoy.setHours(0,0,0,0);
                const todosLotes = batches;
                const vencidos   = todosLotes.filter(b => b.fecha_vencimiento && new Date(b.fecha_vencimiento + 'T00:00:00') < hoy);
                const proximos7  = todosLotes.filter(b => {
                  if (!b.fecha_vencimiento) return false;
                  const d = Math.round((new Date(b.fecha_vencimiento + 'T00:00:00') - hoy) / (1000*60*60*24));
                  return d >= 0 && d <= 7;
                });

                return (
                  <>
                    {/* Resumen alertas */}
                    {(vencidos.length > 0 || proximos7.length > 0) && (
                      <div className="row g-2 mb-3">
                        {vencidos.length > 0 && (
                          <div className="col-auto">
                            <div className="alert alert-danger py-2 mb-0 d-flex align-items-center gap-2">
                              <span>🚨 <strong>{vencidos.length}</strong> lote(s) vencido(s)</span>
                            </div>
                          </div>
                        )}
                        {proximos7.length > 0 && (
                          <div className="col-auto">
                            <div className="alert alert-warning py-2 mb-0 d-flex align-items-center gap-2">
                              <span>⚠️ <strong>{proximos7.length}</strong> lote(s) vence(n) en 7 días</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  <div className="card border-0 shadow-sm">
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                        <thead className="table-light">
                          <tr>
                            <th>Producto</th><th>Nro. lote</th>
                            <th className="text-end">Inicial</th><th className="text-end">Actual</th>
                            <th>Vencimiento</th><th className="text-end">Costo unit.</th><th>Entrada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(byProduct).map(({ name, lotes }) =>
                            lotes.map((b, i) => {
                              const venc = b.fecha_vencimiento ? new Date(b.fecha_vencimiento + 'T00:00:00') : null;
                              const diasVenc = venc ? Math.round((venc - hoy) / (1000*60*60*24)) : null;
                              const vencColor = diasVenc === null ? '' : diasVenc < 0 ? '#fff5f5' : diasVenc <= 7 ? '#fffbeb' : '';
                              return (
                                <tr key={b.id} style={{background: vencColor}}>
                                  {i === 0 && <td rowSpan={lotes.length} className="fw-semibold align-middle">{name}</td>}
                                  <td className="text-muted">{b.numero_lote || `#${b.id}`}</td>
                                  <td className="text-end">{b.cantidad_inicial}</td>
                                  <td className="text-end fw-bold">{b.cantidad_actual}</td>
                                  <td>
                                    {b.fecha_vencimiento ? (
                                      <span className={`badge ${diasVenc < 0 ? 'bg-danger' : diasVenc <= 7 ? 'bg-warning text-dark' : 'bg-success'}`}>
                                        📅 {b.fecha_vencimiento}
                                        {diasVenc !== null && (
                                          diasVenc < 0
                                            ? ` — Vencido hace ${Math.abs(diasVenc)} día(s)`
                                            : diasVenc === 0
                                            ? ' — Vence hoy'
                                            : ` — ${diasVenc} día(s)`
                                        )}
                                      </span>
                                    ) : <span className="text-muted">Sin fecha</span>}
                                  </td>
                                  <td className="text-end">{b.costo_unitario ? fmt(b.costo_unitario) : '—'}</td>
                                  <td className="text-muted">{b.fecha_entrada?.slice(0,10)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  </>
                );
              })()
            )}
          </div>
        )}

        {/* ══════════════════════ PEDIDO ══════════════════════ */}
        {tab === 'entrada' && (
          <div style={{ maxWidth:960 }}>

            {/* Barra de pasos */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body py-3">
                <div className="d-flex align-items-center gap-4 flex-wrap">
                  <Step n={1} label="Datos del pedido"   active={paso<2}   done={paso>=2} />
                  <div style={{ flex:1, height:2, background:'#e2e8f0', minWidth:20 }} />
                  <Step n={2} label="Agregar productos"  active={paso===2}  done={paso>=3} />
                  <div style={{ flex:1, height:2, background:'#e2e8f0', minWidth:20 }} />
                  <Step n={3} label="Detalles de precios" active={paso===3} done={paso>=4} />
                  <div style={{ flex:1, height:2, background:'#e2e8f0', minWidth:20 }} />
                  <Step n={4} label="Revisar pedido"     active={paso===5}  done={false} />
                  <div style={{ flex:1, height:2, background:'#e2e8f0', minWidth:20 }} />
                  <Step n={5} label="Confirmar entrada"  active={false}     done={false} />
                </div>
              </div>
            </div>

            {/* ── PASO 1: Datos del pedido ── */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header d-flex align-items-center gap-2 py-3"
                style={{ background:'#1e3a5f', color:'#fff', borderRadius:'8px 8px 0 0' }}>
                <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:12 }}>1</span>
                <span className="fw-semibold">Datos del pedido</span>
                <span className="ms-auto badge bg-light text-dark" style={{ fontSize:10 }}>Se llena una sola vez</span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                  <label className="form-label fw-semibold small">🚚 Proveedor (NIT o nombre)</label>
<div className="position-relative">
  <input className="form-control" placeholder="Escribe NIT o nombre..."
    value={header.supplierSearch || ''}
    onChange={e => setHeader({...header, supplierSearch: e.target.value, supplier_id: ''})}
    autoComplete="off"
  />
  {(header.supplierSearch || '') && !header.supplier_id && (
    <div className="border rounded bg-white shadow-sm position-absolute w-100"
      style={{ zIndex:300, maxHeight:180, overflowY:'auto', top:'100%' }}>
      {suppliers.filter(s =>
        (s.nit && s.nit.toLowerCase().includes((header.supplierSearch||'').toLowerCase())) ||
        (s.company_name && s.company_name.toLowerCase().includes((header.supplierSearch||'').toLowerCase())) ||
        (s.name && s.name.toLowerCase().includes((header.supplierSearch||'').toLowerCase()))
      ).length === 0
        ? <div className="px-3 py-2 text-muted small">Sin resultados</div>
        : suppliers.filter(s =>
            (s.nit && s.nit.toLowerCase().includes((header.supplierSearch||'').toLowerCase())) ||
            (s.company_name && s.company_name.toLowerCase().includes((header.supplierSearch||'').toLowerCase())) ||
            (s.name && s.name.toLowerCase().includes((header.supplierSearch||'').toLowerCase()))
          ).map(s => (
            <div key={s.id} className="px-3 py-2 border-bottom"
              style={{ cursor:'pointer', fontSize:13 }}
              onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'}
              onMouseLeave={e => e.currentTarget.style.background=''}
              onMouseDown={e => {
                e.preventDefault();
                setHeader({
                  ...header,
                  supplier_id:    String(s.id),
                  supplierSearch: (s.nit ? s.nit + ' — ' : '') + (s.company_name || s.name)
                });
              }}>
              <span className="fw-semibold">{s.company_name || s.name}</span>
              {s.nit && <span className="text-muted ms-2" style={{fontFamily:'monospace', fontSize:11}}>NIT: {s.nit}</span>}
            </div>
          ))
      }
    </div>
  )}
</div>
{header.supplier_id && (
  <div className="d-flex align-items-center gap-2 mt-1">
    <span className="text-success small">✅ Proveedor seleccionado</span>
    <button type="button" className="btn btn-link btn-sm p-0 text-danger" style={{fontSize:11}}
      onClick={() => setHeader({...header, supplier_id:'', supplierSearch:''})}>
      Cambiar
    </button>
  </div>
)}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">📅 Fecha de entrada</label>
                    <input className="form-control" type="text"
                      value={new Date().toLocaleDateString('es-CO',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
                      readOnly style={{ background:'#f8fafc', color:'#64748b' }} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">🧾 N° Factura del proveedor</label>
                    <input className="form-control" placeholder="Ej: FAC-001 (opcional)"
                      value={header.invoice_num}
                      onChange={e => setHeader({...header, invoice_num:e.target.value})} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold small">📝 Razón del pedido</label>
                    <input className="form-control" value={header.reason}
                      onChange={e => setHeader({...header, reason:e.target.value})} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold small">💳 ¿Factura quedó pendiente de pago?</label>
                    <select className="form-select" value={header.factura_pendiente||''}
                      onChange={e=>setHeader({...header, factura_pendiente:e.target.value})}>
                      <option value="">No — se pagó de contado</option>
                      <option value="si">Sí — agregar a Cuentas por Pagar</option>
                    </select>
                  </div>
                  {header.factura_pendiente === 'si' && (
                    <div className="col-md-6">
                      <label className="form-label fw-semibold small">📅 Fecha límite de pago</label>
                      <input type="date" className="form-control" value={header.fecha_limite_pago||''}
                        onChange={e=>setHeader({...header, fecha_limite_pago:e.target.value})} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── PASO 2: Agregar productos ── */}
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header d-flex align-items-center gap-2 py-3"
                style={{ background:'#1e40af', color:'#fff', borderRadius:'8px 8px 0 0' }}>
                <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:12 }}>2</span>
                <span className="fw-semibold">Agregar productos al pedido</span>
              </div>
              <div className="card-body">
                {editing !== 'editor' ? (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-semibold small mb-2">
                        Buscar producto por nombre o código de barras
                      </label>
                      <Searcher
                        products={products}
                        excludeIds={idsEnPedido}
                        onSelect={openExisting}
                        placeholder="Escribe nombre, escanea código... → si no existe, usa 'Producto nuevo'"
                      />
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
                      <span className="text-muted small">o</span>
                      <div style={{ flex:1, height:1, background:'#e2e8f0' }} />
                    </div>
                    <div className="mt-3 text-center">
                      <button type="button" className="btn btn-outline-success"
                        onClick={openNew}>
                        ✨ Crear producto nuevo dentro del pedido
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── PASO 3: Editor de precios ── */
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <span style={{ background:'#1e40af', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:11, color:'#fff' }}>3</span>
                      <span className="fw-semibold small">Completa los detalles del producto</span>
                    </div>
                    <RowEditor
                      row={editingRow}
                      products={products}
                      onSave={saveRow}
                      onCancel={() => { setEditing(null); setEditingRow(null); }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── PASO 4+5: Tabla resumen y confirmar ── */}
            {rows.length > 0 && editing !== 'editor' && (
              <div className="card border-0 shadow-sm mb-4">
                <div className="card-header d-flex align-items-center gap-2 py-3"
                  style={{ background:'#065f46', color:'#fff', borderRadius:'8px 8px 0 0' }}>
                  <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:'50%', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:12 }}>4</span>
                  <span className="fw-semibold">Revisión del pedido — {rows.length} producto{rows.length!==1?'s':''}</span>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ fontSize:13 }}>
                    <thead className="table-light">
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th className="text-center">Cantidad</th>
                        <th className="text-end">Costo unit.</th>
                        <th className="text-end">Total egreso</th>
                        <th className="text-end">P. Venta</th>
                        <th>Vencimiento</th>
                        <th style={{ width:90 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => {
                        const nombre = r.mode==='existing' ? dname(r.product) : r.name;
                        const cod    = r.barcode || r.product?.barcode || '—';
                        const egreso = parseCOP(r.unit_cost||0) * parseInt(r.quantity||0);
                        return (
                          <tr key={r._id}>
                            <td className="text-muted" style={{ fontFamily:'monospace', fontSize:10 }}>{cod}</td>
                            <td className="fw-semibold">
                              {r.mode==='new' && <span className="badge bg-success me-1" style={{ fontSize:9 }}>NUEVO</span>}
                              {nombre}
                            </td>
                            <td className="text-center">
                              <span className="badge bg-primary">{r.quantity}</span>
                            </td>
                            <td className="text-end">{fmt(parseCOP(r.unit_cost))}</td>
                            <td className="text-end fw-bold text-danger">{fmt(egreso)}</td>
                            <td className="text-end text-success">{fmt(parseFloat(r.price))}</td>
                            <td>{r.expiry_date || <span className="text-muted">—</span>}</td>
                            <td>
                              <div className="d-flex gap-1">
                                <button type="button" className="btn btn-sm btn-outline-warning py-0 px-2"
                                  onClick={() => editRow(r)} title="Editar">✏️</button>
                                <button type="button" className="btn btn-sm btn-outline-danger py-0 px-2"
                                  onClick={() => deleteRow(r._id)} title="Eliminar">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot style={{ background:'#f0fdf4' }}>
                      <tr>
                        <td colSpan="4" className="text-end fw-bold py-3">
                          <span style={{ fontSize:14 }}>TOTAL EGRESO DEL PEDIDO:</span>
                        </td>
                        <td className="text-end fw-bold py-3" style={{ fontSize:16, color:'#dc2626' }}>
                          {fmt(totalPedido)}
                        </td>
                        <td colSpan="3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Paso 5 — Confirmar */}
                <div className="card-footer d-flex align-items-center justify-content-between py-3" style={{ background:'#f8fafc' }}>
                  <div>
                    <button type="button" className="btn btn-outline-primary btn-sm"
                      onClick={() => { setEditing('editor'); openNew(); }}>
                      + Agregar otro producto
                    </button>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div className="text-muted small">
                      <span className="badge bg-dark me-1" style={{ fontSize:11 }}>5</span>
                      Confirmar entrada
                    </div>
                    <button type="button" className="btn btn-success btn-lg fw-bold px-5"
                      onClick={confirmOrder} disabled={loading}>
                      {loading
                        ? <><span className="spinner-border spinner-border-sm me-2"/>Registrando...</>
                        : `✅ Confirmar pedido (${rows.length} producto${rows.length!==1?'s':''})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ SALIDA ══════════════════════ */}
        {tab === 'salida' && (
          <div style={{ maxWidth:520 }}>
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3"
                style={{ background:'#7f1d1d', color:'#fff', borderRadius:'8px 8px 0 0' }}>
                📤 Registrar Salida de Inventario
              </div>
              <div className="card-body">
                <form onSubmit={handleExit}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Producto *</label>
                    {exitProduct ? (
                      <div className="p-3 rounded border d-flex align-items-start gap-3" style={{ background:'#fff5f5' }}>
                        <div style={{ flex:1 }}>
                          <div className="fw-bold">{dname(exitProduct)}</div>
                          <div className="d-flex gap-2 flex-wrap mt-1" style={{ fontSize:11 }}>
                            {exitProduct.barcode && <span className="text-muted" style={{ fontFamily:'monospace' }}>📦 {exitProduct.barcode}</span>}
                            <span className={`badge ${stockColor(exitProduct)}`}>Stock actual: {exitProduct.stock}</span>
                            <span className="text-muted">{exitProduct.category || '—'}</span>
                          </div>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-secondary"
                          onClick={() => setExitProduct(null)}>Cambiar</button>
                      </div>
                    ) : (
                      <Searcher products={products} onSelect={setExitProduct}
                        placeholder="Buscar por nombre o escanear código de barras..." />
                    )}
                  </div>

                  {exitProduct && (
                    <>
                      <div className="mb-3">
                        <label className="form-label fw-semibold">Cantidad *</label>
                        <input className="form-control" type="number" min="1" max={exitProduct.stock}
                          placeholder={`Máximo: ${exitProduct.stock}`}
                          value={exitQty} onChange={e => setExitQty(e.target.value)} required />
                        <div className="form-text">Disponible: <strong>{exitProduct.stock}</strong> unidades</div>
                      </div>
                      <div className="mb-4">
                        <label className="form-label fw-semibold">Motivo *</label>
                        <select className="form-select" value={exitReason}
                          onChange={e => setExitReason(e.target.value)}>
                          <option value="Producto dañado">Producto dañado</option>
                          <option value="Ajuste de inventario">Ajuste de inventario</option>
                          <option value="Devolución">Devolución</option>
                          <option value="Vencimiento">Vencimiento</option>
                          <option value="Robo o pérdida">Robo o pérdida</option>
                          <option value="Muestra o degustación">Muestra o degustación</option>
                        </select>
                      </div>
                    </>
                  )}

                  <button type="submit" className="btn btn-danger w-100 fw-bold"
                    disabled={loading || !exitProduct || !exitQty}>
                    {loading ? 'Guardando...' : '📤 Registrar Salida'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Comprobante modal */}
        {comprobante && (
          <Comprobante
            result={comprobante}
            header={header}
            suppliers={suppliers}
            onClose={() => setComprobante(null)}
          />
        )}
      </main>
    </div>
  );
};

export default Inventory;