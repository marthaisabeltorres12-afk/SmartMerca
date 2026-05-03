import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt    = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtNum = n => Number(n||0).toLocaleString('es-CO');

const URGENCIA = {
  critica: { color:'#dc2626', bg:'#fef2f2', label:'🔴 Crítico',  border:'#fca5a5' },
  alta:    { color:'#d97706', bg:'#fffbeb', label:'🟠 Alto',     border:'#fde68a' },
  media:   { color:'#2563eb', bg:'#eff6ff', label:'🔵 Medio',    border:'#bfdbfe' },
  ok:      { color:'#16a34a', bg:'#f0fdf4', label:'🟢 OK',       border:'#bbf7d0' },
};

const TENDENCIA = {
  subiendo:   { icon:'📈', color:'#16a34a', label:'Subiendo' },
  bajando:    { icon:'📉', color:'#dc2626', label:'Bajando'  },
  estable:    { icon:'➡️', color:'#6b7280', label:'Estable'  },
  sin_datos:  { icon:'❓', color:'#9ca3af', label:'Sin datos'},
};

const DashboardPredictivo = () => {
  const { token } = useAuth();
  const [predicciones, setPredicciones] = useState(null);
  const [tendencias,   setTendencias]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('predicciones');
  const [filtroUrg,    setFiltroUrg]    = useState('todas');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [pred, tend] = await Promise.all([
        apiFetch('/dashboard/predicciones', {}, token),
        apiFetch('/dashboard/tendencias',   {}, token),
      ]);
      setPredicciones(pred);
      setTendencias(tend);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { cargar(); }, [cargar]);

  const predFiltradas = predicciones?.predicciones?.filter(p =>
    filtroUrg === 'todas' || p.urgencia === filtroUrg
  ) || [];

  if (loading) return (
    <div className="d-flex"><Navbar />
      <main className="flex-grow-1 d-flex align-items-center justify-content-center" style={{marginLeft:240,minHeight:'100vh'}}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3"/>
          <div className="text-muted">Analizando historial de ventas...</div>
        </div>
      </main>
    </div>
  );

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>

        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="fw-bold mb-0">🤖 Dashboard Predictivo IA</h4>
            <small className="text-muted">
              Análisis de {predicciones?.periodo_analisis} · Próxima semana: {predicciones?.proxima_semana}
            </small>
          </div>
          <button className="btn btn-outline-secondary btn-sm" onClick={cargar}>🔄 Actualizar</button>
        </div>

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {[
            { icon:'📦', label:'Productos analizados', val: fmtNum(predicciones?.total_productos), color:'primary' },
            { icon:'🔴', label:'Críticos (< 2 días)', val: fmtNum(predicciones?.criticos), color:'danger' },
            { icon:'🟠', label:'Alertas altas', val: fmtNum(predicciones?.alertas_altas), color:'warning' },
            { icon:'💰', label:'Valor pedidos estimado', val: fmt(predicciones?.valor_total_estimado), color:'success' },
          ].map((k,i) => (
            <div key={i} className="col-6 col-md-3">
              <div className={`card border-0 shadow-sm border-start border-${k.color} border-3`}>
                <div className="card-body py-3">
                  <div className="text-muted small">{k.icon} {k.label}</div>
                  <div className={`fw-bold fs-5 text-${k.color}`}>{k.val}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Insight */}
        {tendencias?.insight && (
          <div className="alert py-2 mb-4" style={{ background:'#eff6ff', border:'1px solid #bfdbfe', color:'#1e40af' }}>
            💡 <strong>Insight:</strong> {tendencias.insight}
          </div>
        )}

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button className={`nav-link ${tab==='predicciones'?'active fw-bold':''}`} onClick={()=>setTab('predicciones')}>
              📦 Predicción de demanda
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${tab==='tendencias'?'active fw-bold':''}`} onClick={()=>setTab('tendencias')}>
              📊 Tendencias de ventas
            </button>
          </li>
        </ul>

        {/* ── PREDICCIONES ── */}
        {tab === 'predicciones' && (
          <div>
            {/* Filtros */}
            <div className="d-flex gap-2 mb-3 flex-wrap">
              {['todas','critica','alta','media','ok'].map(u => (
                <button key={u} className={`btn btn-sm ${filtroUrg===u?'btn-dark':'btn-outline-secondary'}`}
                  style={{ borderRadius:20, fontSize:12 }}
                  onClick={()=>setFiltroUrg(u)}>
                  {u==='todas' ? 'Todas' : URGENCIA[u]?.label}
                </button>
              ))}
            </div>

            {/* Lista de predicciones */}
            <div className="row g-3">
              {!predFiltradas.length ? (
                <div className="col-12 text-center py-5 text-muted">
                  <div style={{fontSize:48}}>✅</div>
                  <div className="mt-2">No hay productos que requieran atención en este filtro</div>
                </div>
              ) : predFiltradas.map(p => {
                const urg  = URGENCIA[p.urgencia]  || URGENCIA.ok;
                const tend = TENDENCIA[p.tendencia] || TENDENCIA.estable;
                return (
                  <div key={p.product_id} className="col-md-6">
                    <div className="card border-0 shadow-sm h-100"
                      style={{ borderLeft:`4px solid ${urg.color}` }}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <div className="fw-bold">{p.product_name}</div>
                            <div className="text-muted small">{p.categoria} · {p.proveedor}</div>
                          </div>
                          <span className="badge" style={{ background:urg.bg, color:urg.color, border:`1px solid ${urg.border}` }}>
                            {urg.label}
                          </span>
                        </div>

                        <div className="row g-2 mb-3">
                          <div className="col-4 text-center p-2 rounded" style={{background:'#f8fafc'}}>
                            <div className="text-muted" style={{fontSize:10}}>Stock actual</div>
                            <div className="fw-bold" style={{color: p.stock_actual <= 2 ? '#dc2626' : '#1e293b'}}>
                              {fmtNum(p.stock_actual)}
                            </div>
                          </div>
                          <div className="col-4 text-center p-2 rounded" style={{background:'#f8fafc'}}>
                            <div className="text-muted" style={{fontSize:10}}>Pred. semana</div>
                            <div className="fw-bold text-primary">{fmtNum(p.prediccion_semana)}</div>
                          </div>
                          <div className="col-4 text-center p-2 rounded" style={{background:'#f8fafc'}}>
                            <div className="text-muted" style={{fontSize:10}}>Días de stock</div>
                            <div className="fw-bold" style={{color: p.dias_de_stock <= 3 ? '#dc2626' : '#16a34a'}}>
                              {p.dias_de_stock >= 99 ? '99+' : p.dias_de_stock}d
                            </div>
                          </div>
                        </div>

                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <span style={{fontSize:12}} className="text-muted">Tendencia: </span>
                            <span style={{fontSize:12, color: tend.color, fontWeight:600}}>
                              {tend.icon} {tend.label}
                            </span>
                          </div>
                          {p.necesita_pedir > 0 && (
                            <div className="text-end">
                              <div className="fw-bold text-danger small">Pedir: {fmtNum(p.necesita_pedir)} uds</div>
                              <div className="text-muted" style={{fontSize:11}}>~{fmt(p.valor_pedido_estimado)}</div>
                            </div>
                          )}
                        </div>

                        {/* Barra de días de stock */}
                        <div className="mt-2">
                          <div className="progress" style={{height:4}}>
                            <div className="progress-bar"
                              style={{
                                width: `${Math.min(100, (p.dias_de_stock / 14) * 100)}%`,
                                background: p.dias_de_stock <= 2 ? '#dc2626' : p.dias_de_stock <= 5 ? '#d97706' : '#16a34a'
                              }}/>
                          </div>
                          <div className="text-muted mt-1" style={{fontSize:10}}>
                            {p.dias_de_stock >= 99 ? 'Stock suficiente' : `Se acaba en ${p.dias_de_stock} días al ritmo actual`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TENDENCIAS ── */}
        {tab === 'tendencias' && tendencias && (
          <div className="row g-4">
            {/* Por día de la semana */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold" style={{background:'#1e3a5f', color:'#fff'}}>
                  📅 Ventas por día de la semana
                </div>
                <div className="card-body">
                  {tendencias.ventas_por_dia.map((d, i) => {
                    const maxTotal = Math.max(...tendencias.ventas_por_dia.map(x => x.total));
                    const pct      = maxTotal > 0 ? (d.total / maxTotal) * 100 : 0;
                    const esMejor  = d.dia === tendencias.mejor_dia?.dia;
                    const esPeor   = d.dia === tendencias.peor_dia?.dia;
                    return (
                      <div key={i} className="mb-2">
                        <div className="d-flex justify-content-between small mb-1">
                          <span className="fw-semibold">
                            {d.dia}
                            {esMejor && <span className="badge bg-success ms-1" style={{fontSize:9}}>Mejor</span>}
                            {esPeor  && <span className="badge bg-danger ms-1"  style={{fontSize:9}}>Menor</span>}
                          </span>
                          <span className="text-muted">{fmt(d.total)} · {fmtNum(d.transacciones)} ventas</span>
                        </div>
                        <div className="progress" style={{height:8}}>
                          <div className="progress-bar"
                            style={{width:`${pct}%`, background: esMejor?'#16a34a':esPeor?'#dc2626':'#2563eb'}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Por hora */}
            <div className="col-md-6">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold" style={{background:'#1e3a5f', color:'#fff'}}>
                  🕐 Hora pico de ventas
                </div>
                <div className="card-body">
                  {tendencias.ventas_por_hora.map((h, i) => {
                    const maxTotal = Math.max(...tendencias.ventas_por_hora.map(x => x.total));
                    const pct      = maxTotal > 0 ? (h.total / maxTotal) * 100 : 0;
                    const esMejor  = h.hora === tendencias.mejor_hora?.hora;
                    return (
                      <div key={i} className="mb-1">
                        <div className="d-flex justify-content-between small mb-1">
                          <span className={`fw-semibold ${esMejor?'text-success':''}`}>
                            {h.hora} {esMejor && '⭐'}
                          </span>
                          <span className="text-muted">{fmtNum(h.transacciones)} ventas</span>
                        </div>
                        <div className="progress" style={{height:5}}>
                          <div className="progress-bar"
                            style={{width:`${pct}%`, background: esMejor?'#16a34a':'#6366f1'}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recomendaciones */}
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header fw-semibold" style={{background:'#1e3a5f', color:'#fff'}}>
                  💡 Recomendaciones basadas en tus datos
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {tendencias.mejor_dia && (
                      <div className="col-md-4">
                        <div className="p-3 rounded" style={{background:'#f0fdf4', border:'1px solid #bbf7d0'}}>
                          <div className="fw-bold text-success mb-1">📅 Mejor día</div>
                          <div className="small">El <strong>{tendencias.mejor_dia.dia}</strong> es tu día más fuerte con {fmt(tendencias.mejor_dia.total)}. Asegúrate de tener suficiente stock y personal ese día.</div>
                        </div>
                      </div>
                    )}
                    {tendencias.peor_dia && (
                      <div className="col-md-4">
                        <div className="p-3 rounded" style={{background:'#fff5f5', border:'1px solid #fca5a5'}}>
                          <div className="fw-bold text-danger mb-1">📉 Día bajo</div>
                          <div className="small">El <strong>{tendencias.peor_dia.dia}</strong> tiene menos ventas. Considera promociones o descuentos ese día para activar las ventas.</div>
                        </div>
                      </div>
                    )}
                    {tendencias.mejor_hora && (
                      <div className="col-md-4">
                        <div className="p-3 rounded" style={{background:'#eff6ff', border:'1px solid #bfdbfe'}}>
                          <div className="fw-bold text-primary mb-1">🕐 Hora pico</div>
                          <div className="small">Las <strong>{tendencias.mejor_hora.hora}</strong> es tu hora más activa. Ten todos los cajeros disponibles en ese horario.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPredictivo;