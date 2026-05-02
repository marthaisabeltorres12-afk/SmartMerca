import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

// Librería JsBarcode — se carga dinámicamente
const loadJsBarcode = () => new Promise((res) => {
  if (window.JsBarcode) { res(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
  s.onload = res;
  document.head.appendChild(s);
});

// Tamaños de etiqueta predefinidos (en mm)
const TAMAÑOS = [
  { id: 'pequeña',  label: 'Pequeña 40×20mm',  w: 40,  h: 20, cols: 3 },
  { id: 'mediana',  label: 'Mediana 60×30mm',  w: 60,  h: 30, cols: 3 },
  { id: 'grande',   label: 'Grande 80×40mm',   w: 80,  h: 40, cols: 2 },
  { id: 'precio',   label: 'Precio 50×25mm',   w: 50,  h: 25, cols: 3 },
];

const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');

const Etiquetas = () => {
  const { token } = useAuth();
  const [productos,   setProductos]   = useState([]);
  const [busq,        setBusq]        = useState('');
  const [seleccionados, setSeleccionados] = useState([]); // [{producto, cantidad, tamaño}]
  const [tamaño,      setTamaño]      = useState('mediana');
  const [mostrarPrecio, setMostrarPrecio] = useState(true);
  const [mostrarNombre, setMostrarNombre] = useState(true);
  const [mostrarGramaje,setMostrarGramaje]= useState(true);
  const [loading,     setLoading]     = useState(true);
  const printRef = useRef();

  useEffect(() => {
    apiFetch('/products/', {}, token)
      .then(p => { setProductos(Array.isArray(p) ? p : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (seleccionados.length === 0) return;
    loadJsBarcode().then(() => {
      seleccionados.forEach(({ producto }) => {
        const code = producto.barcode || String(producto.id).padStart(8, '0');
        const el   = document.getElementById(`bc-${producto.id}`);
        if (el && window.JsBarcode) {
          try {
            window.JsBarcode(el, code, {
              format: 'CODE128', width: 1.2, height: 28,
              displayValue: true, fontSize: 9, margin: 2,
            });
          } catch {}
        }
      });
    });
  }, [seleccionados, tamaño, mostrarPrecio, mostrarNombre, mostrarGramaje]);

  const prodFiltrados = productos.filter(p =>
    p.is_active && (
      !busq ||
      p.name?.toLowerCase().includes(busq.toLowerCase()) ||
      (p.barcode && p.barcode.includes(busq))
    )
  );

  const agregarProducto = (prod) => {
    if (seleccionados.find(s => s.producto.id === prod.id)) return;
    setSeleccionados(prev => [...prev, { producto: prod, cantidad: 1 }]);
  };

  const remover = (id) => setSeleccionados(prev => prev.filter(s => s.producto.id !== id));

  const setCantidad = (id, val) => {
    setSeleccionados(prev => prev.map(s =>
      s.producto.id === id ? { ...s, cantidad: Math.max(1, Math.min(100, parseInt(val)||1)) } : s
    ));
  };

  const tam = TAMAÑOS.find(t => t.id === tamaño) || TAMAÑOS[1];

  // Generar todas las etiquetas según cantidad
  const todasEtiquetas = seleccionados.flatMap(({ producto, cantidad }) =>
    Array(cantidad).fill(producto)
  );

  const handlePrint = () => {
    const css = `
      @page { margin: 5mm; size: A4; }
      body { margin: 0; font-family: Arial, sans-serif; }
      .grid { display: flex; flex-wrap: wrap; gap: 2mm; }
      .etiqueta {
        width: ${tam.w}mm; height: ${tam.h}mm; border: 0.3mm solid #ccc;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 1mm; box-sizing: border-box; overflow: hidden; page-break-inside: avoid;
      }
      .nombre { font-size: ${tam.h > 25 ? 8 : 7}px; font-weight: bold; text-align: center;
        max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-bottom: 1px; }
      .gramaje { font-size: 7px; color: #666; text-align: center; margin-bottom: 1px; }
      .precio { font-size: ${tam.h > 25 ? 10 : 9}px; font-weight: 900; color: #000; margin-top: 1px; }
      svg { max-width: 100%; height: auto; }
    `;
    const w = window.open('', '_blank', 'width=800,height=600');
    w.document.write(`<html><head><title>Etiquetas</title><style>${css}</style></head><body>`);
    w.document.write(printRef.current.innerHTML);
    w.document.write(`<script>window.onload=function(){window.print();window.close();}<\/script>`);
    w.document.write('</body></html>');
    w.document.close();
  };

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{marginLeft:240,minHeight:'100vh'}}>
        <div className="spinner-border text-primary"/>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{marginLeft:240, background:'#f8fafc', minHeight:'100vh'}}>
        <div className="mb-4 d-flex justify-content-between align-items-center">
          <div>
            <h4 className="fw-bold mb-0">🏷️ Etiquetas de código de barras</h4>
            <small className="text-muted">Genera etiquetas para carnes y productos sin código</small>
          </div>
          <button className="btn btn-primary fw-bold px-4" onClick={handlePrint}
            disabled={seleccionados.length === 0}>
            🖨️ Imprimir {todasEtiquetas.length > 0 ? `(${todasEtiquetas.length})` : ''}
          </button>
        </div>

        <div className="row g-3">
          {/* Panel izquierdo — configuración y selección */}
          <div className="col-md-5">

            {/* Configuración */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header fw-semibold">⚙️ Configuración</div>
              <div className="card-body">
                <label className="form-label fw-semibold small">Tamaño de etiqueta</label>
                <div className="row g-2 mb-3">
                  {TAMAÑOS.map(t => (
                    <div key={t.id} className="col-6">
                      <button
                        className={`btn btn-sm w-100 fw-bold ${tamaño===t.id?'btn-primary':'btn-outline-secondary'}`}
                        onClick={() => setTamaño(t.id)}>
                        {t.label}
                      </button>
                    </div>
                  ))}
                </div>
                <label className="form-label fw-semibold small">Mostrar en etiqueta</label>
                <div className="d-flex gap-3">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={mostrarNombre}
                      onChange={e => setMostrarNombre(e.target.checked)} id="chkNombre"/>
                    <label className="form-check-label small" htmlFor="chkNombre">Nombre</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={mostrarPrecio}
                      onChange={e => setMostrarPrecio(e.target.checked)} id="chkPrecio"/>
                    <label className="form-check-label small" htmlFor="chkPrecio">Precio</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" checked={mostrarGramaje}
                      onChange={e => setMostrarGramaje(e.target.checked)} id="chkGramaje"/>
                    <label className="form-check-label small" htmlFor="chkGramaje">Gramaje</label>
                  </div>
                </div>
              </div>
            </div>

            {/* Buscar producto */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header fw-semibold">🔍 Seleccionar productos</div>
              <div className="card-body pb-0">
                <input className="form-control form-control-sm mb-2"
                  placeholder="Buscar por nombre o código..."
                  value={busq} onChange={e => setBusq(e.target.value)} autoFocus/>
              </div>
              <div style={{maxHeight:280, overflowY:'auto'}}>
                <table className="table table-sm table-hover mb-0" style={{fontSize:12}}>
                  <tbody>
                    {prodFiltrados.slice(0,50).map(p => {
                      const ya = seleccionados.find(s => s.producto.id === p.id);
                      return (
                        <tr key={p.id} style={{cursor:'pointer'}}
                          onClick={() => agregarProducto(p)}>
                          <td className="fw-semibold">{p.name}</td>
                          <td className="text-muted">{p.barcode||'Sin código'}</td>
                          <td className="text-success fw-bold">{fmt(p.price)}</td>
                          <td>
                            {ya
                              ? <span className="badge bg-success">✓</span>
                              : <span className="badge bg-outline-secondary" style={{border:'1px solid #ccc', color:'#666'}}>+</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {!prodFiltrados.length && (
                      <tr><td colSpan={4} className="text-center text-muted py-3">Sin resultados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Productos seleccionados */}
            {seleccionados.length > 0 && (
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
                  <span>📋 Seleccionados ({seleccionados.length})</span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => setSeleccionados([])}>
                    Limpiar todo
                  </button>
                </div>
                <div className="card-body p-0">
                  <table className="table table-sm mb-0" style={{fontSize:12}}>
                    <thead className="table-light">
                      <tr><th>Producto</th><th style={{width:80}}>Cantidad</th><th></th></tr>
                    </thead>
                    <tbody>
                      {seleccionados.map(({ producto, cantidad }) => (
                        <tr key={producto.id}>
                          <td className="fw-semibold">{producto.name}</td>
                          <td>
                            <input type="number" className="form-control form-control-sm"
                              min={1} max={100} value={cantidad}
                              onChange={e => setCantidad(producto.id, e.target.value)}
                              style={{width:60}}/>
                          </td>
                          <td>
                            <button className="btn btn-sm btn-outline-danger py-0"
                              onClick={() => remover(producto.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 text-muted small text-end">
                    Total: <strong>{todasEtiquetas.length}</strong> etiqueta(s)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panel derecho — preview */}
          <div className="col-md-7">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header fw-semibold d-flex justify-content-between align-items-center">
                <span>👁️ Vista previa</span>
                <span className="badge bg-secondary">{tam.label}</span>
              </div>
              <div className="card-body" style={{overflowY:'auto', maxHeight:600}}>
                {todasEtiquetas.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <div style={{fontSize:48}}>🏷️</div>
                    <p className="mt-2">Selecciona productos de la lista</p>
                  </div>
                ) : (
                  <div ref={printRef} className="grid"
                    style={{display:'flex', flexWrap:'wrap', gap:4}}>
                    {todasEtiquetas.map((prod, idx) => {
                      const code = prod.barcode || String(prod.id).padStart(8, '0');
                      const pxW  = tam.w * 3.78;
                      const pxH  = tam.h * 3.78;
                      return (
                        <div key={`${prod.id}-${idx}`} style={{
                          width: pxW, height: pxH, border: '0.5px solid #ccc',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          padding: 3, boxSizing: 'border-box', background: '#fff',
                          overflow: 'hidden',
                        }}>
                          {mostrarNombre && (
                            <div style={{ fontSize: tam.h > 25 ? 9 : 7, fontWeight: 700,
                              textAlign: 'center', maxWidth: '100%', overflow: 'hidden',
                              whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginBottom: 1 }}>
                              {prod.name}
                            </div>
                          )}
                          {mostrarGramaje && prod.gramaje_cantidad && (
                            <div style={{ fontSize: 7, color: '#666', marginBottom: 1 }}>
                              {prod.gramaje_cantidad}{prod.gramaje_unidad}
                            </div>
                          )}
                          <svg id={`bc-${prod.id}`} style={{maxWidth:'95%'}}></svg>
                          {mostrarPrecio && (
                            <div style={{ fontSize: tam.h > 25 ? 11 : 9, fontWeight: 900,
                              color: '#000', marginTop: 1 }}>
                              {fmt(prod.price)}
                              {prod.gramaje_unidad === 'kg' || prod.gramaje_unidad === 'lb' ? '/kg' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Etiquetas;