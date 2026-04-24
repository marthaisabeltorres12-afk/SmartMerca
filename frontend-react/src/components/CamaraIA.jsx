import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Configuración ─────────────────────────────────────────────────────────
const GOOGLE_VISION_API_KEY = 'TU_API_KEY_AQUI';
const GOOGLE_VISION_URL     = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
const MODELO_LOCAL_URL      = '/modelo-frutas/model.json'; // Tu modelo Teachable Machine

const fmt = n => Number(n||0).toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0});

// ── Capturar frame del video ──────────────────────────────────────────────
const captureFrame = (videoEl) => {
  const canvas  = document.createElement('canvas');
  canvas.width  = videoEl.videoWidth  || 640;
  canvas.height = videoEl.videoHeight || 480;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);
  return { canvas, base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] };
};

// ── Google Vision API ─────────────────────────────────────────────────────
const classifyWithVision = async (base64, apiKey) => {
  const url  = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const body = {
    requests: [{
      image: { content: base64 },
      features: [
        { type: 'LABEL_DETECTION',      maxResults: 10 },
        { type: 'OBJECT_LOCALIZATION',  maxResults: 5  },
      ]
    }]
  };
  const res  = await fetch(url, { method:'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const labels = data.responses?.[0]?.labelAnnotations || [];
  return labels.map(l => ({ className: l.description.toLowerCase(), probability: l.score }));
};

// ── Emojis ────────────────────────────────────────────────────────────────
const getEmoji = (nombre = '') => {
  const n = nombre.toLowerCase();
  if (n.includes('banano') || n.includes('banana'))    return '🍌';
  if (n.includes('manzana') || n.includes('apple'))    return '🍎';
  if (n.includes('naranja') || n.includes('orange'))   return '🍊';
  if (n.includes('limón')   || n.includes('lemon'))    return '🍋';
  if (n.includes('piña')    || n.includes('pineapple'))return '🍍';
  if (n.includes('fresa')   || n.includes('strawberry'))return '🍓';
  if (n.includes('mango'))                             return '🥭';
  if (n.includes('sandía')  || n.includes('watermelon'))return '🍉';
  if (n.includes('papaya'))                            return '🥭';
  if (n.includes('uva')     || n.includes('grape'))    return '🍇';
  if (n.includes('plátano') || n.includes('plantain')) return '🍌';
  if (n.includes('tomate')  || n.includes('tomato'))   return '🍅';
  if (n.includes('zanahoria')|| n.includes('carrot'))  return '🥕';
  if (n.includes('brócoli') || n.includes('broccoli')) return '🥦';
  if (n.includes('pepino')  || n.includes('cucumber')) return '🥒';
  if (n.includes('repollo') || n.includes('cabbage'))  return '🥬';
  if (n.includes('pimentón')|| n.includes('pepper'))   return '🫑';
  if (n.includes('mazorca') || n.includes('corn'))     return '🌽';
  if (n.includes('cebolla') || n.includes('onion'))    return '🧅';
  if (n.includes('ajo')     || n.includes('garlic'))   return '🧄';
  if (n.includes('lechuga') || n.includes('lettuce'))  return '🥬';
  if (n.includes('ahuyama') || n.includes('pumpkin'))  return '🎃';
  if (n.includes('papa')    || n.includes('potato'))   return '🥔';
  if (n.includes('yuca')    || n.includes('cassava'))  return '🫚';
  return '🥬';
};

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
const CamaraIA = ({ products = [], onAddToCart, onClose }) => {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const intervalRef = useRef(null);
  const modelRef    = useRef(null);

  const [modoIA,       setModoIA]       = useState(navigator.onLine ? 'vision' : 'local');
  const [modelLoading, setModelLoading] = useState(false);
  const [modelReady,   setModelReady]   = useState(false);
  const [scanning,     setScanning]     = useState(false);
  const [prediction,   setPrediction]   = useState(null);
  const [matchedProd,  setMatchedProd]  = useState(null);
  const [peso,         setPeso]         = useState('');
  const [error,        setError]        = useState(null);
  const [apiKey,       setApiKey]       = useState(
    GOOGLE_VISION_API_KEY !== 'TU_API_KEY_AQUI' ? GOOGLE_VISION_API_KEY : (localStorage.getItem('gv_api_key') || '')
  );
  const [apiKeyInput,  setApiKeyInput]  = useState('');

  // ── Iniciar cámara ────────────────────────────────────────────────────
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width:{ ideal:1280 }, height:{ ideal:720 }, facingMode:'environment' }
        });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch { setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.'); }
    };
    start();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Cargar modelo Teachable Machine ──────────────────────────────────
  useEffect(() => {
    if (modoIA !== 'local') return;
    if (modelRef.current) { setModelReady(true); return; }
    const load = async () => {
      setModelLoading(true);
      try {
        const tf = await import('@tensorflow/tfjs');
        // Cargar modelo Teachable Machine (formato layers)
        const model = await tf.loadLayersModel(MODELO_LOCAL_URL);
        // Cargar metadata para obtener las clases
        const metaRes  = await fetch('/modelo-frutas/metadata.json').catch(() => null);
        const metadata = metaRes ? await metaRes.json() : null;
        modelRef.current = { model, labels: metadata?.labels || [] };
        setModelReady(true);
      } catch(e) {
        setError(`No se pudo cargar el modelo. Verifica que model.json y weights.bin estén en public/modelo-frutas/. Error: ${e.message}`);
      } finally { setModelLoading(false); }
    };
    load();
  }, [modoIA]);

  // ── Buscar en productos del POS ───────────────────────────────────────
  const findProduct = useCallback((nombre) => {
    if (!nombre) return null;
    const q = nombre.toLowerCase();
    return products.find(p =>
      p.name?.toLowerCase().includes(q) ||
      q.includes(p.name?.toLowerCase())
    ) || null;
  }, [products]);

  // ── Clasificar con modelo local (Teachable Machine) ───────────────────
  const classifyLocal = useCallback(async () => {
    if (!modelRef.current?.model || !videoRef.current) return null;
    const { model, labels } = modelRef.current;
    const tf = await import('@tensorflow/tfjs');

    // Usar canvas pequeño para mayor velocidad (96x96 en vez de 224x224)
    const canvas  = document.createElement('canvas');
    canvas.width  = 96; canvas.height = 96;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, 96, 96);

    const tensor = tf.tidy(() =>
      tf.browser.fromPixels(canvas)
        .resizeBilinear([224, 224])
        .toFloat().div(127.5).sub(1).expandDims(0)
    );

    const preds  = await model.predict(tensor).data();
    tensor.dispose();

    return labels.map((label, i) => ({
      className:   label.toLowerCase(),
      probability: preds[i],
    })).sort((a, b) => b.probability - a.probability);
  }, []);

  // ── Clasificar con Google Vision ──────────────────────────────────────
  const classifyVision = useCallback(async () => {
    if (!videoRef.current || !apiKey) return null;
    const { base64 } = captureFrame(videoRef.current);
    return await classifyWithVision(base64, apiKey);
  }, [apiKey]);

  // ── Ciclo de clasificación ────────────────────────────────────────────
  const classify = useCallback(async () => {
    try {
      let preds = null;
      if (modoIA === 'local') {
        preds = await classifyLocal();
      } else {
        preds = await classifyVision();
      }
      if (!preds?.length) return;

      // Para Google Vision: buscar en TODAS las etiquetas cuál coincide con un producto del POS
      if (modoIA === 'vision') {
        // Filtrar etiquetas genéricas que no sirven
        const skip = ['food','fruit','plant','produce','natural foods','vegetable','ingredient',
          'whole food','local food','superfood','vegan nutrition','diet food','leaf vegetable',
          'tree','flower','still life','macro photography','close-up','freshness','health'];

        // Buscar primero en etiquetas específicas
        for (const pred of preds) {
          const label = pred.className.toLowerCase();
          if (skip.includes(label)) continue;
          if (pred.probability < 0.4) continue;

          // Buscar directamente en productos del POS
          const prod = products.find(p => {
            const pname = p.name?.toLowerCase() || '';
            return pname.includes(label) || label.includes(pname);
          });

          if (prod) {
            setPrediction({ nombre: prod.name, confianza: Math.round(pred.probability * 100) });
            setMatchedProd(prod);
            return;
          }

          // Buscar en mapa de traducción
          const mapped = Object.entries({
            'guava':'Guayaba', 'banana':'Banano', 'apple':'Manzana', 'orange':'Naranja',
            'lemon':'Limón', 'lime':'Limón', 'mango':'Mango', 'papaya':'Papaya',
            'pineapple':'Piña', 'watermelon':'Sandía', 'grape':'Uva', 'strawberry':'Fresa',
            'peach':'Durazno', 'pear':'Pera', 'coconut':'Coco', 'plantain':'Plátano',
            'passion fruit':'Maracuyá', 'guayaba':'Guayaba',
            'tomato':'Tomate', 'carrot':'Zanahoria', 'broccoli':'Brócoli',
            'potato':'Papa', 'onion':'Cebolla', 'garlic':'Ajo', 'cabbage':'Repollo',
            'cucumber':'Pepino', 'pepper':'Pimentón', 'corn':'Mazorca',
            'cassava':'Yuca', 'yuca':'Yuca', 'pumpkin':'Ahuyama', 'spinach':'Espinaca',
          }).find(([eng]) => label.includes(eng) || eng.includes(label));

          if (mapped) {
            const [, nombreEs] = mapped;
            const prodEs = products.find(p => p.name?.toLowerCase().includes(nombreEs.toLowerCase()));
            setPrediction({ nombre: nombreEs, confianza: Math.round(pred.probability * 100) });
            setMatchedProd(prodEs || null);
            return;
          }
        }

        // Si no encontró nada específico
        setPrediction({ nombre: null, confianza: 0 });
        setMatchedProd(null);
        return;
      }

      // Para modelo local (Teachable Machine)
      const top = preds[0];

      // Si el modelo dice "Desconocido" o la confianza es baja
      if (top.className === 'desconocido' || top.probability < 0.7) {
        setPrediction({ nombre: null, confianza: Math.round(top.probability * 100), noEncontrada: false });
        setMatchedProd(null);
        return;
      }

      const nombre = top.className.charAt(0).toUpperCase() + top.className.slice(1);
      const prod   = findProduct(nombre) || findProduct(top.className);
      setPrediction({ nombre, confianza: Math.round(top.probability * 100), noEncontrada: !prod });
      setMatchedProd(prod);

    } catch(e) {
      if (e.message?.includes('API') || e.message?.includes('key')) {
        setError(`Error Google Vision: ${e.message}`);
        stopScanning();
      }
    }
  }, [modoIA, classifyLocal, classifyVision, findProduct, products]);

  const startScanning = useCallback(() => {
    if (modoIA === 'local' && !modelReady) return;
    if (modoIA === 'vision' && !apiKey) return;
    setScanning(true);
    setPrediction(null);
    intervalRef.current = setInterval(classify, modoIA === 'vision' ? 1500 : 500);
  }, [modoIA, modelReady, apiKey, classify]);

  const canStart = modoIA === 'vision' ? !!apiKey : modelReady;

  // Tecla Enter — iniciar/agregar
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Enter') {
        if (!scanning && canStart) { startScanning(); return; }
        if (prediction?.nombre && matchedProd && peso && parseFloat(peso) > 0) { handleAdd(); }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [scanning, canStart, startScanning, prediction, matchedProd, peso]);

  const stopScanning = () => {
    setScanning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const handleAdd = () => {
    if (!prediction?.nombre || !matchedProd) return;
    const p = parseFloat(peso);
    if (!p || p <= 0) { alert('Ingresa el peso del producto'); return; }
    onAddToCart({ ...matchedProd, quantity: p, _peso: p, _precio_total: matchedProd.price * p });
    setPrediction(null); setMatchedProd(null); setPeso(''); stopScanning();
  };

  const saveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem('gv_api_key', apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
    setApiKeyInput('');
  };

  return (
    <div className="modal d-block" style={{ background:'rgba(0,0,0,0.92)', zIndex:99999 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0" style={{ background:'#0f172a', color:'#fff', borderRadius:16 }}>

          {/* Header */}
          <div className="d-flex align-items-center justify-content-between px-4 py-3"
            style={{ borderBottom:'1px solid #1e3a5f' }}>
            <div>
              <h5 className="fw-bold mb-0">📷 Reconocimiento IA</h5>
              <small className="text-muted">Frutas y Verduras</small>
            </div>
            <div className="d-flex gap-2 align-items-center">
              <div className="btn-group btn-group-sm">
                <button className={`btn ${modoIA==='local'?'btn-success':'btn-outline-secondary'}`}
                  onClick={()=>{ stopScanning(); setModoIA('local'); setPrediction(null); }}>
                  📴 Sin internet
                </button>
                <button className={`btn ${modoIA==='vision'?'btn-primary':'btn-outline-secondary'}`}
                  onClick={()=>{ stopScanning(); setModoIA('vision'); setPrediction(null); }}>
                  🌐 Google Vision
                </button>
              </div>
              <button className="btn btn-sm btn-outline-light" onClick={onClose}>✕</button>
            </div>
          </div>

          <div className="modal-body p-4">

            {/* Estado del modo */}
            <div className={`alert py-2 mb-3 ${modoIA==='local'?'alert-success':'alert-info'}`} style={{fontSize:13}}>
              {modoIA === 'local' ? (
                <>📴 <strong>Tu modelo personalizado</strong> (Teachable Machine) — Offline, reconoce tus productos exactos.
                  {modelLoading && <span className="ms-2"><span className="spinner-border spinner-border-sm me-1"/>Cargando modelo...</span>}
                  {!modelLoading && modelReady && <span className="ms-2 text-success fw-bold">✅ Listo</span>}
                </>
              ) : (
                <>🌐 <strong>Google Vision API</strong> — Alta precisión, requiere internet.
                  {!apiKey && <span className="ms-2 text-warning fw-bold">⚠️ Falta API Key</span>}
                  {apiKey && <span className="ms-2 text-success fw-bold">✅ Configurada</span>}
                </>
              )}
            </div>

            {error && <div className="alert alert-danger py-2" style={{fontSize:13}}>{error}</div>}

            <div className="row g-4">
              {/* Video */}
              <div className="col-md-7">
                <div style={{ position:'relative', borderRadius:12, overflow:'hidden', background:'#1e293b', minHeight:240 }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width:'100%', borderRadius:12, display:'block' }} />
                  {scanning && (
                    <div style={{ position:'absolute', top:10, left:10 }}>
                      <span className="badge bg-danger" style={{fontSize:11}}>🔴 Analizando...</span>
                    </div>
                  )}
                  {prediction?.nombre && (
                    <div style={{ position:'absolute', bottom:0, left:0, right:0,
                      background:'rgba(0,0,0,0.82)', padding:'10px 14px', borderRadius:'0 0 12px 12px' }}>
                      <div className="fw-bold text-success" style={{fontSize:16}}>
                        {getEmoji(prediction.nombre)} {prediction.nombre}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <div className="progress flex-grow-1" style={{height:5}}>
                          <div className={`progress-bar ${prediction.confianza>80?'bg-success':prediction.confianza>60?'bg-warning':'bg-danger'}`}
                            style={{width:`${prediction.confianza}%`}} />
                        </div>
                        <small className="text-muted">{prediction.confianza}%</small>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón escanear */}
                <div className="mt-3">
                  {!scanning ? (
                    <button className="btn btn-success btn-lg fw-bold w-100"
                      onClick={startScanning} disabled={!!error || !canStart || modelLoading}>
                      {modelLoading
                        ? <><span className="spinner-border spinner-border-sm me-2"/>Cargando modelo...</>
                        : '📷 Iniciar reconocimiento'}
                    </button>
                  ) : (
                    <button className="btn btn-warning btn-lg fw-bold w-100" onClick={stopScanning}>
                      ⏹ Detener
                    </button>
                  )}
                </div>

                {/* Configurar API Key Google Vision */}
                {modoIA === 'vision' && !apiKey && (
                  <div className="mt-3 p-3 rounded" style={{background:'#1e293b'}}>
                    <div className="small text-muted mb-2">🔑 API Key de Google Cloud Vision:</div>
                    <div className="input-group input-group-sm">
                      <input type="password" className="form-control" placeholder="AIza..."
                        value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)}
                        style={{background:'#0f172a',color:'#fff',border:'1px solid #334155'}} />
                      <button className="btn btn-outline-primary" onClick={saveApiKey}>Guardar</button>
                    </div>
                    <a href="https://console.cloud.google.com/apis/library/vision.googleapis.com"
                      target="_blank" rel="noreferrer" className="text-info small mt-1 d-block">
                      ¿Cómo obtener la API Key? →
                    </a>
                  </div>
                )}
              </div>

              {/* Panel resultado */}
              <div className="col-md-5">
                <div style={{ background:'#1e293b', borderRadius:12, padding:20, minHeight:300 }}>
                  {!prediction ? (
                    <div className="text-center text-muted py-4">
                      <div style={{fontSize:52}}>🥦</div>
                      <div className="mt-2 small">Pon el producto frente a la cámara y presiona Iniciar</div>
                      {modoIA === 'local' && modelReady && (
                        <div className="mt-3 p-2 rounded" style={{background:'#0f172a',fontSize:11}}>
                          <div className="text-muted mb-1">Productos entrenados:</div>
                          {modelRef.current?.labels?.map(l=>(
                            <span key={l} className="badge bg-secondary me-1 mt-1">{l}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : !prediction.nombre ? (
                    <div className="text-center py-4">
                      <div style={{fontSize:52}}>🤔</div>
                      <div className="fw-bold text-warning mt-2">Fruta no reconocida</div>
                      <div className="text-muted small mt-2">
                        {modoIA === 'local'
                          ? 'Este producto no fue entrenado en tu modelo. Agrega más clases en Teachable Machine.'
                          : 'Intenta con mejor iluminación o acerca más el producto.'}
                      </div>
                    </div>
                  ) : prediction.noEncontrada ? (
                    <div className="text-center py-4">
                      <div style={{fontSize:52}}>⚠️</div>
                      <div className="fw-bold text-warning mt-2">{prediction.nombre}</div>
                      <span className={`badge ${prediction.confianza>80?'bg-success':prediction.confianza>60?'bg-warning text-dark':'bg-danger'} mt-1`}>
                        {prediction.confianza}% confianza
                      </span>
                      <div className="alert alert-warning py-2 small mt-3 text-start">
                        ⚠️ <strong>"{prediction.nombre}"</strong> no está registrado en el inventario.<br/>
                        <span className="text-muted">Regístralo en Inventario con ese nombre exacto.</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-center mb-3">
                        <div style={{fontSize:52}}>{getEmoji(prediction.nombre)}</div>
                        <div className="fw-bold fs-5 text-white mt-1">{prediction.nombre}</div>
                        <span className={`badge ${prediction.confianza>80?'bg-success':prediction.confianza>60?'bg-warning text-dark':'bg-danger'}`}>
                          {prediction.confianza}% confianza
                        </span>
                      </div>

                      {matchedProd ? (
                        <>
                          <div className="mb-3 p-2 rounded" style={{background:'#0f2740'}}>
                            <div className="small text-muted">Producto en sistema:</div>
                            <div className="fw-semibold text-white">{matchedProd.name}</div>
                            <div className="text-success fw-bold">{fmt(matchedProd.price)} / kg</div>
                          </div>
                          <div className="mb-3">
                            <label className="form-label fw-semibold text-white">⚖️ Peso (kg)</label>
                            <div className="input-group">
                              <input type="number" className="form-control form-control-lg text-center fw-bold"
                                min="0.001" step="0.001" placeholder="0.000"
                                value={peso} onChange={e=>setPeso(e.target.value)}
                                style={{fontSize:22,background:'#0f172a',color:'#fff',border:'2px solid #3b82f6'}}
                                autoFocus />
                              <span className="input-group-text"
                                style={{background:'#1e3a5f',color:'#fff',border:'2px solid #3b82f6'}}>kg</span>
                            </div>
                            {peso && parseFloat(peso)>0 && (
                              <div className="text-center mt-2 fw-bold text-success" style={{fontSize:20}}>
                                = {fmt(matchedProd.price * parseFloat(peso))}
                              </div>
                            )}
                          </div>
                          <button className="btn btn-success btn-lg w-100 fw-bold"
                            onClick={handleAdd} disabled={!peso||parseFloat(peso)<=0}>
                            🛒 Agregar al carrito
                          </button>
                        </>
                      ) : (
                        <div className="alert alert-warning py-2 small">
                          ⚠️ <strong>"{prediction.nombre}"</strong> no está registrado en el sistema con ese nombre exacto. Verifica que el nombre en tu inventario coincida.
                        </div>
                      )}
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