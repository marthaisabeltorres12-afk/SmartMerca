import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

const API = 'http://localhost:5000/api/policy/';

const BusinessPolicy = () => {
  const { token } = useAuth();
  const [form,    setForm]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState(null);

  useEffect(() => {
    fetch(API, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setForm(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Error al guardar');
      const updated = await res.json();
      setForm(updated);
      setMsg({ type: 'success', text: '✅ Políticas guardadas correctamente' });
    } catch (e) {
      setMsg({ type: 'danger', text: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  if (loading || form === null) return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft: 240, padding: 32 }}>
        <div className="d-flex align-items-center gap-2 text-muted">
          <div className="spinner-border spinner-border-sm"></div> Cargando políticas...
        </div>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main style={{ marginLeft: 240, padding: 28, background: '#f8fafc', minHeight: '100vh', width: '100%' }}>

        <div className="mb-4">
          <h4 className="fw-bold mb-0">📋 Políticas del Negocio</h4>
          <small className="text-muted">Configura las reglas de devoluciones, alertas e información del negocio</small>
        </div>

        {msg && (
          <div className={`alert alert-${msg.type} d-flex align-items-center gap-2 mb-4`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="row g-4">

            {/* ── Devoluciones ── */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header border-0 bg-white fw-bold pt-3">
                  ↩️ Política de Devoluciones
                </div>
                <div className="card-body">

                  <div className="mb-4">
                    <label className="form-label fw-semibold">Tipo de devolución permitida</label>
                    <div className="d-flex flex-column gap-2 mt-1">
                      {[
                        { val: 'ambos',  label: '✅ Dinero en efectivo O cambio por otro producto', desc: 'El cajero puede elegir según el caso' },
                        { val: 'dinero', label: '💵 Solo devolución en dinero',                     desc: 'El cliente siempre recibe dinero en efectivo' },
                        { val: 'cambio', label: '🔄 Solo cambio por otro producto',                  desc: 'No se devuelve dinero, solo se cambia el producto' },
                      ].map(opt => (
                        <label key={opt.val}
                          className="d-flex align-items-start gap-3 p-3 rounded cursor-pointer"
                          style={{ border: `2px solid ${form.return_mode === opt.val ? '#3b82f6' : '#e2e8f0'}`, background: form.return_mode === opt.val ? '#eff6ff' : '#fff', cursor: 'pointer', borderRadius: 10 }}>
                          <input type="radio" name="return_mode" value={opt.val}
                            checked={form.return_mode === opt.val}
                            onChange={() => set('return_mode', opt.val)}
                            style={{ marginTop: 3, accentColor: '#3b82f6' }} />
                          <div>
                            <div className="fw-semibold" style={{ fontSize: 14 }}>{opt.label}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-semibold">Motivo de devolución</label>
                    <div className="d-flex flex-column gap-2 mt-1">
                      {[
                        { val: true,  label: '🔒 Obligatorio',  desc: 'El cajero debe escribir el motivo antes de procesar' },
                        { val: false, label: '📝 Opcional',     desc: 'El motivo es opcional, puede dejarse en blanco' },
                      ].map(opt => (
                        <label key={String(opt.val)}
                          className="d-flex align-items-start gap-3 p-3 rounded"
                          style={{ border: `2px solid ${form.return_reason_required === opt.val ? '#3b82f6' : '#e2e8f0'}`, background: form.return_reason_required === opt.val ? '#eff6ff' : '#fff', cursor: 'pointer', borderRadius: 10 }}>
                          <input type="radio" name="return_reason_required" value={String(opt.val)}
                            checked={form.return_reason_required === opt.val}
                            onChange={() => set('return_reason_required', opt.val)}
                            style={{ marginTop: 3, accentColor: '#3b82f6' }} />
                          <div>
                            <div className="fw-semibold" style={{ fontSize: 14 }}>{opt.label}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold">Días máximos para aceptar devolución</label>
                    <div className="input-group" style={{ maxWidth: 200 }}>
                      <input type="number" className="form-control" min={1} max={365}
                        value={form.return_max_days}
                        onChange={e => set('return_max_days', parseInt(e.target.value) || 1)} />
                      <span className="input-group-text">días</span>
                    </div>
                    <div className="form-text">Ventas más antiguas que esto no se podrán devolver.</div>
                  </div>

                </div>
              </div>
            </div>

            {/* ── Alertas de inventario + Info negocio ── */}
            <div className="col-lg-6 d-flex flex-column gap-4">

              <div className="card border-0 shadow-sm">
                <div className="card-header border-0 bg-white fw-bold pt-3">
                  ⚠️ Umbrales de Alertas
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Stock mínimo para alerta</label>
                    <div className="input-group" style={{ maxWidth: 200 }}>
                      <input type="number" className="form-control" min={1}
                        value={form.low_stock_threshold}
                        onChange={e => set('low_stock_threshold', parseInt(e.target.value) || 1)} />
                      <span className="input-group-text">unidades</span>
                    </div>
                    <div className="form-text">Se notificará cuando el stock sea ≤ este valor.</div>
                  </div>
                  <div className="mb-1">
                    <label className="form-label fw-semibold">Días de anticipación para alertas de vencimiento</label>
                    <div className="input-group" style={{ maxWidth: 200 }}>
                      <input type="number" className="form-control" min={1}
                        value={form.expiry_alert_days}
                        onChange={e => set('expiry_alert_days', parseInt(e.target.value) || 1)} />
                      <span className="input-group-text">días</span>
                    </div>
                    <div className="form-text">Se notificará cuando falten ≤ estos días para el vencimiento.</div>
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm">
                <div className="card-header border-0 bg-white fw-bold pt-3">
                  🏪 Información del Negocio
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Nombre del negocio</label>
                    <input className="form-control" value={form.business_name || ''}
                      onChange={e => set('business_name', e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">NIT</label>
                    <input className="form-control" value={form.business_nit || ''}
                      placeholder="Ej: 900.123.456-7"
                      onChange={e => set('business_nit', e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Teléfono</label>
                    <input className="form-control" value={form.business_phone || ''}
                      onChange={e => set('business_phone', e.target.value)} />
                  </div>
                  <div className="mb-1">
                    <label className="form-label fw-semibold">Dirección</label>
                    <textarea className="form-control" rows={2} value={form.business_address || ''}
                      onChange={e => set('business_address', e.target.value)} />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Botón guardar */}
          <div className="mt-4 d-flex justify-content-end">
            <button type="submit" className="btn btn-primary px-4 fw-bold" disabled={saving}>
              {saving
                ? <><span className="spinner-border spinner-border-sm me-2"></span>Guardando...</>
                : <><i className="bi bi-check-lg me-2"></i>Guardar Políticas</>}
            </button>
          </div>
        </form>

      </main>
    </div>
  );
};

export default BusinessPolicy;