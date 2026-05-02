import React, { useEffect, useRef, useState, useCallback } from 'react';

// ── Configuración ─────────────────────────────────────────────────────────
const MODELO_LOCAL_URL       = '/modelo-frutas/model.json';
const UMBRAL_LOCAL           = 0.85;  // 85% — si supera esto usa modelo local
const UMBRAL_VISION_FALLBACK = 0.40;  // Google Vision solo si local falla

// ── Etiquetas genéricas de Vision a ignorar ───────────────────────────────
const ETIQUETAS_GENERICAS = new Set([
  'food','fruit','plant','produce','natural foods','vegetable','ingredient',
  'whole food','local food','superfood','vegan nutrition','diet food',
  'leaf vegetable','tree','flower','still life','macro photography',
  'close-up','freshness','health','nutrition','organic food','raw food',
  'citrus','berry','tropical fruit','stone fruit','drupe','staple food',
  'root vegetable','allium','brassica','nightshade','solanum','cucurbit',
  'legume','herb','spice','cuisine','dish','recipe','cooking','market',
  'grocery','farm','agriculture','photography','image','stock photo',
  'macro','nature','green','yellow','red','orange','purple','white','colorful',
]);

// ── Mapa inglés → español ─────────────────────────────────────────────────
const MAPA = {
  'banana':'banano','plantain':'plátano','apple':'manzana','orange':'naranja',
  'lemon':'limón','lime':'limón','pineapple':'piña','strawberry':'fresa',
  'mango':'mango','watermelon':'sandía','papaya':'papaya','grape':'uva',
  'peach':'durazno','pear':'pera','coconut':'coco','guava':'guayaba',
  'passion fruit':'maracuyá','dragon fruit':'pitaya','avocado':'aguacate',
  'kiwi':'kiwi','melon':'melón','cantaloupe':'melón','plum':'ciruela',
  'blackberry':'mora','blueberry':'mora azul','tamarind':'tamarindo',
  'soursop':'guanábana','feijoa':'feijoa','lulo':'lulo',
  'naranjilla':'lulo','tree tomato':'tomate de árbol','tamarillo':'tomate de árbol',
  'cape gooseberry':'uchuva','physalis':'uchuva','mandarin':'mandarina',
  'tangerine':'mandarina','grapefruit':'toronja',
  'tomato':'tomate','carrot':'zanahoria','broccoli':'brócoli',
  'potato':'papa','sweet potato':'batata','onion':'cebolla cabezona',
  'red onion':'cebolla cabezona morada','green onion':'cebolla larga',
  'scallion':'cebolla larga','garlic':'ajo','cabbage':'repollo',
  'cucumber':'pepino','bell pepper':'pimentón','pepper':'pimentón',
  'corn':'mazorca','lettuce':'lechuga','spinach':'espinaca',
  'celery':'apio','beet':'remolacha','beetroot':'remolacha',
  'pumpkin':'ahuyama','squash':'ahuyama','cassava':'yuca','yuca':'yuca',
  'yam':'ñame','cauliflower':'coliflor','eggplant':'berenjena',
  'mushroom':'champiñón','zucchini':'calabacín',
};

const fmt = n => Number(n||0).toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0});

const getEmoji = (nombre = '') => {
  const n = nombre.toLowerCase();
  if (n.includes('banano') || n.includes('banana'))    return '🍌';
  if (n.includes('plátano') || n.includes('plantain')) return '🍌';
  if (n.includes('manzana verde'))                     return '🍏';
  if (n.includes('manzana'))                           return '🍎';
  if (n.includes('naranja') || n.includes('mandarina'))return '🍊';
  if (n.includes('limón'))                             return '🍋';
  if (n.includes('piña'))                              return '🍍';
  if (n.includes('fresa'))                             return '🍓';
  if (n.includes('mora'))                              return '🫐';
  if (n.includes('mango'))                             return '🥭';
  if (n.includes('sandía'))                            return '🍉';
  if (n.includes('papaya'))                            return '🥭';
  if (n.includes('uva'))                               return '🍇';
  if (n.includes('aguacate'))                          return '🥑';
  if (n.includes('melón'))                             return '🍈';
  if (n.includes('pitaya'))                            return '🐉';
  if (n.includes('lulo'))                              return '🍊';
  if (n.includes('guayaba'))                           return '🍐';
  if (n.includes('maracuyá'))                          return '🟡';
  if (n.includes('guanábana'))                         return '🍈';
  if (n.includes('uchuva'))                            return '🟡';
  if (n.includes('tomate de árbol'))                   return '🍅';
  if (n.includes('tomate'))                            return '🍅';
  if (n.includes('zanahoria'))                         return '🥕';
  if (n.includes('brócoli'))                           return '🥦';
  if (n.includes('pepino'))                            return '🥒';
  if (n.includes('repollo'))                           return '🥬';
  if (n.includes('pimentón'))                          return '🫑';
  if (n.includes('mazorca'))                           return '🌽';
  if (n.includes('cebolla cabezona morada'))           return '🧅';
  if (n.includes('cebolla cabezona'))                  return '🧅';
  if (n.includes('cebolla larga'))                     return '🧅';
  if (n.includes('ajo'))                               return '🧄';
  if (n.includes('lechuga'))                           return '🥬';
  if (n.includes('ahuyama'))                           return '🎃';
  if (n.includes('papa criolla'))                      return '🥔';
  if (n.includes('papa'))                              return '🥔';
  if (n.includes('yuca'))                              return '🥔';
  if (n.includes('remolacha'))                         return '🍠';
  if (n.includes('espinaca'))                          return '🥬';
  if (n.includes('apio'))                              return '🥬';
  if (n.includes('champiñón'))                         return '🍄';
  return '🥬';
};

const findInProducts = (nombre, products) => {
  if (!nombre) return null;
  const q = nombre.toLowerCase();
  return products.find(p =>
    p.name?.toLowerCase().includes(q) || q.includes(p.name?.toLowerCase())
  ) || null;
};

// ── COMPONENTE ────────────────────────────────────────────────────────────
const CamaraIA = ({ products = [], onAddToCart, onClose }) => {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const intervalRef = useRef(null);
  const modelRef    = useRef(null);

  const [modelReady,   setModelReady]   = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [scanning,     setScanning]     = useState(false);
  const [procesando,   setProcesando]   = useState(false);
  const [resultado,    setResultado]    = useState(null);
  const [peso,         setPeso]         = useState('');
  const [error,        setError]        = useState(null);
  const [camError,     setCamError]     = useState(false);
  const [apiKey,       setApiKey]       = useState(localStorage.getItem('gv_api_key') || '');
  const [apiKeyInput,  setApiKeyInput]  = useState('');
  const [debugInfo,    setDebugInfo]    = useState('');
  const [fuenteDetec,  setFuenteDetec]  = useState(''); // 'local' o 'vision'

  // ── Cámara ──────────────────────────────────────────────────────────
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode:'environment', width:{ideal:1280}, height:{ideal:720} }
        });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch {
        setCamError(true);
        setError('No se pudo acceder a la cámara. En Chrome: chrome://flags → "Insecure origins treated as secure" → agrega la IP.');
      }
    };
    start();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(intervalRef.current);
    };
  }, []);

  // ── Cargar modelo local ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setModelLoading(true);
      try {
        const tf      = await import('@tensorflow/tfjs');
        const model   = await tf.loadLayersModel(MODELO_LOCAL_URL);
        const metaRes = await fetch('/modelo-frutas/metadata.json').catch(() => null);
        const meta    = metaRes ? await metaRes.json() : null;
        modelRef.current = { model, labels: meta?.labels || [] };
        setModelReady(true);
      } catch(e) {
        setError(`Modelo local no encontrado. Asegúrate de poner los archivos en public/modelo-frutas/. Error: ${e.message}`);
      } finally {
        setModelLoading(false);
      }
    };
    load();
  }, []);

  // ── Clasificar con modelo local ──────────────────────────────────────
  const classifyLocal = useCallback(async () => {
    if (!modelRef.current?.model || !videoRef.current) return null;
    const { model, labels } = modelRef.current;
    const tf = await import('@tensorflow/tfjs');

    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 96;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, 96, 96);

    const tensor = tf.tidy(() =>
      tf.browser.fromPixels(canvas)
        .resizeBilinear([224, 224])
        .toFloat().div(127.5).sub(1).expandDims(0)
    );
    const preds = await model.predict(tensor).data();
    tensor.dispose();

    return labels.map((label, i) => ({
      className: label.toLowerCase(),
      probability: preds[i],
    })).sort((a,b) => b.probability - a.probability);
  }, []);

  // ── Clasificar con Google Vision ─────────────────────────────────────
  const classifyVision = useCallback(async () => {
    if (!videoRef.current || !apiKey) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, 640, 480);
    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [
              { type: 'LABEL_DETECTION',     maxResults: 15 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 5  },
            ]
          }]
        })
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const labels  = data.responses?.[0]?.labelAnnotations || [];
    const objects = data.responses?.[0]?.localizedObjectAnnotations || [];
    return [
      ...labels,
      ...objects.map(o => ({ description: o.name, score: o.score }))
    ];
  }, [apiKey]);

  // ── Procesar resultado de Vision ─────────────────────────────────────
  const procesarVision = useCallback((etiquetas) => {
    const especificas = etiquetas
      .filter(l => !ETIQUETAS_GENERICAS.has(l.description.toLowerCase()))
      .sort((a,b) => b.score - a.score);

    setDebugInfo('Vision: ' + especificas.slice(0,3)
      .map(l => `${l.description} ${Math.round(l.score*100)}%`).join(' | '));

    for (const label of especificas) {
      const desc  = label.description.toLowerCase();
      const score = label.score;
      if (score < UMBRAL_VISION_FALLBACK) continue;

      // Buscar directo en productos
      const prodDirecto = products.find(p => {
        const pn = p.name?.toLowerCase() || '';
        return pn.includes(desc) || desc.includes(pn);
      });
      if (prodDirecto) return { nombre: prodDirecto.name, confianza: Math.round(score*100), producto: prodDirecto };

      // Traducir
      const traducido = MAPA[desc];
      if (traducido) {
        const prodEs = products.find(p => p.name?.toLowerCase().includes(traducido));
        const nombre = traducido.charAt(0).toUpperCase() + traducido.slice(1);
        return { nombre, confianza: Math.round(score*100), producto: prodEs || null };
      }

      // Coincidencia parcial con mapa
      for (const [eng, esp] of Object.entries(MAPA)) {
        if (desc.includes(eng) || eng.includes(desc)) {
          const prodEs = products.find(p => p.name?.toLowerCase().includes(esp));
          const nombre = esp.charAt(0).toUpperCase() + esp.slice(1);
          return { nombre, confianza: Math.round(score*100), producto: prodEs || null };
        }
      }
    }
    return null;
  }, [products]);

  // ── Ciclo principal: Local → Vision si falla ─────────────────────────
  const analizar = useCallback(async () => {
    if (procesando || !videoRef.current) return;
    setProcesando(true);

    try {
      // PASO 1: Intentar modelo local
      if (modelReady) {
        const preds = await classifyLocal();
        if (preds?.length) {
          const top    = preds[0];
          const second = preds[1];
          const esProblematica = ['cebolla larga','green onion','scallion']
            .some(c => top.className.includes(c));

          // Debug local
          setDebugInfo(`📴 Local: ${preds.slice(0,3).map(p =>
            `${p.className} ${Math.round(p.probability*100)}%`).join(' | ')}`);

          // Condiciones para aceptar el resultado local:
          const confianzaOk      = top.probability >= UMBRAL_LOCAL;
          const noEsProblematica = !esProblematica || top.probability >= 0.95;
          const noEsEmpate       = !second || (top.probability - second.probability) >= 0.10;
          const noEsDesconocido  = top.className !== 'desconocido';

          if (confianzaOk && noEsProblematica && noEsEmpate && noEsDesconocido) {
            const nombre = top.className.charAt(0).toUpperCase() + top.className.slice(1);
            const prod   = findInProducts(nombre, products) || findInProducts(top.className, products);
            setFuenteDetec('local');
            setResultado({ nombre, confianza: Math.round(top.probability*100), producto: prod });
            if (top.probability >= 0.92) stopScanning(); // muy seguro → detener
            setProcesando(false);
            return;
          }
        }
      }

      // PASO 2: Fallback a Google Vision (solo si hay API key)
      if (apiKey) {
        setDebugInfo(prev => prev + ' → 🌐 Vision...');
        const etiquetas = await classifyVision();
        if (etiquetas) {
          const res = procesarVision(etiquetas);
          setFuenteDetec('vision');
          if (res) {
            setResultado(res);
            if (res.confianza >= 80) stopScanning();
          } else {
            setResultado({ nombre: null, confianza: 0, producto: null });
          }
        }
      } else {
        // Sin API key y local no reconoció
        setResultado({ nombre: null, confianza: 0, producto: null });
      }

    } catch(e) {
      if (e.message?.includes('Failed to fetch')) {
        setDebugInfo('Sin internet — usando solo modelo local');
      }
    } finally {
      setProcesando(false);
    }
  }, [procesando, modelReady, apiKey, classifyLocal, classifyVision, procesarVision, products]);

  const startScanning = useCallback(() => {
    if (!modelReady && !apiKey) return;
    setScanning(true);
    setResultado(null);
    setDebugInfo('');
    intervalRef.current = setInterval(analizar, 800);
  }, [modelReady, apiKey, analizar]);

  const stopScanning = () => {
    setScanning(false);
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const handleAdd = () => {
    if (!resultado?.producto) return;
    const p = parseFloat(peso);
    if (!p || p <= 0) { alert('Ingresa el peso'); return; }
    onAddToCart({ ...resultado.producto, quantity: p, _peso: p, _precio_total: resultado.producto.price * p });
    setResultado(null); setPeso(''); stopScanning();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter') {
        if (!scanning && (modelReady || apiKey) && !camError) { startScanning(); return; }
        if (resultado?.producto && peso && parseFloat(peso) > 0) handleAdd();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scanning, modelReady, apiKey, resultado, peso]);

  const canStart = (modelReady || !!apiKey) && !camError;

  return (
    <div className="modal d-block" style={{ background:'rgba(0,0,0,0.92)', zIndex:99999 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0" style={{ background:'#0f172a', color:'#fff', borderRadius:16 }}>

          {/* Header */}
          <div className="d-flex align-items-center justify-content-between px-4 py-3"
            style={{ borderBottom:'1px solid #1e3a5f' }}>
            <div>
              <h5 className="fw-bold mb-0">📷 Cámara IA — Frutas y Verduras</h5>
              <small className="text-muted">
                {modelReady ? '✅ Modelo local listo' : modelLoading ? '⏳ Cargando modelo...' : '❌ Sin modelo local'}
                {' · '}
                {apiKey ? '✅ Google Vision configurado' : '⚠️ Sin Google Vision'}
              </small>
            </div>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body p-4">

            {/* Estado del sistema */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className={`p-2 rounded text-center small fw-bold ${modelReady?'bg-success':'bg-secondary'} bg-opacity-25`}>
                  📴 Modelo local {modelReady?'✅':'⏳'}
                  {modelLoading && <span className="spinner-border spinner-border-sm ms-1"/>}
                </div>
              </div>
              <div className="col-6">
                <div className={`p-2 rounded text-center small fw-bold ${apiKey?'bg-primary':'bg-warning text-dark'} bg-opacity-25`}>
                  🌐 Google Vision {apiKey?'✅':'Sin key'}
                </div>
              </div>
            </div>

            {/* Flujo */}
            <div className="alert py-2 mb-3" style={{background:'#1e293b',fontSize:12,color:'#94a3b8'}}>
              🔄 <strong style={{color:'#fff'}}>Flujo:</strong> Modelo local (85% umbral) → si no reconoce → Google Vision (ahorra capa gratuita)
            </div>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            {/* Debug */}
            {debugInfo && (
              <div className="alert alert-secondary py-1 mb-2" style={{fontSize:11,fontFamily:'monospace'}}>
                🔍 {debugInfo}
                {fuenteDetec && <span className={`ms-2 badge ${fuenteDetec==='local'?'bg-success':'bg-primary'}`}>
                  {fuenteDetec==='local'?'📴 Local':'🌐 Vision'}
                </span>}
              </div>
            )}

            {/* Configurar API Key */}
            {!apiKey && (
              <div className="alert alert-warning py-2 mb-3" style={{fontSize:13}}>
                <div className="fw-bold mb-1">🌐 Google Vision (opcional pero recomendado)</div>
                <div className="input-group input-group-sm">
                  <input type="password" className="form-control" placeholder="AIzaSy... (opcional)"
                    value={apiKeyInput} onChange={e=>setApiKeyInput(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&saveApiKey()}
                    style={{background:'#1e293b',color:'#fff',border:'1px solid #475569'}}/>
                  <button className="btn btn-warning fw-bold" onClick={saveApiKey}>Guardar</button>
                </div>
                <div className="text-muted small mt-1">Sin key solo usa el modelo local. Con key tiene respaldo automático.</div>
              </div>
            )}

            <div className="row g-4">
              {/* Video */}
              <div className="col-md-7">
                <div style={{ position:'relative', borderRadius:12, overflow:'hidden',
                  background:'#1e293b', minHeight:260 }}>
                  <video ref={videoRef} autoPlay playsInline muted
                    style={{ width:'100%', borderRadius:12, display:'block' }} />
                  {scanning && (
                    <div style={{ position:'absolute', top:10, left:10, display:'flex', gap:6 }}>
                      <span className="badge bg-danger">🔴 Analizando...</span>
                      {procesando && <span className="badge bg-warning text-dark">⏳</span>}
                    </div>
                  )}
                  {resultado?.nombre && (
                    <div style={{ position:'absolute', bottom:0, left:0, right:0,
                      background:'rgba(0,0,0,0.85)', padding:'10px 14px',
                      borderRadius:'0 0 12px 12px' }}>
                      <div className="fw-bold text-success" style={{fontSize:16}}>
                        {getEmoji(resultado.nombre)} {resultado.nombre}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <div className="progress flex-grow-1" style={{height:5}}>
                          <div className={`progress-bar ${resultado.confianza>=85?'bg-success':resultado.confianza>=60?'bg-warning':'bg-danger'}`}
                            style={{width:`${resultado.confianza}%`}}/>
                        </div>
                        <small className="text-muted">{resultado.confianza}%</small>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  {!scanning ? (
                    <button className="btn btn-success btn-lg fw-bold w-100"
                      disabled={!canStart || modelLoading}
                      onClick={startScanning}>
                      {modelLoading
                        ? <><span className="spinner-border spinner-border-sm me-2"/>Cargando modelo...</>
                        : '📷 Iniciar reconocimiento (Enter)'}
                    </button>
                  ) : (
                    <button className="btn btn-warning btn-lg fw-bold w-100" onClick={stopScanning}>
                      ⏹ Detener
                    </button>
                  )}
                </div>

                {camError && (
                  <div className="alert alert-warning small mt-2 py-2">
                    📱 <strong>Para celular en red local:</strong><br/>
                    Chrome → <code>chrome://flags</code> → "Insecure origins" → agrega tu IP
                  </div>
                )}

                {apiKey && (
                  <div className="mt-2 text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={()=>{
                      localStorage.removeItem('gv_api_key'); setApiKey('');
                    }}>Cambiar API Key</button>
                  </div>
                )}
              </div>

              {/* Panel resultado */}
              <div className="col-md-5">
                <div style={{ background:'#1e293b', borderRadius:12, padding:20, minHeight:300 }}>
                  {!resultado ? (
                    <div className="text-center text-muted py-4">
                      <div style={{fontSize:52}}>🥦</div>
                      <div className="mt-2 small">Pon la fruta frente a la cámara y presiona Iniciar</div>
                      <div className="mt-3 p-2 rounded text-start" style={{background:'#0f172a',fontSize:11}}>
                        <div className="text-muted mb-1">💡 Consejos:</div>
                        <div>• Buena iluminación</div>
                        <div>• Fondo neutro o claro</div>
                        <div>• Acercar el producto</div>
                        <div>• Una sola fruta a la vez</div>
                      </div>
                    </div>

                  ) : !resultado.nombre ? (
                    <div className="text-center py-4">
                      <div style={{fontSize:52}}>🤔</div>
                      <div className="fw-bold text-warning mt-2">No reconocido</div>
                      <div className="text-muted small mt-2">
                        {apiKey
                          ? 'Ni el modelo local ni Google Vision reconocieron el producto.'
                          : 'El modelo local no alcanzó el 85% de confianza.'}
                      </div>
                      <div className="mt-3 p-2 rounded text-start" style={{background:'#0f172a',fontSize:11}}>
                        <div className="text-muted">Intenta:</div>
                        <div>• Más luz natural</div>
                        <div>• Acercar más el producto</div>
                        <div>• Fondo blanco</div>
                        <div>• Un solo ángulo a la vez</div>
                      </div>
                    </div>

                  ) : !resultado.producto ? (
                    <div className="text-center py-3">
                      <div style={{fontSize:48}}>{getEmoji(resultado.nombre)}</div>
                      <div className="fw-bold text-warning mt-2">{resultado.nombre}</div>
                      <span className="badge bg-warning text-dark mt-1">{resultado.confianza}% confianza</span>
                      <div className="alert alert-warning py-2 small mt-3 text-start">
                        ⚠️ <strong>{resultado.nombre}</strong> detectado pero no está en el inventario.<br/>
                        Regístralo en Productos con ese nombre exacto.
                      </div>
                    </div>

                  ) : (
                    <>
                      <div className="text-center mb-3">
                        <div style={{fontSize:52}}>{getEmoji(resultado.nombre)}</div>
                        <div className="fw-bold fs-5 text-white mt-1">{resultado.nombre}</div>
                        <span className={`badge mt-1 ${resultado.confianza>=85?'bg-success':resultado.confianza>=60?'bg-warning text-dark':'bg-danger'}`}>
                          {resultado.confianza}% confianza
                        </span>
                        {fuenteDetec && (
                          <span className={`badge ms-1 mt-1 ${fuenteDetec==='local'?'bg-success':'bg-primary'}`}>
                            {fuenteDetec==='local'?'📴 Offline':'🌐 Vision'}
                          </span>
                        )}
                      </div>

                      <div className="mb-3 p-2 rounded" style={{background:'#0f2740'}}>
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
                            value={peso} onChange={e=>setPeso(e.target.value)}
                            style={{fontSize:22,background:'#0f172a',color:'#fff',border:'2px solid #3b82f6'}}
                            autoFocus />
                          <span className="input-group-text"
                            style={{background:'#1e3a5f',color:'#fff',border:'2px solid #3b82f6'}}>kg</span>
                        </div>
                        {peso && parseFloat(peso)>0 && (
                          <div className="text-center mt-2 fw-bold text-success" style={{fontSize:20}}>
                            = {fmt(resultado.producto.price * parseFloat(peso))}
                          </div>
                        )}
                      </div>

                      <button className="btn btn-success btn-lg w-100 fw-bold"
                        onClick={handleAdd} disabled={!peso||parseFloat(peso)<=0}>
                        🛒 Agregar al carrito (Enter)
                      </button>
                      <button className="btn btn-outline-secondary w-100 mt-2"
                        onClick={()=>{ setResultado(null); setPeso(''); startScanning(); }}>
                        🔄 Escanear otro
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

const saveApiKey = () => {}; // declarada arriba en el componente

export default CamaraIA;