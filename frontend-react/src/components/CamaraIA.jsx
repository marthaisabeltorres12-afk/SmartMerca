import React, { useRef, useState, useEffect, useCallback } from 'react';

const IA_SERVICE = 'http://localhost:5001/detect';
const INTERVALO_MS = 800; // analizar cada 800ms
const FRAMES_CONF  = 4;   // confirmar si detecta el mismo producto 4 veces seguidas

const CamaraIA = ({ onAddToCart, onClose, products }) => {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const animRef     = useRef(null);
  const contadorRef = useRef({});
  const pausadoRef  = useRef(false);

  const [estado,    setEstado]    = useState('cargando');
  const [deteccion, setDeteccion] = useState(null);
  const [mensaje,   setMensaje]   = useState('Iniciando cámara...');
  const [analizando,setAnalizando]= useState(false);

  // ── Enter agrega al carrito ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && pausadoRef.current && deteccion) confirmarProducto();
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deteccion]);

  // ── Iniciar cámara ───────────────────────────────────────────────────
  useEffect(() => {
    iniciarCamara();
    return () => detenerCamara();
  }, []);

  const iniciarCamara = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEstado('buscando');
      setMensaje('Apunta al producto');
      iniciarLoop();
    } catch {
      try {
        const s2 = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = s2;
        if (videoRef.current) { videoRef.current.srcObject = s2; await videoRef.current.play(); }
        setEstado('buscando');
        setMensaje('Apunta al producto');
        iniciarLoop();
      } catch {
        setEstado('error');
        setMensaje('No se pudo acceder a la cámara');
      }
    }
  }, []);

  const detenerCamara = () => {
    if (animRef.current) clearInterval(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  };

  const cerrar = () => { detenerCamara(); if (typeof onClose === 'function') onClose(); };

  // ── Capturar frame del video ─────────────────────────────────────────
  const capturarFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
  };

  // ── Loop de detección ────────────────────────────────────────────────
  const iniciarLoop = useCallback(() => {
    animRef.current = setInterval(async () => {
      if (pausadoRef.current || analizando) return;

      const imagen = capturarFrame();
      if (!imagen) return;

      setAnalizando(true);
      try {
        const res  = await fetch(IA_SERVICE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagen }),
        });
        const data = await res.json();

        if (!data.detectado) {
          // Nada detectado — resetear contador
          contadorRef.current = {};
          if (!pausadoRef.current) {
            setDeteccion(null);
            setEstado('buscando');
            setMensaje(data.alerta || 'Apunta al producto');
          }
          return;
        }

        // Incrementar contador del producto detectado
        const prod = data.producto;
        contadorRef.current[prod] = (contadorRef.current[prod] || 0) + 1;

        // Resetear otros productos
        Object.keys(contadorRef.current).forEach(k => {
          if (k !== prod) contadorRef.current[k] = 0;
        });

        // Confirmar si aparece FRAMES_CONF veces seguidas
        if (contadorRef.current[prod] >= FRAMES_CONF) {
          pausadoRef.current = true;
          setDeteccion(data);
          setEstado('confirmado');
          setMensaje('¡Detectado!');
        }

      } catch {
        // Microservicio no disponible
        setMensaje('⚠️ Servicio IA no disponible');
      } finally {
        setAnalizando(false);
      }
    }, INTERVALO_MS);
  }, []);

  // ── Confirmar → agregar al carrito ───────────────────────────────────
  const confirmarProducto = useCallback(() => {
    if (!deteccion) return;
    const nombre = deteccion.producto.toLowerCase();
    const prod   = products?.find(p =>
      p.name?.toLowerCase().includes(nombre) ||
      nombre.includes(p.name?.toLowerCase())
    );
    if (prod && typeof onAddToCart === 'function') {
      onAddToCart(prod);
    } else {
      alert(`"${deteccion.producto}" no encontrado en inventario`);
    }
    detenerCamara();
    if (typeof onClose === 'function') onClose();
  }, [deteccion, products, onAddToCart, onClose]);

  const seguirBuscando = () => {
    pausadoRef.current  = false;
    contadorRef.current = {};
    setDeteccion(null);
    setEstado('buscando');
    setMensaje('Apunta al producto');
  };

  const confirmado = estado === 'confirmado' && deteccion;

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.88)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:16
    }}>
      <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', width:'100%', maxWidth:480, boxShadow:'0 25px 60px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ background:'#1e3a5f', color:'#fff', padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>🤖</span>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Cámara IA</div>
              <div style={{ fontSize:11, opacity:0.75 }}>YOLOv8 · SmartMerca</div>
            </div>
          </div>
          <button onClick={cerrar} style={{ background:'rgba(220,38,38,0.8)', border:'none', color:'#fff', borderRadius:8, padding:'6px 14px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            ✕ Cerrar
          </button>
        </div>

        {/* Video */}
        <div style={{ position:'relative', background:'#000', aspectRatio:'4/3' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block',
              filter: confirmado ? 'brightness(0.55)' : 'none', transition:'filter 0.3s' }}/>
          <canvas ref={canvasRef} style={{ display:'none' }}/>

          {/* Marco */}
          <div style={{
            position:'absolute', inset:'12%',
            border: `3px solid ${confirmado ? '#22c55e' : analizando ? '#f59e0b' : 'rgba(255,255,255,0.5)'}`,
            borderRadius:14,
            boxShadow: confirmado ? '0 0 30px rgba(34,197,94,0.5)' : 'none',
            transition:'all 0.3s', pointerEvents:'none'
          }}/>

          {/* Overlay confirmado */}
          {confirmado && (
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10 }}>
              <div style={{ fontSize:52 }}>✅</div>
              <div style={{ background:'rgba(21,128,61,0.95)', color:'#fff', borderRadius:12, padding:'12px 28px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:800 }}>{deteccion.producto}</div>
                <div style={{ fontSize:13, opacity:0.85, marginTop:4 }}>{deteccion.confianza}% confianza</div>
                {deteccion.alerta && (
                  <div style={{ fontSize:12, color:'#fde68a', marginTop:4 }}>⚠️ {deteccion.alerta}</div>
                )}
              </div>
              <div style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>
                Presiona <strong style={{ color:'#fff' }}>ENTER</strong> o el botón verde
              </div>
            </div>
          )}

          {/* Mensaje buscando */}
          {!confirmado && (
            <div style={{ position:'absolute', bottom:10, left:10, right:10, background:'rgba(0,0,0,0.65)', borderRadius:8, padding:'8px 14px', color:'#fff', fontSize:13, fontWeight:600, textAlign:'center' }}>
              {estado === 'cargando'   && '⏳ ' + mensaje}
              {estado === 'buscando'   && (analizando ? '🔍 Analizando...' : '🎯 ' + mensaje)}
              {estado === 'error'      && '❌ ' + mensaje}
            </div>
          )}
        </div>

        {/* Botones */}
        <div style={{ padding:14 }}>
          {confirmado ? (
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={seguirBuscando} style={{ flex:1, padding:'11px 0', background:'#f3f4f6', border:'none', borderRadius:10, fontWeight:600, fontSize:14, cursor:'pointer', color:'#374151' }}>
                🔄 Otro
              </button>
              <button onClick={confirmarProducto} style={{ flex:2, padding:'11px 0', background:'#16a34a', border:'none', borderRadius:10, fontWeight:700, fontSize:15, cursor:'pointer', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                🛒 Agregar al carrito <span style={{ opacity:0.65, fontSize:12 }}>(Enter)</span>
              </button>
            </div>
          ) : (
            <div style={{ textAlign:'center', color:'#9ca3af', fontSize:13, padding:'8px 0' }}>
              {estado === 'error'
                ? <button onClick={iniciarCamara} style={{ background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626', borderRadius:8, padding:'8px 16px', cursor:'pointer' }}>🔄 Reintentar</button>
                : 'Mantén el producto quieto en el marco'}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CamaraIA;