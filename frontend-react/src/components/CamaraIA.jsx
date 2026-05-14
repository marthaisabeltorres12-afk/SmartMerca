import React, { useEffect, useRef, useState, useCallback } from 'react';
import { apiFetch } from '../services/api';

const fmt = n => Number(n || 0).toLocaleString('es-CO', {
  style: 'currency', currency: 'COP', minimumFractionDigits: 0,
});

const getEmoji = (nombre = '') => {
  const n = nombre.toLowerCase();
  if (n.includes('banano') || n.includes('banana'))     return '🍌';
  if (n.includes('plátano') || n.includes('platano'))   return '🍌';
  if (n.includes('manzana verde'))                      return '🍏';
  if (n.includes('manzana'))                            return '🍎';
  if (n.includes('naranja') || n.includes('mandarina')) return '🍊';
  if (n.includes('limón') || n.includes('limon'))       return '🍋';
  if (n.includes('piña') || n.includes('pina'))         return '🍍';
  if (n.includes('fresa'))                              return '🍓';
  if (n.includes('mora'))                               return '🫐';
  if (n.includes('mango'))                              return '🥭';
  if (n.includes('sandía') || n.includes('sandia'))     return '🍉';
  if (n.includes('papaya'))                             return '🥭';
  if (n.includes('uva'))                                return '🍇';
  if (n.includes('aguacate'))                           return '🥑';
  if (n.includes('tomate'))                             return '🍅';
  if (n.includes('zanahoria'))                          return '🥕';
  if (n.includes('brócoli') || n.includes('brocoli'))   return '🥦';
  if (n.includes('pepino'))                             return '🥒';
  if (n.includes('cebolla'))                            return '🧅';
  if (n.includes('ajo'))                                return '🧄';
  if (n.includes('papa') || n.includes('patata'))       return '🥔';
  if (n.includes('yuca'))                               return '🥔';
  if (n.includes('arroz'))                              return '🍚';
  if (n.includes('leche'))                              return '🥛';
  if (n.includes('huevo'))                              return '🥚';
  if (n.includes('pan'))                                return '🍞';
  return '📦';
};

const findInProducts = (nombre, products) => {
  if (!nombre || !products?.length) return null;
  const q = nombre.toLowerCase().trim();
  return products.find(p => p.name?.toLowerCase() === q)
    || products.find(p => p.name?.toLowerCase().includes(q) || q.includes(p.name?.toLowerCase()))
    || null;
};

const CamaraIA = ({ products = [], onAddToCart, onClose, token }) => {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  const [camError,   setCamError]   = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [resultado,  setResultado]  = useState(null);
  const [peso,       setPeso]       = useState('');
  const [error,      setError]      = useState(null);
  const [estadoIA,   setEstadoIA]   = useState(null);
  const [capturada,  setCapturada]  = useState(null);

  useEffect(() => {
    // Usar fetch directo para no disparar logout si hay error
    fetch('http://localhost:5000/api/ia/estado')
      .then(r => r.json())
      .then(res => setEstadoIA(res))
      .catch(() => setEstadoIA({ ollama: false, modelo_disponible: false }));
  }, []);

  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch {
        setCamError(true);
        setError('No se pudo acceder a la cámara. En Chrome: chrome://flags → "Insecure origins treated as secure" → agrega tu IP.');
      }
    };
    start();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const analizar = useCallback(async () => {
    if (analizando || !videoRef.current) return;
    setAnalizando(true); setError(null); setResultado(null); setCapturada(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 480;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0, 640, 480);
      const dataURL = canvas.toDataURL('image/jpeg', 0.85);
      setCapturada(dataURL);
      const res = await apiFetch('/ia/identificar', {
        method: 'POST',
        body: JSON.stringify({ imagen: dataURL.split(',')[1], productos: products.map(p => p.name).filter(Boolean) }),
      }, token);
      const nombre = res.nombre?.trim() || '';
      setResultado({ nombre, encontrado: res.encontrado || !!findInProducts(nombre, products), producto: findInProducts(nombre, products) });
    } catch (e) {
      setError(e.message || 'Error al analizar');
    } finally {
      setAnalizando(false);
    }
  }, [analizando, products, token]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter') return;
      if (!resultado && !analizando && !camError) { analizar(); return; }
      if (resultado?.producto && peso && parseFloat(peso) > 0) handleAdd();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleAdd = () => {
    if (!resultado?.producto) return;
    const p = parseFloat(peso);
    if (!p || p <= 0) { alert('Ingresa el peso'); return; }
    onAddToCart({ ...resultado.producto, quantity: p, _peso: p, _precio_total: resultado.producto.price * p });
    setResultado(null); setPeso(''); setCapturada(null);
  };

  const reiniciar = () => { setResultado(null); setPeso(''); setCapturada(null); setError(null); };

  const iaLista = estadoIA?.ollama && estadoIA?.modelo_disponible;

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.92)', zIndex: 99999 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0" style={{ background: '#0f172a', color: '#fff', borderRadius: 16 }}>

          <div className="d-flex align-items-center justify-content-between px-4 py-3"
            style={{ borderBottom: '1px solid #1e3a5f' }}>
            <div>
              <h5 className="fw-bold mb-0">📷 Cámara IA — Identificar producto</h5>
              <small className="text-muted">
                {estadoIA === null && '⏳ Verificando Ollama...'}
                {iaLista && '✅ Ollama + Qwen2.5-VL listo'}
                {estadoIA?.ollama && !estadoIA?.modelo_disponible && '⚠️ Falta el modelo — ejecuta: ollama pull qwen2.5vl:7b'}
                {estadoIA !== null && !estadoIA?.ollama && '❌ Ollama no está corriendo — ejecuta: ollama serve'}
              </small>
            </div>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body p-4">
            {estadoIA !== null && (
              <div className={`alert py-2 mb-3 ${iaLista ? 'alert-success' : 'alert-warning'}`} style={{ fontSize: 12 }}>
                {iaLista
                  ? <span>✅ <strong>Qwen2.5-VL</strong> listo — IA local, sin internet ni API key</span>
                  : !estadoIA?.ollama
                    ? <span>❌ Inicia Ollama: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: 4 }}>ollama serve</code></span>
                    : <span>⚠️ Descarga el modelo: <code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: 4 }}>ollama pull qwen2.5vl:7b</code> (~4GB, una sola vez)</span>
                }
              </div>
            )}

            {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

            <div className="row g-4">
              <div className="col-md-7">
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#1e293b', minHeight: 260 }}>
                  {capturada
                    ? <img src={capturada} alt="captura" style={{ width: '100%', borderRadius: 12, display: 'block' }} />
                    : <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 12, display: 'block' }} />
                  }
                  {analizando && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                      <div className="spinner-border text-primary mb-2" style={{ width: 48, height: 48 }} />
                      <span className="fw-bold">Analizando con Qwen2.5-VL...</span>
                      <small className="text-muted mt-1">Puede tardar unos segundos</small>
                    </div>
                  )}
                </div>
                <div className="mt-3 d-flex gap-2">
                  <button className="btn btn-primary btn-lg fw-bold flex-grow-1"
                    disabled={analizando || camError || !iaLista}
                    onClick={analizar}>
                    {analizando
                      ? <><span className="spinner-border spinner-border-sm me-2" />Analizando...</>
                      : '📷 Capturar y analizar (Enter)'}
                  </button>
                  {capturada && <button className="btn btn-outline-secondary btn-lg" onClick={reiniciar} title="Volver al video">🔄</button>}
                </div>
                {camError && (
                  <div className="alert alert-warning small mt-2 py-2">
                    📱 Chrome → <code>chrome://flags</code> → "Insecure origins" → agrega tu IP
                  </div>
                )}
              </div>

              <div className="col-md-5">
                <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, minHeight: 300 }}>
                  {!resultado && !analizando && (
                    <div className="text-center text-muted py-4">
                      <div style={{ fontSize: 52 }}>🤖</div>
                      <div className="mt-2 small">Apunta la cámara al producto<br />y presiona <strong>Capturar</strong></div>
                      <div className="mt-3 p-2 rounded text-start" style={{ background: '#0f172a', fontSize: 11 }}>
                        <div className="text-muted mb-1">✨ Powered by Ollama + Qwen2.5-VL</div>
                        <div>• IA local, sin internet</div>
                        <div>• Sin API key ni costos</div>
                        <div>• Identifica cualquier producto</div>
                      </div>
                    </div>
                  )}

                  {analizando && (
                    <div className="text-center py-4 text-muted">
                      <div style={{ fontSize: 52 }}>🔍</div>
                      <div className="mt-2">Preguntando a Qwen2.5-VL...</div>
                    </div>
                  )}

                  {resultado && !resultado.nombre && (
                    <div className="text-center py-4">
                      <div style={{ fontSize: 52 }}>🤔</div>
                      <div className="fw-bold text-warning mt-2">No reconocido</div>
                      <div className="text-muted small mt-2">Intenta con mejor iluminación o más cerca.</div>
                      <button className="btn btn-outline-light btn-sm mt-3" onClick={reiniciar}>🔄 Intentar de nuevo</button>
                    </div>
                  )}

                  {resultado?.nombre && !resultado.producto && (
                    <div className="text-center py-3">
                      <div style={{ fontSize: 48 }}>{getEmoji(resultado.nombre)}</div>
                      <div className="fw-bold text-warning mt-2" style={{ fontSize: 18 }}>{resultado.nombre}</div>
                      <div className="alert alert-warning py-2 small mt-3 text-start">
                        ⚠️ <strong>{resultado.nombre}</strong> identificado pero no está en el inventario.<br />
                        Regístralo en Productos con ese nombre exacto.
                      </div>
                      <button className="btn btn-outline-light btn-sm mt-2" onClick={reiniciar}>🔄 Capturar otro</button>
                    </div>
                  )}

                  {resultado?.producto && (
                    <>
                      <div className="text-center mb-3">
                        <div style={{ fontSize: 52 }}>{getEmoji(resultado.nombre)}</div>
                        <div className="fw-bold text-white mt-1" style={{ fontSize: 18 }}>{resultado.nombre}</div>
                        <span className="badge bg-success mt-1">✅ En inventario</span>
                      </div>
                      <div className="mb-3 p-2 rounded" style={{ background: '#0f2740' }}>
                        <div className="small text-muted">Producto en sistema:</div>
                        <div className="fw-semibold text-white">{resultado.producto.name}</div>
                        <div className="text-success fw-bold">{fmt(resultado.producto.price)} / kg</div>
                        <div className="text-muted small">Stock: {resultado.producto.stock} unidades</div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label fw-semibold text-white">⚖️ Peso (kg)</label>
                        <div className="input-group">
                          <input type="number" className="form-control form-control-lg text-center fw-bold"
                            min="0.001" step="0.001" placeholder="0.000"
                            value={peso} onChange={e => setPeso(e.target.value)}
                            style={{ fontSize: 22, background: '#0f172a', color: '#fff', border: '2px solid #3b82f6' }}
                            autoFocus />
                          <span className="input-group-text" style={{ background: '#1e3a5f', color: '#fff', border: '2px solid #3b82f6' }}>kg</span>
                        </div>
                        {peso && parseFloat(peso) > 0 && (
                          <div className="text-center mt-2 fw-bold text-success" style={{ fontSize: 20 }}>
                            = {fmt(resultado.producto.price * parseFloat(peso))}
                          </div>
                        )}
                      </div>
                      <button className="btn btn-success btn-lg w-100 fw-bold"
                        onClick={handleAdd} disabled={!peso || parseFloat(peso) <= 0}>
                        🛒 Agregar al carrito (Enter)
                      </button>
                      <button className="btn btn-outline-secondary w-100 mt-2" onClick={reiniciar}>
                        🔄 Capturar otro producto
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CamaraIA;