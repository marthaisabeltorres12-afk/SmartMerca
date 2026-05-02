import React, { useState, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const ImportarProductos = () => {
  const { token } = useAuth();
  const fileRef = useRef();

  const [tab,         setTab]         = useState('importar');
  const [archivo,     setArchivo]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [resultado,   setResultado]   = useState(null);
  const [error,       setError]       = useState('');
  const [exportando,  setExportando]  = useState(false);

  const fmt = n => '$' + Number(n||0).toLocaleString('es-CO');

  // ── Exportar ───────────────────────────────────────────────────────
  const handleExportar = async () => {
    setExportando(true);
    try {
      const res = await fetch('/api/import-export/export/excel', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error exportando');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `SmartMerca_Productos_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      setError('Error exportando: ' + e.message);
    } finally {
      setExportando(false);
    }
  };

  // ── Descargar plantilla ────────────────────────────────────────────
  const handlePlantilla = async () => {
    try {
      const res = await fetch('/api/import-export/import/plantilla', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error descargando plantilla');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'Plantilla_Importar_Productos.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      setError('Error: ' + e.message);
    }
  };

  // ── Importar ───────────────────────────────────────────────────────
  const handleImportar = async () => {
    if (!archivo) { setError('Selecciona un archivo primero'); return; }
    setLoading(true);
    setResultado(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', archivo);

      const res = await fetch('/api/import-export/import/excel', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResultado(data);
      setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{marginLeft:240, background:'#f8fafc', minHeight:'100vh'}}>
        <div className="mb-4">
          <h4 className="fw-bold mb-0">📦 Importar / Exportar Productos</h4>
          <small className="text-muted">Transfiere productos desde cualquier POS o sistema anterior</small>
        </div>

        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button className={`nav-link ${tab==='importar'?'active fw-bold':''}`}
              onClick={()=>setTab('importar')}>📥 Importar desde Excel/CSV</button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab==='exportar'?'active fw-bold':''}`}
              onClick={()=>setTab('exportar')}>📤 Exportar mis productos</button>
          </li>
        </ul>

        {/* ── IMPORTAR ── */}
        {tab === 'importar' && (
          <div className="row g-4">
            <div className="col-md-7">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">📥 Importar productos</div>
                <div className="card-body">

                  {/* Pasos */}
                  <div className="row g-3 mb-4">
                    {[
                      ['1', '📥', 'Descarga la plantilla', 'Formato listo con los campos correctos'],
                      ['2', '✏️', 'Llena con tus productos', 'O pega desde tu POS anterior'],
                      ['3', '📤', 'Sube el archivo', 'El sistema importa y detecta duplicados'],
                    ].map(([n, ico, titulo, sub]) => (
                      <div key={n} className="col-4">
                        <div className="text-center p-3 rounded" style={{background:'#f0f4ff'}}>
                          <div style={{fontSize:28}}>{ico}</div>
                          <div className="fw-bold small mt-1">{titulo}</div>
                          <div className="text-muted" style={{fontSize:11}}>{sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Descargar plantilla */}
                  <div className="d-flex gap-2 mb-4">
                    <button className="btn btn-outline-primary fw-bold" onClick={handlePlantilla}>
                      📋 Descargar plantilla Excel
                    </button>
                  </div>

                  {/* Formatos aceptados */}
                  <div className="alert alert-info py-2 mb-3" style={{fontSize:13}}>
                    <strong>Formatos aceptados:</strong> .xlsx (Excel), .xls (Excel antiguo), .csv
                    <br/>
                    <strong>El sistema detecta automáticamente las columnas</strong> — funciona con exports de la mayoría de POS.
                  </div>

                  {/* Subir archivo */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Seleccionar archivo</label>
                    <input ref={fileRef} type="file" className="form-control"
                      accept=".xlsx,.xls,.csv"
                      onChange={e => { setArchivo(e.target.files[0]); setResultado(null); setError(''); }}/>
                    {archivo && (
                      <div className="text-muted small mt-1">
                        📄 {archivo.name} ({(archivo.size/1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="alert alert-danger py-2 small">⚠️ {error}</div>
                  )}

                  <button className="btn btn-success btn-lg fw-bold w-100"
                    onClick={handleImportar} disabled={!archivo || loading}>
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-2"/>Importando...</>
                      : '📥 Importar productos'}
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado */}
            <div className="col-md-5">
              {resultado ? (
                <div className="card border-0 shadow-sm border-success border-2">
                  <div className="card-header fw-semibold text-success">✅ Importación completada</div>
                  <div className="card-body">
                    <div className="row g-3 mb-3">
                      <div className="col-4 text-center">
                        <div className="fs-2 fw-bold text-success">{resultado.creados}</div>
                        <div className="text-muted small">Creados</div>
                      </div>
                      <div className="col-4 text-center">
                        <div className="fs-2 fw-bold text-primary">{resultado.actualizados}</div>
                        <div className="text-muted small">Actualizados</div>
                      </div>
                      <div className="col-4 text-center">
                        <div className="fs-2 fw-bold text-dark">{resultado.total}</div>
                        <div className="text-muted small">Total</div>
                      </div>
                    </div>

                    {resultado.errores?.length > 0 && (
                      <div className="alert alert-warning py-2" style={{fontSize:12}}>
                        <strong>⚠️ {resultado.errores.length} filas con errores:</strong>
                        <ul className="mb-0 mt-1">
                          {resultado.errores.slice(0,5).map((e,i) => (
                            <li key={i}>{e}</li>
                          ))}
                          {resultado.errores.length > 5 && (
                            <li>...y {resultado.errores.length - 5} más</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="alert alert-success py-2 small">
                      ✅ {resultado.message}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-header fw-semibold">💡 ¿Cómo funciona?</div>
                  <div className="card-body">
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">🔄 Productos duplicados</div>
                      <div className="text-muted small">Si el producto ya existe con el mismo nombre, se <strong>actualiza</strong> el precio y stock. No se crea duplicado.</div>
                    </div>
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">📊 Columnas flexibles</div>
                      <div className="text-muted small">El sistema detecta automáticamente las columnas aunque el Excel venga de otro POS diferente.</div>
                    </div>
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">✅ Columnas obligatorias</div>
                      <div className="text-muted small">Solo necesitas <strong>Nombre</strong> y <strong>Precio</strong>. El resto es opcional.</div>
                    </div>
                    <div className="mb-3">
                      <div className="fw-semibold mb-1">💰 Formatos de precio</div>
                      <div className="text-muted small">Acepta: <code>3500</code>, <code>$3.500</code>, <code>3,500</code>, <code>3500.00</code></div>
                    </div>
                    <div>
                      <div className="fw-semibold mb-1">📦 POS compatibles</div>
                      <div className="text-muted small">Siigo, Alegra, Aspel, Helisa, Syscafe, cualquier sistema que exporte a Excel o CSV.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EXPORTAR ── */}
        {tab === 'exportar' && (
          <div className="row g-4">
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">📤 Exportar productos</div>
                <div className="card-body">
                  <p className="text-muted">Exporta todos tus productos activos a un archivo Excel con formato profesional.</p>

                  <div className="alert alert-info py-2 mb-4" style={{fontSize:13}}>
                    <strong>El archivo incluye:</strong>
                    <ul className="mb-0 mt-1">
                      <li>Nombre, precio, stock, categoría</li>
                      <li>Código de barras, proveedor</li>
                      <li>IVA, gramaje, vencimiento</li>
                      <li>Hoja de instrucciones para reimportar</li>
                    </ul>
                  </div>

                  {error && <div className="alert alert-danger py-2 small">⚠️ {error}</div>}

                  <button className="btn btn-success btn-lg fw-bold w-100"
                    onClick={handleExportar} disabled={exportando}>
                    {exportando
                      ? <><span className="spinner-border spinner-border-sm me-2"/>Generando Excel...</>
                      : '📥 Descargar Excel de productos'}
                  </button>

                  <div className="text-muted small text-center mt-2">
                    Tus datos son tuyos — puedes exportarlos en cualquier momento
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold">ℹ️ ¿Para qué sirve exportar?</div>
                <div className="card-body">
                  <div className="mb-3 d-flex gap-3">
                    <div style={{fontSize:28}}>💾</div>
                    <div>
                      <div className="fw-semibold">Respaldo de datos</div>
                      <div className="text-muted small">Guarda una copia de tus productos fuera del sistema.</div>
                    </div>
                  </div>
                  <div className="mb-3 d-flex gap-3">
                    <div style={{fontSize:28}}>🔄</div>
                    <div>
                      <div className="fw-semibold">Migrar a otro sistema</div>
                      <div className="text-muted small">Si cambias de POS, llevas todos tus productos fácilmente.</div>
                    </div>
                  </div>
                  <div className="mb-3 d-flex gap-3">
                    <div style={{fontSize:28}}>✏️</div>
                    <div>
                      <div className="fw-semibold">Edición masiva</div>
                      <div className="text-muted small">Edita precios o stocks en Excel y vuelve a importar.</div>
                    </div>
                  </div>
                  <div className="d-flex gap-3">
                    <div style={{fontSize:28}}>📊</div>
                    <div>
                      <div className="fw-semibold">Análisis externo</div>
                      <div className="text-muted small">Abre en Excel o Google Sheets para análisis adicionales.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ImportarProductos;