import React, { useEffect, useState, useCallback, useRef } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt    = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtNum = n => Number(n||0).toLocaleString('es-CO');

const KpiCard = ({ icon, label, value, sub, subColor }) => (
  <div className="card border-0 shadow-sm h-100">
    <div className="card-body py-3 px-3">
      <div className="d-flex align-items-center gap-2 mb-1">
        <span style={{ fontSize:22 }}>{icon}</span>
        <span className="text-muted small">{label}</span>
      </div>
      <div className="fw-bold" style={{ fontSize:22 }}>{value}</div>
      {sub && <div className={`small mt-1 fw-semibold ${subColor || 'text-muted'}`}>{sub}</div>}
    </div>
  </div>
);

// ── Componente de Reportes por Voz ────────────────────────────────────────
const VoiceReports = ({ data }) => {
  const [escuchando,  setEscuchando]  = useState(false);
  const [respuesta,   setRespuesta]   = useState('');
  const [comando,     setComando]     = useState('');
  const [soportado,   setSoportado]   = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setSoportado(false);
    }
  }, []);

  const hablar = useCallback((texto) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang  = 'es-CO';
    utterance.rate  = 0.95;
    utterance.pitch = 1;
    // Buscar voz en español
    const voces = window.speechSynthesis.getVoices();
    const vozEs = voces.find(v => v.lang.startsWith('es')) || voces[0];
    if (vozEs) utterance.voice = vozEs;
    window.speechSynthesis.speak(utterance);
    setRespuesta(texto);
  }, []);

  const procesarComando = useCallback((texto) => {
    const t = texto.toLowerCase().trim();
    setComando(texto);

    if (!data) { hablar('No hay datos disponibles en este momento.'); return; }

    const ventas    = data.ventas_hoy || 0;
    const trans     = data.transacciones || 0;
    const ticket    = data.ticket_promedio || 0;
    const variacion = data.variacion_pct || 0;
    const cajero    = data.cajero_top?.nombre || 'ninguno';
    const alertas   = data.alertas || {};
    const top5      = data.top_productos || [];

    // ── Ventas ────────────────────────────────────────────────────────
    if (t.includes('venta') || t.includes('cuanto') || t.includes('ingreso') || t.includes('total')) {
      const resp = `Las ventas de hoy son ${fmt(ventas)}, con ${trans} transacciones y un ticket promedio de ${fmt(ticket)}. ${variacion >= 0 ? `Estás ${Math.abs(variacion)} por ciento arriba de ayer.` : `Estás ${Math.abs(variacion)} por ciento abajo de ayer.`}`;
      hablar(resp);

    // ── Cajero top ────────────────────────────────────────────────────
    } else if (t.includes('cajero') || t.includes('vendedor') || t.includes('mejor')) {
      const resp = cajero !== 'ninguno'
        ? `El cajero top de hoy es ${cajero} con ventas de ${fmt(data.cajero_top?.total || 0)}.`
        : 'Aún no hay ventas registradas hoy.';
      hablar(resp);

    // ── Alertas ───────────────────────────────────────────────────────
    } else if (t.includes('alerta') || t.includes('problema') || t.includes('stock') || t.includes('inventario')) {
      const partes = [];
      if (alertas.stock_cero > 0)   partes.push(`${alertas.stock_cero} productos agotados`);
      if (alertas.stock_bajo > 0)   partes.push(`${alertas.stock_bajo} con stock bajo`);
      if (alertas.vencimientos > 0) partes.push(`${alertas.vencimientos} próximos a vencer`);
      if (alertas.turno_largo > 0)  partes.push(`${alertas.turno_largo} turnos muy largos`);
      const resp = partes.length > 0
        ? `Hay ${alertas.total} alertas: ${partes.join(', ')}.`
        : 'Todo está en orden, sin alertas activas.';
      hablar(resp);

    // ── Top productos ─────────────────────────────────────────────────
    } else if (t.includes('producto') || t.includes('top') || t.includes('popular')) {
      if (!top5.length) { hablar('No hay productos vendidos hoy todavía.'); return; }
      const nombres = top5.slice(0,3).map((p,i) => `${i+1}: ${p.nombre}`).join(', ');
      hablar(`Los productos más vendidos hoy son: ${nombres}.`);

    // ── Comparación con ayer ──────────────────────────────────────────
    } else if (t.includes('ayer') || t.includes('comparacion') || t.includes('diferencia')) {
      const resp = `Ayer vendiste ${fmt(data.total_ayer || 0)}. Hoy llevas ${fmt(ventas)}. ${variacion >= 0 ? `Vas ${Math.abs(variacion)} por ciento mejor.` : `Vas ${Math.abs(variacion)} por ciento peor.`}`;
      hablar(resp);

    // ── Resumen general ───────────────────────────────────────────────
    } else if (t.includes('resumen') || t.includes('como') || t.includes('hoy')) {
      const resp = `Resumen del día: ventas por ${fmt(ventas)}, ${trans} transacciones, ticket promedio ${fmt(ticket)}. ${alertas.total > 0 ? `Hay ${alertas.total} alertas activas.` : 'Sin alertas.'} El cajero top es ${cajero}.`;
      hablar(resp);

    // ── Ayuda ─────────────────────────────────────────────────────────
    } else if (t.includes('ayuda') || t.includes('que puedo') || t.includes('comando')) {
      hablar('Puedes preguntarme: ventas de hoy, cajero top, alertas de stock, productos más vendidos, comparación con ayer, o resumen general.');

    // ── No reconocido ─────────────────────────────────────────────────
    } else {
      hablar('No entendí el comando. Intenta decir: ventas de hoy, alertas, cajero top, o resumen.');
    }
  }, [data, hablar]);

  const iniciarEscucha = useCallback(() => {
    if (!soportado) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart  = () => setEscuchando(true);
    recognition.onend    = () => setEscuchando(false);
    recognition.onerror  = () => setEscuchando(false);
    recognition.onresult = (e) => {
      const texto = e.results[0][0].transcript;
      procesarComando(texto);
    };
    recognition.start();
  }, [soportado, procesarComando]);

  const detener = () => {
    recognitionRef.current?.stop();
    window.speechSynthesis.cancel();
    setEscuchando(false);
    setRespuesta('');
    setComando('');
  };

  if (!soportado) return null;

  return (
    <div className="card border-0 shadow-sm mb-4" style={{ borderLeft:'4px solid #7c3aed' }}>
      <div className="card-body py-3">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-3">
            <div style={{ fontSize:28 }}>🎙️</div>
            <div>
              <div className="fw-bold" style={{ color:'#7c3aed' }}>Reportes por voz</div>
              <div className="text-muted" style={{ fontSize:12 }}>
                {escuchando ? '🔴 Escuchando...' : 'Di: "ventas de hoy", "alertas", "cajero top", "resumen"'}
              </div>
            </div>
          </div>
          <div className="d-flex gap-2">
            {!escuchando ? (
              <button className="btn btn-sm fw-bold"
                style={{ background:'#7c3aed', color:'#fff', borderRadius:20, padding:'6px 16px' }}
                onClick={iniciarEscucha}>
                🎙️ Hablar
              </button>
            ) : (
              <button className="btn btn-sm btn-danger fw-bold" style={{ borderRadius:20 }}
                onClick={detener}>
                ⏹ Detener
              </button>
            )}
          </div>
        </div>

        {/* Onda animada mientras escucha */}
        {escuchando && (
          <div className="mt-3 d-flex align-items-center gap-1 justify-content-center">
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{
                width: 4, borderRadius: 4,
                background: '#7c3aed',
                animation: `wave 1s ease-in-out ${i * 0.1}s infinite alternate`,
                height: `${8 + (i % 3) * 8}px`,
              }} />
            ))}
            <style>{`@keyframes wave { from { height: 8px; } to { height: 24px; } }`}</style>
          </div>
        )}

        {/* Comando detectado */}
        {comando && !escuchando && (
          <div className="mt-3 p-2 rounded" style={{ background:'#f5f3ff', border:'1px solid #ddd6fe' }}>
            <div className="text-muted" style={{ fontSize:11 }}>Escuché:</div>
            <div className="fw-semibold" style={{ color:'#7c3aed', fontSize:13 }}>"{comando}"</div>
          </div>
        )}

        {/* Respuesta */}
        {respuesta && !escuchando && (
          <div className="mt-2 p-3 rounded" style={{ background:'#1e3a5f', color:'#fff' }}>
            <div style={{ fontSize:11, opacity:0.7, marginBottom:4 }}>📢 Respuesta:</div>
            <div style={{ fontSize:13, lineHeight:1.5 }}>{respuesta}</div>
            <button className="btn btn-sm mt-2" style={{ background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:11 }}
              onClick={() => hablar(respuesta)}>
              🔊 Repetir
            </button>
          </div>
        )}

        {/* Comandos disponibles */}
        {!escuchando && !respuesta && (
          <div className="mt-2 d-flex flex-wrap gap-1">
            {['ventas de hoy', 'cajero top', 'alertas', 'top productos', 'comparación con ayer', 'resumen'].map(cmd => (
              <button key={cmd} className="btn btn-sm"
                style={{ fontSize:11, background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:20 }}
                onClick={() => procesarComando(cmd)}>
                {cmd}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Dashboard principal ────────────────────────────────────────────────────
const AdminDashboard = () => {
  const { token } = useAuth();
  const [data,       setData]       = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/dashboard/today', {}, token);
      setData(res);
      setLastUpdate(new Date());
    } catch(e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      </main>
    </div>
  );

  const variacion = data?.variacion_pct ?? 0;
  const varColor  = variacion >= 0 ? 'text-success' : 'text-danger';
  const varIcon   = variacion >= 0 ? '▲' : '▼';
  const alertas   = data?.alertas || {};

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold mb-0">📊 Dashboard</h4>
            <p className="text-muted small mb-0">
              Resumen del día · Actualizado {lastUpdate ? lastUpdate.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'}) : '—'}
            </p>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={load}>🔄 Actualizar</button>
        </div>

        {/* ✅ Reportes por voz */}
        <VoiceReports data={data} />

        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <KpiCard icon="💰" label="Ventas del día" value={fmt(data?.ventas_hoy)}
              sub={`${varIcon} ${Math.abs(variacion)}% vs ayer`} subColor={varColor} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="🧾" label="Transacciones" value={fmtNum(data?.transacciones)}
              sub={`Ticket prom: ${fmt(data?.ticket_promedio)}`} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="👤" label="Cajero top" value={data?.cajero_top?.nombre || '—'}
              sub={data?.cajero_top ? fmt(data.cajero_top.total) : 'Sin ventas aún'} />
          </div>
          <div className="col-6 col-md-3">
            <KpiCard icon="⚠️" label="Alertas activas" value={alertas.total || 0}
              sub={alertas.total > 0 ? 'Requieren atención' : 'Todo en orden'}
              subColor={alertas.total > 0 ? 'text-warning' : 'text-success'} />
          </div>
        </div>

        <div className="row g-4">
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header fw-semibold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                🏆 Top 5 productos del día
              </div>
              <div className="card-body p-0">
                {!data?.top_productos?.length ? (
                  <div className="text-center text-muted py-4">Sin ventas registradas hoy</div>
                ) : (
                  <table className="table table-hover mb-0" style={{ fontSize:13 }}>
                    <thead className="table-light">
                      <tr><th>#</th><th>Producto</th><th className="text-end">Uds</th><th className="text-end">Valor</th></tr>
                    </thead>
                    <tbody>
                      {data.top_productos.map((p, i) => (
                        <tr key={i}>
                          <td><span style={{ fontSize:16 }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span></td>
                          <td className="fw-semibold">{p.nombre}</td>
                          <td className="text-end">{fmtNum(p.qty)}</td>
                          <td className="text-end text-success fw-bold">{fmt(p.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6 d-flex flex-column gap-4">
            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                💳 Ventas por método de pago
              </div>
              <div className="card-body">
                {!data?.metodos_pago || !Object.keys(data.metodos_pago).length ? (
                  <div className="text-center text-muted py-2 small">Sin datos de métodos aún</div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {Object.entries(data.metodos_pago).map(([metodo, total]) => {
                      const pct = data.ventas_hoy > 0 ? Math.round((total / data.ventas_hoy) * 100) : 0;
                      const colores = { efectivo:'success', tarjeta:'primary', nequi:'warning', transferencia:'info', credito:'danger' };
                      const color = colores[metodo] || 'secondary';
                      return (
                        <div key={metodo}>
                          <div className="d-flex justify-content-between small mb-1">
                            <span className="fw-semibold text-capitalize">{metodo}</span>
                            <span>{fmt(total)} <span className="text-muted">({pct}%)</span></span>
                          </div>
                          <div className="progress" style={{ height:6 }}>
                            <div className={`progress-bar bg-${color}`} style={{ width:`${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header fw-semibold py-3" style={{ background:'#1e3a5f', color:'#fff' }}>
                🔔 Estado del sistema
              </div>
              <div className="card-body p-2">
                {[
                  { label:'Productos agotados',      val: alertas.stock_cero,   color:'danger'  },
                  { label:'Stock bajo',               val: alertas.stock_bajo,   color:'warning' },
                  { label:'Vencimientos próximos',    val: alertas.vencimientos, color:'warning' },
                  { label:'Turnos muy largos (+12h)', val: alertas.turno_largo,  color:'info'    },
                ].map((a, i) => (
                  <div key={i} className={`d-flex justify-content-between align-items-center px-3 py-2 rounded mb-1 ${a.val > 0 ? `bg-${a.color} bg-opacity-10` : 'bg-light'}`}>
                    <span className="small">{a.label}</span>
                    <span className={`badge ${a.val > 0 ? `bg-${a.color}` : 'bg-secondary'}`}>{a.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body py-3">
            <div className="row text-center g-3">
              <div className="col-4">
                <div className="text-muted small">Ventas hoy</div>
                <div className="fw-bold fs-5 text-primary">{fmt(data?.ventas_hoy)}</div>
              </div>
              <div className="col-4">
                <div className="text-muted small">Ventas ayer (misma hora)</div>
                <div className="fw-bold fs-5">{fmt(data?.total_ayer)}</div>
              </div>
              <div className="col-4">
                <div className="text-muted small">Variación</div>
                <div className={`fw-bold fs-5 ${varColor}`}>{varIcon} {Math.abs(variacion)}%</div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default AdminDashboard;