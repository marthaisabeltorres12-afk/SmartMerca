import React, { useState, useRef, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Modal de autorización reutilizable.
 *
 * Uso simple (PIN o tarjeta):
 *   <AuthModal tipo="eliminar_producto" onAuthorized={(admin) => hacerAccion()} onCancel={() => cerrar()} />
 *
 * Uso reset de contraseña (PIN + tarjeta ambos):
 *   <AuthModal tipo="reset_password" targetEmail="user@x.com" newPassword="nueva123"
 *              onAuthorized={() => mostrarExito()} onCancel={() => cerrar()} />
 *
 * tipos: eliminar_producto | cancelar_venta | editar_precio | devolucion | descuento_manual | reset_password
 */
const AuthModal = ({ tipo = 'eliminar_producto', onAuthorized, onCancel, targetEmail, newPassword, detalle = '' }) => {
  const { token } = useAuth();

  const [pin,          setPin]          = useState('');
  const [tarjeta,      setTarjeta]      = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [escaneando,   setEscaneando]   = useState(false); // badge visual al detectar escaneo
  const [modoActivo,   setModoActivo]   = useState('tarjeta'); // 'tarjeta' | 'pin' — tarjeta primero

  const pinRef     = useRef();
  const tarjetaRef = useRef();

  const esDobleFacto = tipo === 'reset_password';

  const LABELS = {
    eliminar_producto: { titulo:'🗑️ Eliminar producto',      sub:'Escanea la tarjeta o ingresa PIN del administrador' },
    cancelar_venta:    { titulo:'❌ Cancelar venta',          sub:'Escanea la tarjeta o ingresa PIN del administrador' },
    editar_precio:     { titulo:'✏️ Editar precio',           sub:'Escanea la tarjeta o ingresa PIN del administrador' },
    devolucion:        { titulo:'↩️ Devolución',              sub:'Escanea la tarjeta o ingresa PIN del administrador' },
    descuento_manual:  { titulo:'🏷️ Descuento manual',        sub:'Escanea la tarjeta o ingresa PIN del administrador' },
    reset_password:    { titulo:'🔐 Restablecer contraseña',  sub:'⚠️ Requiere tarjeta Y PIN (doble factor)' },
  };
  const label = LABELS[tipo] || { titulo:'🔐 Autorización', sub:'Requiere autorización del administrador' };

  // Al abrir: enfocar campo tarjeta por defecto (lector USB actúa como teclado)
  useEffect(() => {
    tarjetaRef.current?.focus();
  }, []);

  // ── Captura automática del lector de código de barras ─────────────────
  // El lector USB envía los caracteres muy rápido y termina con Enter
  useEffect(() => {
    let buf = '';
    let timer;

    const onKey = (e) => {
      // Si el foco está en un input de texto, no interceptar
      const tag = document.activeElement?.tagName;
      const isTextInput = (tag === 'INPUT' || tag === 'TEXTAREA');

      if (e.key === 'Enter') {
        if (buf.length > 4) {
          // Parece un escaneo completo
          const code = buf.trim().toUpperCase();
          if (code.startsWith('ADMIN-') || code.length >= 8) {
            setTarjeta(code);
            setModoActivo('tarjeta');
            setEscaneando(true);
            setTimeout(() => setEscaneando(false), 1500);
            // Auto-submit si ya hay pin en modo doble factor o en modo simple
            if (!esDobleFacto) {
              // Modo simple: tarjeta sola alcanza → submit automático
              setTimeout(() => handleSubmitAuto(null, code), 200);
            }
          }
        }
        buf = '';
        clearTimeout(timer);
        return;
      }

      // Solo capturar si no está en input activo (evitar interferir con escritura manual)
      if (!isTextInput) {
        buf += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buf = ''; }, 200);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, [esDobleFacto, pin]);

  // ── Submit automático cuando se escanea (sin click) ───────────────────
  const handleSubmitAuto = useCallback(async (pinVal, tarjetaVal) => {
    const p = pinVal ?? pin;
    const t = tarjetaVal ?? tarjeta;

    setError('');
    setLoading(true);
    try {
      let endpoint = '/auth-admin/autorizar';
      let body = { pin: p || null, codigo_tarjeta: t || null, tipo_operacion: tipo };

      if (esDobleFacto && targetEmail) {
        endpoint = '/auth-admin/reset-seguro';
        body = { pin: p, codigo_tarjeta: t, username: targetEmail, password: newPassword };
      }

      const data = await apiFetch(endpoint, { method:'POST', body: JSON.stringify(body) }, token);
      if (data.autorizado !== false) {
        onAuthorized(data.admin_nombre || data.message || 'Admin');
      } else {
        setError(data.message || 'Autorización denegada');
        tarjetaRef.current?.focus();
      }
    } catch (err) {
      setError(err.message || 'Error de autorización');
    } finally {
      setLoading(false);
    }
  }, [pin, tarjeta, tipo, esDobleFacto, targetEmail, newPassword, token, onAuthorized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!pin && !tarjeta) { setError('Escanea la tarjeta o ingresa el PIN'); return; }
    if (esDobleFacto && (!pin || !tarjeta)) {
      setError('Esta acción requiere AMBOS: tarjeta y PIN'); return;
    }
    await handleSubmitAuto(pin, tarjeta);
  };

  // ── Estilos ───────────────────────────────────────────────────────────
  const inp = (activo) => ({
    background:   activo ? '#0f2a4a' : '#0f172a',
    border:       `2px solid ${activo ? '#3b82f6' : '#334155'}`,
    borderRadius: 8,
    padding:      '10px 12px',
    color:        '#fff',
    fontSize:     15,
    width:        '100%',
    outline:      'none',
    boxSizing:    'border-box',
    transition:   'border-color 0.2s',
  });

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999 }}>
      <div style={{ background:'#1e293b', borderRadius:16, padding:28, width:360,
        border:'1px solid #334155', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🔐</div>
          <div style={{ color:'#f1f5f9', fontWeight:700, fontSize:18 }}>{label.titulo}</div>
          <div style={{ color:'#64748b', fontSize:13, marginTop:4 }}>{label.sub}</div>
          {detalle && (
            <div style={{ background:'#0f2a4a', border:'1px solid #1d4ed8', borderRadius:8,
              padding:'6px 10px', color:'#93c5fd', fontSize:12, marginTop:10 }}>
              {detalle}
            </div>
          )}
        </div>

        {error && (
          <div style={{ background:'#450a0a', border:'1px solid #dc2626', borderRadius:8,
            padding:'8px 12px', color:'#fca5a5', fontSize:13, marginBottom:14 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* ── TARJETA — PRIMERO Y PRINCIPAL ── */}
          <div style={{ marginBottom:16 }}>
            <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block',
              marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>
              {esDobleFacto ? '1️⃣ Tarjeta de autorización *' : '💳 Tarjeta de autorización'}
            </label>

            {/* Zona de escaneo visual */}
            <div style={{ position:'relative' }}>
              <input
                ref={tarjetaRef}
                type="text"
                placeholder="📷 Escanear con lector o escribir ADMIN-XXXXXX"
                value={tarjeta}
                onChange={e => setTarjeta(e.target.value.toUpperCase())}
                onFocus={() => setModoActivo('tarjeta')}
                style={{
                  ...inp(modoActivo === 'tarjeta'),
                  fontFamily: 'monospace',
                  fontSize:   13,
                  paddingRight: 40,
                }}
              />
              {/* Ícono de escaneo */}
              <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                fontSize:18, opacity: tarjeta ? 1 : 0.4 }}>
                {escaneando ? '✅' : tarjeta ? '💳' : '📷'}
              </div>
            </div>

            {/* Badge de escaneo exitoso */}
            {escaneando && (
              <div style={{ background:'#052e16', border:'1px solid #16a34a', borderRadius:6,
                padding:'4px 10px', color:'#4ade80', fontSize:12, marginTop:6, textAlign:'center' }}>
                ✅ Tarjeta detectada: {tarjeta}
              </div>
            )}

            {tarjeta && !escaneando && (
              <div style={{ color:'#4ade80', fontSize:11, marginTop:4 }}>
                ✅ {tarjeta}
              </div>
            )}

            <div style={{ color:'#475569', fontSize:11, marginTop:4 }}>
              💡 El lector USB funciona automáticamente — solo apunta y escanea
            </div>
          </div>

          {/* Separador */}
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 0', color:'#475569', fontSize:12 }}>
            <div style={{ flex:1, height:1, background:'#334155' }} />
            {esDobleFacto ? 'Y TAMBIÉN' : 'O'}
            <div style={{ flex:1, height:1, background:'#334155' }} />
          </div>

          {/* ── PIN ── */}
          <div style={{ marginBottom:20 }}>
            <label style={{ color:'#94a3b8', fontSize:11, fontWeight:700, display:'block',
              marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>
              {esDobleFacto ? '2️⃣ PIN del administrador *' : '🔢 PIN del administrador'}
            </label>
            <input
              ref={pinRef}
              type="password"
              placeholder="••••••"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              onFocus={() => setModoActivo('pin')}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
              style={{
                ...inp(modoActivo === 'pin'),
                letterSpacing: 6,
                textAlign:     'center',
                fontSize:      24,
              }}
            />
          </div>

          {/* Botones */}
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={onCancel}
              style={{ flex:1, background:'none', border:'1px solid #334155', borderRadius:8,
                color:'#94a3b8', padding:'11px', cursor:'pointer', fontSize:14 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ flex:2, background: loading ? '#1d4ed8' : '#2563eb',
                border:'none', borderRadius:8, color:'#fff', padding:'11px',
                cursor: loading ? 'wait' : 'pointer', fontSize:14, fontWeight:700,
                transition:'background 0.2s' }}>
              {loading ? '⏳ Verificando...' : '✅ Autorizar'}
            </button>
          </div>

          {/* Hint modo simple */}
          {!esDobleFacto && (
            <div style={{ textAlign:'center', color:'#475569', fontSize:11, marginTop:12 }}>
              Con tarjeta se autoriza automáticamente al escanear
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthModal;