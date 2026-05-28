import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as tmImage from '@teachablemachine/image';

const MODEL_URL     = '/modelo-frutas/model.json';
const METADATA_URL  = '/modelo-frutas/metadata.json';
const CONFIANZA_MIN = 0.78;
const FRAMES_CONF   = 6;

// ── Pon aquí tu API Key de Google Cloud Vision ──────────────────────────
const GOOGLE_VISION_API_KEY = 'TU_API_KEY_AQUI';

const CamaraIA = ({ onAddToCart, onClose, products }) => {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const modelRef    = useRef(null);
  const animRef     = useRef(null);
  const contadorRef = useRef({});
  const pausadoRef  = useRef(false);

  const [estado,     setEstado]     = useState('cargando'); // cargando | buscando | confirmado | google | error
  const [deteccion,  setDeteccion]  = useState(null);
  const [mensaje,    setMensaje]    = useState('Cargando modelo IA...');
  const [buscandoG,  setBuscandoG]  = useState(false);
  const [resultadoG, setResultadoG] = useState(null); // resultado de Google Vision

  // ── Enter agrega al carrito ────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && pausadoRef.current && deteccion) confirmarProducto();
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deteccion]);

  // ── Cargar modelo ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        const modelo = await tmImage.load(MODEL_URL, METADATA_URL);
        if (cancelado) return;
        modelRef.current = modelo;
        await iniciarCamara();
      } catch {
        if (!cancelado) { setEstado('error'); setMensaje('Error cargando el modelo IA'); }
      }
    };
    cargar();
    return () => { cancelado = true; detenerCamara(); };
  }, []);

  // ── Cámara ─────────────────────────────────────────────────────────────
  const iniciarCamara = useCallback(async () => {
    detenerLoop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
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

  const detenerLoop   = () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  const detenerCamara = () => {
    detenerLoop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  const cerrar = () => { detenerCamara(); if (typeof onClose === 'function') onClose(); };

  // ── Loop Teachable Machine ─────────────────────────────────────────────
  const iniciarLoop = useCallback(() => {
    const loop = async () => {
      if (pausadoRef.current) { animRef.current = requestAnimationFrame(loop); return; }
      if (!modelRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        animRef.current = requestAnimationFrame(loop); return;
      }
      try {
        const res    = await modelRef.current.predict(videoRef.current);
        const sorted = [...res].sort((a, b) => b.probability - a.probability);
        const top    = sorted[0];
        const second = sorted[1];
        const diff   = top && second ? top.probability - second.probability : 0;
        const contadores = contadorRef.current;

        if (top && top.probability >= CONFIANZA_MIN && diff >= 0.20) {
          contadores[top.className] = (contadores[top.className] || 0) + 1;
          sorted.forEach(r => { if (r.className !== top.className) contadores[r.className] = 0; });

          if (contadores[top.className] >= FRAMES_CONF) {
            pausadoRef.current = true;
            setDeteccion({ clase: top.className, confianza: top.probability });
            setEstado('confirmado');
            setMensaje('¡Detectado!');
          }
        } else {
          contadorRef.current = {};
        }
      } catch (e) { console.error(e); }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, []);

  // ── Confirmar producto Teachable Machine ───────────────────────────────
  const confirmarProducto = useCallback(() => {
    if (!deteccion) return;
    const nombre = deteccion.clase.toLowerCase();
    const prod   = products?.find(p =>
      p.name?.toLowerCase().includes(nombre) || nombre.includes(p.name?.toLowerCase())
    );
    if (prod && typeof onAddToCart === 'function') {
      onAddToCart(prod);  // agrega al carrito
    } else {
      alert(`"${deteccion.clase}" no encontrado en inventario`);
    }
    detenerCamara();
    if (typeof onClose === 'function') onClose(); // cierra la cámara siempre
  }, [deteccion, products, onAddToCart, onClose]);

  // ── Google Cloud Vision ────────────────────────────────────────────────
  const buscarConGoogle = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setBuscandoG(true);
    setResultadoG(null);

    // Capturar frame del video
    const canvas  = canvasRef.current;
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    try {
      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64 },
              features: [
                { type: 'LABEL_DETECTION',   maxResults: 5 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 3 },
              ]
            }]
          })
        }
      );
      const data = await res.json();
      const labels   = data.responses?.[0]?.labelAnnotations   || [];
      const objects  = data.responses?.[0]?.localizedObjectAnnotations || [];
      const topLabel  = labels[0]?.description  || '';
      const topObject = objects[0]?.name        || '';
      const nombreDetectado = topObject || topLabel;

      if (nombreDetectado) {
        setResultadoG(nombreDetectado);
        setEstado('google');
        // Buscar en inventario
        const nombre = nombreDetectado.toLowerCase();
        const prod = products?.find(p =>
          p.name?.toLowerCase().includes(nombre) || nombre.includes(p.name?.toLowerCase())
        );
        if (prod) {
          setDeteccion({ clase: prod.name, confianza: 1, porGoogle: true });
        } else {
          setDeteccion({ clase: nombreDetectado, confianza: 1, porGoogle: true, noEnInventario: true });
        }
      } else {
        setMensaje('Google no reconoció el producto');
      }
    } catch (e) {
      console.error('Google Vision error:', e);
      setMensaje('Error conectando con Google Vision');
    } finally {
      setBuscandoG(false);
    }
  }, [products]);

  // ── Seguir buscando ────────────────────────────────────────────────────
  const seguirBuscando = () => {
    pausadoRef.current = false;
    contadorRef.current = {};
    setDeteccion(null);
    setResultadoG(null);
    setEstado('buscando');
    setMensaje('Apunta al producto');
  };

  // ── Confirmar Google ───────────────────────────────────────────────────
  const confirmarGoogle = useCallback(() => {
    if (!deteccion || deteccion.noEnInventario) return;
    const nombre = deteccion.clase.toLowerCase();
    const prod   = products?.find(p =>
      p.name?.toLowerCase().includes(nombre) || nombre.includes(p.name?.toLowerCase())
    );
    if (prod && typeof onAddToCart === 'function') onAddToCart(prod);
    detenerCamara();
    if (typeof onClose === 'function') onClose(); // siempre cierra
  }, [deteccion, products, onAddToCart, onClose]);

  // ── UI ─────────────────────────────────────────────────────────────────
  const confirmado = estado === 'confirmado' || (estado === 'google' && deteccion && !deteccion.noEnInventario);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 480, boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ background: '#1e3a5f', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Cámara IA</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Teachable Machine · Google Vision</div>
            </div>
          </div>
          <button onClick={cerrar} style={{ background: 'rgba(220,38,38,0.8)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            ✕ Cerrar
          </button>
        </div>

        {/* Video */}
        <div style={{ position: 'relative', background: '#000', aspectRatio: '4/3' }}>
          <video ref={videoRef} autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: confirmado ? 'brightness(0.55)' : 'none', transition: 'filter 0.3s' }}/>
          <canvas ref={canvasRef} style={{ display: 'none' }}/>

          {/* Marco */}
          <div style={{
            position: 'absolute', inset: '12%',
            border: `3px solid ${confirmado ? '#22c55e' : 'rgba(255,255,255,0.55)'}`,
            borderRadius: 14,
            boxShadow: confirmado ? '0 0 30px rgba(34,197,94,0.5)' : 'none',
            transition: 'all 0.3s', pointerEvents: 'none'
          }}/>

          {/* Overlay confirmado */}
          {confirmado && deteccion && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 52 }}>✅</div>
              <div style={{ background: 'rgba(21,128,61,0.95)', color: '#fff', borderRadius: 12, padding: '12px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{deteccion.clase}</div>
                {!deteccion.porGoogle && (
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                    {(deteccion.confianza * 100).toFixed(0)}% confianza
                  </div>
                )}
                {deteccion.porGoogle && (
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Identificado por Google Vision</div>
                )}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                Presiona <strong style={{ color: '#fff' }}>ENTER</strong> o el botón verde
              </div>
            </div>
          )}

          {/* No en inventario */}
          {estado === 'google' && deteccion?.noEnInventario && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div style={{ fontSize: 48 }}>⚠️</div>
              <div style={{ background: 'rgba(180,83,9,0.95)', color: '#fff', borderRadius: 12, padding: '12px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>"{resultadoG}"</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>No está en el inventario</div>
              </div>
            </div>
          )}

          {/* Mensaje buscando */}
          {!confirmado && estado !== 'google' && (
            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              {estado === 'cargando' && '⏳ Cargando modelo...'}
              {estado === 'buscando' && '🎯 ' + mensaje}
              {estado === 'error'    && '❌ ' + mensaje}
            </div>
          )}

          {/* Spinner Google */}
          {buscandoG && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Analizando con Google...</div>
            </div>
          )}
        </div>

        {/* Botones */}
        <div style={{ padding: 14 }}>
          {confirmado && deteccion && !deteccion.noEnInventario ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={seguirBuscando} style={{ flex: 1, padding: '11px 0', background: '#f3f4f6', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#374151' }}>
                🔄 Otro
              </button>
              <button onClick={deteccion.porGoogle ? confirmarGoogle : confirmarProducto} style={{ flex: 2, padding: '11px 0', background: '#16a34a', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                🛒 Agregar al carrito <span style={{ opacity: 0.65, fontSize: 12 }}>(Enter)</span>
              </button>
            </div>
          ) : estado === 'google' && deteccion?.noEnInventario ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={seguirBuscando} style={{ flex: 1, padding: '11px 0', background: '#f3f4f6', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#374151' }}>
                🔄 Buscar otro
              </button>
              <button onClick={cerrar} style={{ flex: 1, padding: '11px 0', background: '#dc2626', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#fff' }}>
                Cerrar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              {estado === 'error' ? (
                <button onClick={iniciarCamara} style={{ flex: 1, padding: '11px 0', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  🔄 Reintentar
                </button>
              ) : (
                <div style={{ flex: 1, textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Mantén el producto quieto en el marco
                </div>
              )}
              {GOOGLE_VISION_API_KEY !== 'TU_API_KEY_AQUI' && (
                <button onClick={buscarConGoogle} disabled={buscandoG || estado === 'cargando'} style={{ padding: '11px 14px', background: '#1a73e8', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, opacity: buscandoG ? 0.7 : 1 }}>
                  <img src="https://www.google.com/favicon.ico" alt="" width={14} height={14}/>
                  Google Vision
                </button>
              )}
            </div>
          )}
        </div>

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default CamaraIA;