import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const WhatsAppConfig = () => {
  const { token } = useAuth();
  const [config,    setConfig]    = useState(null);
  const [telefono,  setTelefono]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState(null);

  useEffect(() => {
    apiFetch('/whatsapp/config', {}, token)
      .then(setConfig).catch(() => {});
  }, [token]);

  const handleTest = async () => {
    if (!telefono) { setMsg({ type:'danger', text:'Ingresa un número' }); return; }
    setLoading(true);
    try {
      const res = await apiFetch('/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ telefono })
      }, token);
      setMsg({ type:'success', text:res.message });
    } catch(e) {
      setMsg({ type:'danger', text: e.message });
    } finally { setLoading(false); }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header fw-semibold py-3" style={{ background:'#25D366', color:'#fff' }}>
        💬 WhatsApp Business API
      </div>
      <div className="card-body">
        {/* Estado */}
        <div className={`alert py-2 mb-3 ${config?.configured ? 'alert-success' : 'alert-warning'}`}>
          {config?.configured
            ? '✅ WhatsApp configurado — los tickets se enviarán automáticamente'
            : '⚠️ WhatsApp no configurado — agrega las variables de entorno'}
        </div>

        {!config?.configured && (
          <div className="mb-4 p-3 rounded" style={{ background:'#f8fafc', border:'1px solid #e2e8f0' }}>
            <div className="fw-bold mb-2 small">📋 Cómo configurar:</div>
            <ol className="small text-muted mb-0">
              <li>Ve a <a href="https://developers.facebook.com" target="_blank" rel="noreferrer">developers.facebook.com</a></li>
              <li>Crea una app → WhatsApp → Business</li>
              <li>Obtén el Token de acceso permanente</li>
              <li>Obtén el Phone Number ID</li>
              <li>Agrega en Railway/variables de entorno:</li>
            </ol>
            <div className="mt-2 p-2 rounded" style={{ background:'#1e293b', color:'#4ade80', fontFamily:'monospace', fontSize:12 }}>
              WHATSAPP_TOKEN=EAAxxxxxx...<br/>
              WHATSAPP_PHONE_ID=1234567890<br/>
              WHATSAPP_ENABLED=true
            </div>
          </div>
        )}

        {/* Prueba */}
        <div className="mb-3">
          <label className="form-label fw-semibold small">Número de prueba (con código de país)</label>
          <div className="input-group">
            <span className="input-group-text">📱</span>
            <input type="text" className="form-control" placeholder="3001234567 o 573001234567"
              value={telefono} onChange={e => setTelefono(e.target.value)} />
            <button className="btn fw-bold" style={{ background:'#25D366', color:'#fff' }}
              onClick={handleTest} disabled={loading || !config?.configured}>
              {loading ? 'Enviando...' : '📨 Enviar prueba'}
            </button>
          </div>
        </div>

        {msg && <div className={`alert alert-${msg.type} py-2 small`}>{msg.text}</div>}

        {/* Funciones */}
        <div className="mt-3">
          <div className="fw-semibold small mb-2">✅ Qué hace automáticamente:</div>
          <div className="d-flex flex-column gap-1">
            {[
              ['🧾', 'Ticket de venta al cliente después de cada compra'],
              ['⚠️', 'Alerta de stock bajo al administrador'],
              ['📦', 'Notificación cuando llega un pedido de proveedor'],
            ].map(([icon, text]) => (
              <div key={text} className="d-flex gap-2 align-items-center p-2 rounded" style={{ background:'#f0fdf4', fontSize:13 }}>
                <span>{icon}</span><span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfig;