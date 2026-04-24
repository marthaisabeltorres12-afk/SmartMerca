import React, { useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

const AdminPinSetup = () => {
  const { token, user } = useAuth();
  const [pin,     setPin]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg,     setMsg]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [show,    setShow]    = useState(false); // mostrar/ocultar PIN

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
      const res = await fetch('http://localhost:5000/api/pin/set', {
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

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft: 240 }}>
        <h4 className="fw-bold mb-1">🔒 Mi PIN de autorización</h4>
        <p className="text-muted mb-4">
          Hola, <strong>{user?.name}</strong>. Este PIN lo usarán los cajeros para pedir tu
          autorización cuando quieran eliminar un producto, reducir cantidad o aplicar
          un descuento en el punto de venta.
        </p>

        <div className="row g-4">
          {/* Formulario */}
          <div className="col-md-5">
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3"
                style={{ background:'#1e3a5f', color:'#fff', borderRadius:'8px 8px 0 0' }}>
                🔑 Configurar / Cambiar PIN
              </div>
              <div className="card-body">
                {msg && (
                  <div className={`alert alert-${msg.type} py-2 mb-3`}>{msg.text}</div>
                )}

                <form onSubmit={handleSet}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Nuevo PIN</label>
                    <div className="input-group">
                      <input
                        type={show ? 'text' : 'password'}
                        className="form-control form-control-lg text-center"
                        placeholder="• • • •"
                        maxLength={6}
                        value={pin}
                        onChange={e => { setPin(e.target.value.replace(/\D/g,'')); setMsg(null); }}
                        style={{ letterSpacing: 10, fontSize: 24 }}
                      />
                      <button type="button" className="btn btn-outline-secondary"
                        onClick={() => setShow(!show)}>
                        {show ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <div className="form-text">Solo números · 4 a 6 dígitos</div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold small">Confirmar PIN</label>
                    <input
                      type={show ? 'text' : 'password'}
                      className={`form-control form-control-lg text-center ${confirm && confirm !== pin ? 'is-invalid' : confirm && confirm === pin && confirm.length >= 4 ? 'is-valid' : ''}`}
                      placeholder="• • • •"
                      maxLength={6}
                      value={confirm}
                      onChange={e => { setConfirm(e.target.value.replace(/\D/g,'')); setMsg(null); }}
                      style={{ letterSpacing: 10, fontSize: 24 }}
                    />
                    {confirm && confirm !== pin && (
                      <div className="invalid-feedback">Los PINs no coinciden</div>
                    )}
                    {confirm && confirm === pin && confirm.length >= 4 && (
                      <div className="valid-feedback d-block">✅ PINs coinciden</div>
                    )}
                  </div>

                  <button type="submit" className="btn btn-dark w-100 fw-bold py-2"
                    disabled={loading || pin.length < 4 || pin !== confirm}>
                    {loading
                      ? <><span className="spinner-border spinner-border-sm me-2"/>Guardando...</>
                      : '🔒 Guardar PIN'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Instrucciones */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header fw-semibold py-3" style={{ background:'#f8fafc' }}>
                ℹ️ ¿Cómo funciona el PIN?
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">

                  <div className="d-flex gap-3 align-items-start">
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width:36, height:36, background:'#dbeafe', fontSize:16 }}>1</div>
                    <div>
                      <div className="fw-semibold">El cajero intenta modificar el carrito</div>
                      <div className="text-muted small">Al eliminar un producto, reducir cantidad o aplicar un descuento aparece el modal de autorización.</div>
                    </div>
                  </div>

                  <div className="d-flex gap-3 align-items-start">
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width:36, height:36, background:'#fef9c3', fontSize:16 }}>2</div>
                    <div>
                      <div className="fw-semibold">El admin ingresa su PIN en el mismo dispositivo</div>
                      <div className="text-muted small">El modal muestra qué acción se quiere realizar. El admin escribe su PIN de 4–6 dígitos y presiona Enter.</div>
                    </div>
                  </div>

                  <div className="d-flex gap-3 align-items-start">
                    <div className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width:36, height:36, background:'#dcfce7', fontSize:16 }}>3</div>
                    <div>
                      <div className="fw-semibold">Se autoriza y queda registrado</div>
                      <div className="text-muted small">La acción se ejecuta y en el historial de auditoría queda: quién lo solicitó, quién autorizó, qué se hizo y cuándo.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded mt-2" style={{ background:'#fff5f5', border:'1px solid #fca5a5', fontSize:12 }}>
                    <strong>⚠️ Importante:</strong><br/>
                    Guarda tu PIN en un lugar seguro. Si lo olvidas puedes configurar uno nuevo aquí.
                    Cada admin puede tener su propio PIN — el sistema acepta el PIN de cualquier admin activo.
                  </div>

                  <div className="p-3 rounded" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', fontSize:12 }}>
                    <strong>✅ Acciones que requieren PIN:</strong><br/>
                    • 🗑️ Eliminar un producto del carrito<br/>
                    • ⬇️ Reducir la cantidad de un producto<br/>
                    • 🏷️ Aplicar descuento manual a un ítem
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