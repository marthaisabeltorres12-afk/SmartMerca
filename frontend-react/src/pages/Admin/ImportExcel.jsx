import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

const API = 'http://localhost:5000/api';

const fmt = n => n != null ? Number(n).toLocaleString('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }) : '—';

const ImportExcel = ({ onDone }) => {
  const { token }             = useAuth();
  const fileRef               = useRef();
  const [step,    setStep]    = useState('idle');
  const [rows,    setRows]    = useState([]);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // ── Generar plantilla en el cliente con SheetJS ──────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Hoja principal
    const headers = [
      'Nombre *', 'Categoría', 'Código de barras',
      'Gramaje cantidad', 'Gramaje unidad',
      'Precio llegada *', '% Ganancia', 'Precio venta *',
      'IVA (19/5/0)', 'Stock mínimo', 'Fecha vencimiento (YYYY-MM-DD)', 'Proveedor'
    ];
    const examples = [
    
    ];

    const wsData = [headers, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ancho de columnas
    ws['!cols'] = [
      {wch:28},{wch:24},{wch:18},{wch:14},{wch:12},
      {wch:15},{wch:10},{wch:15},{wch:10},{wch:12},{wch:22},{wch:22}
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Hoja de instrucciones
    const instrData = [
      ['INSTRUCCIONES DE USO'],
      [''],
      ['OBLIGATORIOS (*): Nombre, Precio llegada, Precio venta'],
      ['IVA: 19 = procesados/bebidas/snacks  |  5 = canasta básica  |  0 = frutas/verduras/carnes/huevos/leche/pan/arroz'],
      ['Precio venta = Precio llegada × (1 + % Ganancia/100) × (1 + IVA/100)'],
      ['Fecha vencimiento: formato YYYY-MM-DD  Ej: 2026-12-31'],
      ['Si el producto ya existe (mismo nombre o código), el sistema preguntará si actualizar o ignorar.'],
      ['Las filas vacías se ignoran automáticamente.'],
      [''],
      ['CATEGORÍAS DISPONIBLES'],
      ['🥦 Frutas y Verduras | 🥩 Carnes y Embutidos | 🥛 Lácteos y Huevos | 🍞 Panadería y Repostería'],
      ['🥤 Bebidas y Jugos | 🍺 Bebidas Alcohólicas | 🍿 Snacks y Dulces | 🥫 Enlatados y Conservas'],
      ['🌾 Granos y Cereales | 🫙 Aceites y Condimentos | 🧊 Congelados | 🧹 Limpieza del Hogar'],
      ['🧴 Higiene Personal | 👶 Bebés y Maternidad | 🐾 Mascotas | 📝 Papelería | 🔋 Electrónica | 📦 Otros'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr['!cols'] = [{wch:100}];
    XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  };

  // ── Leer archivo subido ──────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null); setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res  = await fetch(`${API}/import/preview`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRows(data.map(r => ({
        ...r,
        action: r.status === 'error' ? 'skip' : r.status === 'update' ? 'update' : 'new'
      })));
      setStep('preview');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const setAction = (idx, action) => setRows(prev => prev.map((r, i) => i === idx ? {...r, action} : r));

  const handleExecute = async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`${API}/import/execute`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(rows),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResult(data);
      setStep('done');
      if (onDone) onDone();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const reset = () => {
    setStep('idle'); setRows([]); setResult(null); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const counts = {
    new:    rows.filter(r => r.action === 'new').length,
    update: rows.filter(r => r.action === 'update').length,
    skip:   rows.filter(r => r.action === 'skip').length,
    error:  rows.filter(r => r.status === 'error').length,
  };

  return (
    <div>
      {/* ── IDLE ── */}
      {step === 'idle' && (
        <div className="card border-0 shadow-sm">
          <div className="card-header fw-semibold bg-primary bg-opacity-10">
            📥 Importar productos desde Excel
          </div>
          <div className="card-body">
            <div className="row g-4 align-items-center">
              <div className="col-md-5">
                <div className="fw-semibold mb-2">Paso 1 — Descargar plantilla</div>
                <p className="text-muted small mb-3">Descarga la plantilla con columnas configuradas y ejemplos.</p>
                <button className="btn btn-outline-success w-100" onClick={downloadTemplate}>
                  📄 Descargar plantilla .xlsx
                </button>
              </div>
              <div className="col-md-2 text-center" style={{fontSize:24}}>→</div>
              <div className="col-md-5">
                <div className="fw-semibold mb-2">Paso 2 — Subir archivo lleno</div>
                <p className="text-muted small mb-3">Llena la plantilla con tus productos y súbela aquí.</p>
                <input type="file" accept=".xlsx,.xls" ref={fileRef} onChange={handleFile} style={{display:'none'}} />
                <button className="btn btn-primary w-100" onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading
                    ? <><span className="spinner-border spinner-border-sm me-2"/>Leyendo...</>
                    : '📤 Subir archivo Excel'}
                </button>
              </div>
            </div>

            {error && <div className="alert alert-danger mt-3 py-2">{error}</div>}

            <div className="mt-4 p-3 rounded" style={{background:'#f8fafc', fontSize:12, border:'1px solid #e2e8f0'}}>
              <div className="fw-semibold mb-1">Columnas de la plantilla:</div>
              <div className="d-flex flex-wrap gap-1">
                {['Nombre *','Categoría','Código barras','Gramaje','Precio llegada *','% Ganancia','Precio venta *','IVA (19/5/0)','Stock mínimo','Vencimiento','Proveedor'].map(c => (
                  <span key={c} className={`badge ${c.includes('*') ? 'bg-danger' : 'bg-light text-dark border'}`} style={{fontSize:10}}>{c}</span>
                ))}
              </div>
              <div className="text-muted mt-1">* = obligatorio</div>
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {step === 'preview' && (
        <div>
          <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
            <div>
              <h5 className="fw-bold mb-0">Vista previa — {rows.length} productos en el archivo</h5>
              <div className="d-flex gap-2 mt-1">
                <span className="badge bg-success">{counts.new} nuevos</span>
                <span className="badge bg-warning text-dark">{counts.update} a actualizar</span>
                <span className="badge bg-secondary">{counts.skip} omitir</span>
                {counts.error > 0 && <span className="badge bg-danger">{counts.error} con error</span>}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={reset}>← Volver</button>
              <button className="btn btn-success fw-bold" onClick={handleExecute}
                disabled={loading || (counts.new + counts.update) === 0}>
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2"/>Importando...</>
                  : `✅ Importar ${counts.new + counts.update} productos`}
              </button>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

          {/* Acciones masivas */}
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <span className="text-muted small align-self-center">Acción masiva:</span>
            <button className="btn btn-sm btn-outline-success"
              onClick={() => setRows(prev => prev.map(r => r.status !== 'error' ? {...r, action:'new'} : r))}>
              Todos → Crear nuevo
            </button>
            <button className="btn btn-sm btn-outline-warning"
              onClick={() => setRows(prev => prev.map(r => r.status === 'update' ? {...r, action:'update'} : r))}>
              Duplicados → Actualizar
            </button>
            <button className="btn btn-sm btn-outline-secondary"
              onClick={() => setRows(prev => prev.map(r => r.status === 'update' ? {...r, action:'skip'} : r))}>
              Duplicados → Omitir
            </button>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{fontSize:12}}>
                <thead className="table-light">
                  <tr>
                    <th style={{width:120}}>Acción</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th className="text-end">P. llegada</th>
                    <th className="text-end">P. venta</th>
                    <th className="text-center">IVA</th>
                    <th>Proveedor</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} style={{
                      background: row.status === 'error'    ? '#fff5f5'
                                : row.action === 'skip'     ? '#f8fafc'
                                : row.action === 'update'   ? '#fffbeb'
                                : '#f0fdf4'
                    }}>
                      <td>
                        {row.status === 'error' ? (
                          <span className="badge bg-danger">⚠️ Error</span>
                        ) : (
                          <div className="btn-group btn-group-sm">
                            <button
                              className={`btn btn-sm ${row.action === 'new'    ? 'btn-success'   : 'btn-outline-secondary'}`}
                              onClick={() => setAction(idx, 'new')} title="Crear como nuevo">✨</button>
                            {row.status === 'update' && (
                              <button
                                className={`btn btn-sm ${row.action === 'update' ? 'btn-warning'  : 'btn-outline-secondary'}`}
                                onClick={() => setAction(idx, 'update')} title="Actualizar existente">🔄</button>
                            )}
                            <button
                              className={`btn btn-sm ${row.action === 'skip'   ? 'btn-secondary' : 'btn-outline-secondary'}`}
                              onClick={() => setAction(idx, 'skip')} title="Omitir">—</button>
                          </div>
                        )}
                      </td>
                      <td className="fw-semibold">
                        {row.nombre}
                        {row.status === 'update' && <div className="text-warning" style={{fontSize:10}}>⚠️ Ya existe: {row.existing_name}</div>}
                        {row.status === 'error'  && <div className="text-danger"  style={{fontSize:10}}>{row.error}</div>}
                        {row.aviso && <div className="text-info" style={{fontSize:10}}>ℹ️ {row.aviso}</div>}
                      </td>
                      <td className="text-muted">{row.categoria || '—'}</td>
                      <td className="text-end">{row.precio_llegada ? fmt(row.precio_llegada) : '—'}</td>
                      <td className="text-end text-success fw-semibold">{fmt(row.precio_venta)}</td>
                      <td className="text-center">
                        <span className={`badge ${(row.iva_type??19)===19?'bg-primary':(row.iva_type??19)===5?'bg-warning text-dark':'bg-success'}`}>
                          {row.iva_type ?? 19}%
                        </span>
                      </td>
                      <td className="text-muted">{row.proveedor || '—'}</td>
                      <td>
                        {row.action === 'new'    && <span className="badge bg-success">✨ Crear</span>}
                        {row.action === 'update' && <span className="badge bg-warning text-dark">🔄 Actualizar</span>}
                        {row.action === 'skip'   && <span className="badge bg-secondary">— Omitir</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && result && (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-4">
            <div style={{fontSize:48}}>✅</div>
            <h5 className="fw-bold mt-2">{result.message}</h5>
            <div className="d-flex justify-content-center gap-4 mt-3">
              <div><div className="fs-3 fw-bold text-success">{result.created}</div><div className="text-muted small">Creados</div></div>
              <div><div className="fs-3 fw-bold text-warning">{result.updated}</div><div className="text-muted small">Actualizados</div></div>
              <div><div className="fs-3 fw-bold text-secondary">{result.skipped}</div><div className="text-muted small">Omitidos</div></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="alert alert-warning mt-3 text-start py-2" style={{fontSize:12}}>
                <strong>Errores:</strong>
                <ul className="mb-0 mt-1">{result.errors.map((e,i) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            <button className="btn btn-primary mt-3" onClick={reset}>Importar otro archivo</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExcel;