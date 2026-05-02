import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

// Cargar JsBarcode dinámicamente
const loadJsBarcode = () => new Promise((res) => {
  if (window.JsBarcode) { res(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
  s.onload = res;
  document.head.appendChild(s);
});

const AdminPinSetup = () => {
  const { token, user } = useAuth();
  const barcodeRef = useRef();

  // PIN
  const [pin,     setPin]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg,     setMsg]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [show,    setShow]    = useState(false);

  // Tarjeta
  const [tarjeta,        setTarjeta]        = useState(null);
  const [loadingTarjeta, setLoadingTarjeta] = useState(false);
  const [msgTarjeta,     setMsgTarjeta]     = useState(null);
  const [loadingCard,    setLoadingCard]     = useState(true);

  // Cargar tarjeta existente
  useEffect(() => {
    apiFetch('/auth-admin/tarjeta', {}, token)
      .then(data => { setTarjeta(data.card); setLoadingCard(false); })
      .catch(() => setLoadingCard(false));
  }, [token]);

  // Renderizar código de barras cuando cambia la tarjeta
  useEffect(() => {
    if (!tarjeta?.code) return;
    loadJsBarcode().then(() => {
      if (barcodeRef.current && window.JsBarcode) {
        window.JsBarcode(barcodeRef.current, tarjeta.code, {
          format: 'CODE128', width: 2, height: 60,
          displayValue: true, fontSize: 14, margin: 10,
          background: '#ffffff', lineColor: '#000000',
        });
      }
    });
  }, [tarjeta]);

  // Guardar PIN
  const handleSet = async (e) => {
    e.preventDefault();
    if (!pin.match(/^\d{4,6}$/)) {
      setMsg({ type:'danger', text:'El PIN debe tener entre 4 y 6 dígitos numéricos' }); return;
    }
    if (pin !== confirm) {
      setMsg({ type:'danger', text:'Los PINs no coinciden' }); return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/pin/set', {
        method:  'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMsg({ type:'success', text:'✅ PIN configurado correctamente' });
      setPin(''); setConfirm('');
    } catch(e) {
      setMsg({ type:'danger', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Generar tarjeta nueva
  const handleGenerarTarjeta = async () => {
    if (!window.confirm('¿Generar nueva tarjeta? La tarjeta anterior quedará inválida.')) return;
    setLoadingTarjeta(true);
    setMsgTarjeta(null);
    try {
      const data = await apiFetch('/auth-admin/tarjeta', { method: 'POST' }, token);
      setTarjeta(data.card);
      setMsgTarjeta({ type:'success', text:'✅ Tarjeta generada correctamente' });
    } catch(e) {
      setMsgTarjeta({ type:'danger', text: e.message });
    } finally {
      setLoadingTarjeta(false);
    }
  };

  // Revocar tarjeta
  const handleRevocar = async () => {
    if (!window.confirm('¿Revocar la tarjeta? Ya no podrá usarse para autorizar.')) return;
    try {
      await apiFetch('/auth-admin/tarjeta/revocar', { method: 'POST' }, token);
      setTarjeta(null);
      setMsgTarjeta({ type:'warning', text:'⚠️ Tarjeta revocada' });
    } catch(e) {
      setMsgTarjeta({ type:'danger', text: e.message });
    }
  };

  // Imprimir tarjeta
  const handleImprimir = () => {
    const w = window.open('', '_blank', 'width=400,height=300');
    w.document.write(`
      <html><head><title>Tarjeta Admin</title>
      <style>
        body { font-family: Arial; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f8f8f8; }
        .card { background:#fff; border:2px solid #1e3a5f; border-radius:12px; padding:20px; text-align:center; width:300px; box-shadow:0 4px 12px rgba(0,0,0,0.15); }
        .logo { font-size:24px; font-weight:800; color:#1e3a5f; margin-bottom:4px; }
        .sub { font-size:12px; color:#666; margin-bottom:12px; }
        .nombre { font-size:14px; font-weight:600; color:#333; margin-bottom:8px; }
        .code { font-family:monospace; font-size:13px; color:#1e3a5f; font-weight:700; margin-top:8px; }
        .instruccion { font-size:10px; color:#888; margin-top:8px; border-top:1px solid #eee; padding-top:8px; }
      </style></head>
      <body><div class="card">
        <div class="logo">🛒 SmartMerca</div>
        <div class="sub">Tarjeta de Autorización Admin</div>
        <div class="nombre">${user?.name || 'Administrador'}</div>
        <svg id="bc"></svg>
        <div class="code">${tarjeta?.code}</div>
        <div class="instruccion">Escanear para autorizar acciones en el POS</div>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      <script>
        window.onload = function() {
          JsBarcode("#bc", "${tarjeta?.code}", {format:"CODE128",width:2,height:50,displayValue:false,margin:5});
          setTimeout(function(){ window.print(); window.close(); }, 500);
        }
      </script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240, background:'#f8fafc', minHeight:'100vh' }}>
        <h4 className="fw-bold mb-1">🔒 Mi PIN de autorización</h4>
        <p className="text-muted mb-4">
          Hola, <strong>{user?.name}</strong>. Este PIN lo usarán los cajeros para pedir tu
          autorización cuando quieran eliminar un producto, reducir cantidad o aplicar
          un descuento en el punto de venta.
        </p>

        <div className="row g-4">

          {/* ── Formulario PIN ── */}
          <div className="col-md-5">
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header fw-semibold py-3"
                style={{ background:'#1e3a5f', color:'#fff', borderRadius:'8px 8px 0 0' }}>
                🔑 Configurar / Cambiar PIN
              </div>
              <div className="card-body">
                {msg && <div className={`alert alert-${msg.type} py-2 mb-3`}>{msg.text}</div>}
                <form onSubmit={handleSet}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Nuevo PIN</label>
                    <div className="input-group">
                      <input type={show?'text':'password'} className="form-control form-control-lg text-center"
                        placeholder="• • • •" maxLength={6} value={pin}
                        onChange={e=>{ setPin(e.target.value.replace(/\D/g,'')); setMsg(null); }}
                        style={{ letterSpacing:10, fontSize:24 }}/>
                      <button type="button" className="btn btn-outline-secondary" onClick={()=>setShow(!show)}>
                        {show?'🙈':'👁️'}
                      </button>
                    </div>
                    <div className="form-text">Solo números · 4 a 6 dígitos</div>
                  </div>
                  <div className="mb-4">
                    <label className="form-label fw-semibold small">Confirmar PIN</label>
                    <input type={show?'text':'password'}
                      className={`form-control form-control-lg text-center ${confirm && confirm!==pin?'is-invalid':confirm&&confirm===pin&&confirm.length>=4?'is-valid':''}`}
                      placeholder="• • • •" maxLength={6} value={confirm}
                      onChange={e=>{ setConfirm(e.target.value.replace(/\D/g,'')); setMsg(null); }}
                      style={{ letterSpacing:10, fontSize:24 }}/>
                    {confirm && confirm!==pin && <div className="invalid-feedback">Los PINs no coinciden</div>}
                    {confirm && confirm===pin && confirm.length>=4 && <div className="valid-feedback d-block">✅ PINs coinciden</div>}
                  </div>
                  <button type="submit" className="btn btn-dark w-100 fw-bold py-2"
                    disabled={loading||pin.length<4||pin!==confirm}>
                    {loading?<><span className="spinner-border spinner-border-sm me-2"/>Guardando...</>:'🔒 Guardar PIN'}
                  </button>
                </form>
              </div>
            </div>

            {/* ── Tarjeta de código de barras ── */}
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3"
                style={{ background:'#1e3a5f', color:'#fff', borderRadius:'8px 8px 0 0' }}>
                💳 Tarjeta de autorización
              </div>
              <div className="card-body">
                <p className="text-muted small mb-3">
                  Genera un código de barras único. El cajero escanea la tarjeta con el lector
                  para autorizar acciones sin escribir el PIN.
                </p>

                {msgTarjeta && (
                  <div className={`alert alert-${msgTarjeta.type} py-2 mb-3 small`}>{msgTarjeta.text}</div>
                )}

                {loadingCard ? (
                  <div className="text-center py-3"><span className="spinner-border spinner-border-sm"/></div>
                ) : tarjeta ? (
                  <>
                    {/* Vista previa de la tarjeta */}
                    <div className="p-3 rounded mb-3 text-center"
                      style={{ background:'#f8fafc', border:'2px solid #1e3a5f' }}>
                      <div className="fw-bold text-muted small mb-2">🛒 SmartMerca — Autorización Admin</div>
                      <div className="fw-bold mb-1">{user?.name}</div>
                      <svg ref={barcodeRef} style={{maxWidth:'100%'}}></svg>
                      <div className="text-muted" style={{fontSize:11, fontFamily:'monospace', marginTop:4}}>
                        {tarjeta.code}
                      </div>
                    </div>

                    <div className="text-muted small mb-3">
                      <span className="badge bg-success me-2">✅ Activa</span>
                      Creada: {tarjeta.created_at?.slice(0,10)}
                    </div>

                    <div className="d-flex gap-2">
                      <button className="btn btn-primary fw-bold flex-fill" onClick={handleImprimir}>
                        🖨️ Imprimir tarjeta
                      </button>
                      <button className="btn btn-outline-warning" onClick={handleGenerarTarjeta}
                        disabled={loadingTarjeta} title="Generar nueva tarjeta">
                        🔄
                      </button>
                      <button className="btn btn-outline-danger" onClick={handleRevocar}
                        title="Revocar tarjeta">
                        🗑️
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center py-3 text-muted">
                      <div style={{fontSize:40}}>💳</div>
                      <div className="small mt-2">No tienes tarjeta activa</div>
                    </div>
                    <button className="btn btn-primary fw-bold w-100"
                      onClick={handleGenerarTarjeta} disabled={loadingTarjeta}>
                      {loadingTarjeta
                        ? <><span className="spinner-border spinner-border-sm me-2"/>Generando...</>
                        : '💳 Generar tarjeta de autorización'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Instrucciones ── */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3" style={{ background:'#f8fafc' }}>
                ℹ️ ¿Cómo funciona el PIN?
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">
                  {[
                    ['#dbeafe', '1', 'El cajero intenta modificar el carrito',
                      'Al eliminar un producto, reducir cantidad o aplicar un descuento aparece el modal de autorización.'],
                    ['#fef9c3', '2', 'El admin ingresa su PIN en el mismo dispositivo',
                      'El modal muestra qué acción se quiere realizar. El admin escribe su PIN de 4–6 dígitos y presiona Enter.'],
                    ['#dcfce7', '3', 'Se autoriza y queda registrado',
                      'La acción se ejecuta y en el historial de auditoría queda: quién lo solicitó, quién autorizó, qué se hizo y cuándo.'],
                  ].map(([bg, n, titulo, sub]) => (
                    <div key={n} className="d-flex gap-3 align-items-start">
                      <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{ width:36, height:36, background:bg, fontSize:16 }}>{n}</div>
                      <div>
                        <div className="fw-semibold">{titulo}</div>
                        <div className="text-muted small">{sub}</div>
                      </div>
                    </div>
                  ))}

                  <div className="p-3 rounded mt-1" style={{ background:'#fff5f5', border:'1px solid #fca5a5', fontSize:12 }}>
                    <strong>⚠️ Importante:</strong><br/>
                    Guarda tu PIN en un lugar seguro. Si lo olvidas puedes configurar uno nuevo aquí.
                    Cada admin puede tener su propio PIN — el sistema acepta el PIN de cualquier admin activo.
                  </div>

                  <div className="p-3 rounded" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:12 }}>
                    <strong>✅ Acciones que requieren PIN o tarjeta:</strong><br/>
                    • 🗑️ Eliminar un producto del carrito<br/>
                    • ⬇️ Reducir la cantidad de un producto<br/>
                    • 🏷️ Aplicar descuento manual a un ítem<br/>
                    • ❌ Cancelar una venta completa<br/>
                    • ✏️ Editar precio en el POS
                  </div>

                  <div className="p-3 rounded" style={{ background:'#eff6ff', border:'1px solid #bfdbfe', fontSize:12 }}>
                    <strong>💳 Tarjeta de autorización:</strong><br/>
                    Alternativa al PIN — el cajero escanea la tarjeta con el lector de código de barras.
                    Para <strong>restablecer contraseñas</strong> se requieren <strong>ambos</strong>: PIN + tarjeta.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminPinSetup;