import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { saleService } from '../../services/saleService';
import { productService } from '../../services/productService';
import { apiFetch } from '../../services/api';

const dname = (p) => {
  if (!p) return '';
  if (p.gramaje_cantidad && p.gramaje_unidad) {
    const q = parseFloat(p.gramaje_cantidad);
    return `${p.name} · ${q === Math.floor(q) ? Math.floor(q) : q} ${p.gramaje_unidad}`;
  }
  return p.display_name || p.name;
};

const fmt = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });

const CAT_COLORS = {
  '🥦 Frutas y Verduras':       '#22c55e',
  '🥩 Carnes y Embutidos':      '#ef4444',
  '🥛 Lácteos y Huevos':        '#3b82f6',
  '🍞 Panadería y Repostería':  '#f59e0b',
  '🥤 Bebidas y Jugos':         '#06b6d4',
  '🍺 Bebidas Alcohólicas':     '#8b5cf6',
  '🍿 Snacks y Dulces':         '#ec4899',
  '🥫 Enlatados y Conservas':   '#f97316',
  '🌾 Granos y Cereales':       '#84cc16',
  '🫙 Aceites y Condimentos':   '#eab308',
  '🧊 Congelados':              '#67e8f9',
  '🧹 Limpieza del Hogar':      '#a78bfa',
  '🧴 Higiene Personal':        '#fb7185',
  '📦 Otros':                   '#94a3b8',
};

const LinesOverview = () => {
  const { token } = useAuth();
  const [sales,    setSales]    = useState([]);
  const [products, setProducts] = useState([]);
  const [lines,    setLines]    = useState([]);
  const [users,    setUsers]    = useState([]);
  const [period,   setPeriod]   = useState('mes');
  const [alert,    setAlert]    = useState(null);
  const [configModal, setConfigModal] = useState(null); // línea seleccionada para configurar
  const [configForm,  setConfigForm]  = useState({});
  const [saving,   setSaving]   = useState(false);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),3500); };

  const load = useCallback(async () => {
    try {
      const [s, p, ls, us] = await Promise.all([
        saleService.getAll(token),
        productService.getAll(token),
        apiFetch('/lines/', {}, token),
        apiFetch('/users/', {}, token),
      ]);
      setSales(s); setProducts(p);
      setLines(Array.isArray(ls) ? ls : []);
      setUsers(Array.isArray(us) ? us.filter(u=>u.role==='admin'||u.role==='admin_tecnico') : []);
    } catch(e) { console.error(e); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const now      = new Date();
  const todayStr = now.toISOString().slice(0,10);
  const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate()-7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate()-30);

  const periodSales = useMemo(() => sales.filter(s => {
    const d = new Date(s.created_at);
    if (period==='hoy')    return s.created_at?.slice(0,10) === todayStr;
    if (period==='semana') return d >= weekAgo;
    return d >= monthAgo;
  }), [sales, period, todayStr]);

  const catStats = useMemo(() => {
    const map = {};
    periodSales.forEach(sale => {
      sale.items?.forEach(item => {
        const meta = products.find(p => p.id===item.product_id || p.name===item.product);
        const cat  = meta?.category || '📦 Otros';
        if (!map[cat]) map[cat] = { monto:0, unidades:0, ventas: new Set() };
        map[cat].monto    += parseFloat(item.subtotal||0);
        map[cat].unidades += parseFloat(item.quantity||0);
        map[cat].ventas.add(sale.id);
      });
    });
    products.forEach(p => {
      const cat = p.category || '📦 Otros';
      if (!map[cat]) map[cat] = { monto:0, unidades:0, ventas: new Set() };
    });
    return Object.entries(map)
      .map(([cat, v]) => ({ cat, monto: v.monto, unidades: Math.round(v.unidades), ventas: v.ventas.size, productos: products.filter(p=>(p.category||'📦 Otros')===cat).length }))
      .sort((a,b) => b.monto - a.monto);
  }, [periodSales, products]);

  const [expanded, setExpanded] = useState(null);

  const toggleExpand = (cat) => setExpanded(expanded === cat ? null : cat);

  // Top productos por categoría
  const topProductsByCat = useMemo(() => {
    const map = {};
    periodSales.forEach(sale => {
      sale.items?.forEach(item => {
        const meta = products.find(p => p.id===item.product_id || p.name===item.product);
        const cat  = meta?.category || '📦 Otros';
        if (!map[cat]) map[cat] = {};
        const name = item.product || meta?.name || '?';
        if (!map[cat][name]) map[cat][name] = { qty:0, monto:0 };
        map[cat][name].qty   += parseFloat(item.quantity||0);
        map[cat][name].monto += parseFloat(item.subtotal||0);
      });
    });
    // Convertir a array ordenado
    const result = {};
    Object.entries(map).forEach(([cat, prods]) => {
      result[cat] = Object.entries(prods)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a,b) => b.monto - a.monto)
        .slice(0, 5);
    });
    return result;
  }, [periodSales, products]);

  const totalMonto = catStats.reduce((a,c) => a+c.monto, 0);

  const getLineConfig = (cat) => lines.find(l => l.name === cat);

  const openConfig = (cat) => {
    const line = getLineConfig(cat);
    setConfigModal({ cat, line });
    setConfigForm({
      responsible_user_id:          line?.responsible_user_id || '',
      meta_ventas_mensual:          line?.meta_ventas_mensual || '',
      presupuesto_compras_mensual:  line?.presupuesto_compras_mensual || '',
    });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      let line = configModal.line;

      // Si no existe la línea, crearla automáticamente
      if (!line) {
        const catColor = CAT_COLORS[configModal.cat] || '#94a3b8';
        line = await apiFetch('/lines/', {
          method: 'POST',
          body: JSON.stringify({ name: configModal.cat, color: catColor })
        }, token);
      }

      // Actualizar con los campos de configuración
      await apiFetch(`/lines/${line.id}`, { method:'PUT', body: JSON.stringify(configForm) }, token);

      showAlert('success', `Configuración de "${configModal.cat}" guardada`);
      setConfigModal(null);
      load();
    } catch(e) { showAlert('danger', e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold mb-0">📊 Líneas / Categorías</h4>
            <p className="text-muted mb-0 small">Rendimiento de cada categoría de productos</p>
          </div>
          <div className="d-flex gap-2">
            {[['hoy','Hoy'],['semana','7 días'],['mes','30 días']].map(([v,l]) => (
              <button key={v} className={'btn btn-sm ' + (period===v ? 'btn-dark' : 'btn-outline-secondary')}
                onClick={() => setPeriod(v)}>{l}</button>
            ))}
          </div>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2 mb-3`}>{alert.msg}</div>}

        {catStats.length === 0 ? (
          <div className="text-center text-muted py-5">Sin datos</div>
        ) : (
          <div className="row g-3">
            {catStats.map(({ cat, monto, unidades, ventas, productos }) => {
              const color    = CAT_COLORS[cat] || '#6b7280';
              const pct      = totalMonto > 0 ? ((monto/totalMonto)*100).toFixed(1) : 0;
              const lineCfg  = getLineConfig(cat);
              const meta     = lineCfg?.meta_ventas_mensual;
              const pctMeta  = meta && period === 'mes' ? Math.min(100, Math.round((monto / meta) * 100)) : null;

              return (
                <div key={cat} className="col-md-4 col-lg-3">
                  <div className="card border-0 shadow-sm h-100" style={{ borderLeft:`4px solid ${color}` }}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <Link to={`/admin/lineas/${encodeURIComponent(cat)}`}
                          className="fw-semibold text-decoration-none text-dark" style={{ fontSize:13 }}>
                          {cat}
                        </Link>
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{fontSize:11}}
                            onClick={()=>toggleExpand(cat)} title="Ver top productos">
                            {expanded===cat?'▲':'▼'}
                          </button>
                          <button className="btn btn-sm btn-outline-secondary py-0 px-1" style={{fontSize:11}}
                            title="Configurar metas y responsable"
                            onClick={()=>openConfig(cat)}>⚙️</button>
                        </div>
                      </div>

                      <div className="fs-5 fw-bold" style={{ color }}>{fmt(monto)}</div>

                      {/* Meta de ventas */}
                      {pctMeta !== null && (
                        <div className="mt-1">
                          <div className="d-flex justify-content-between" style={{fontSize:10}}>
                            <span className="text-muted">Meta mensual</span>
                            <span className={`fw-bold ${pctMeta>=100?'text-success':pctMeta>=70?'text-warning':'text-danger'}`}>
                              {pctMeta}%
                            </span>
                          </div>
                          <div className="progress" style={{height:4}}>
                            <div className={`progress-bar ${pctMeta>=100?'bg-success':pctMeta>=70?'bg-warning':'bg-danger'}`}
                              style={{width:`${pctMeta}%`}} />
                          </div>
                          <div className="text-muted" style={{fontSize:10}}>{fmt(monto)} / {fmt(meta)}</div>
                        </div>
                      )}

                      <div className="d-flex gap-3 mt-2 text-muted" style={{ fontSize:11 }}>
                        <span>{ventas} ventas</span>
                        <span>{unidades} uds</span>
                        <span>{productos} prods</span>
                      </div>

                      {lineCfg?.responsible_name && (
                        <div className="text-muted mt-1" style={{fontSize:11}}>
                          👤 {lineCfg.responsible_name}
                        </div>
                      )}

                      <div className="progress mt-2" style={{ height:6 }}>
                        <div className="progress-bar" style={{ width:`${pct}%`, background:color }} />
                      </div>
                      <div className="text-muted mt-1" style={{ fontSize:10 }}>{pct}% del total</div>

                      {/* Top productos expandido */}
                      {expanded === cat && (
                        <div className="mt-3 border-top pt-2">
                          <div className="fw-semibold mb-1" style={{fontSize:11, color}}>🏆 Top productos</div>
                          {!topProductsByCat[cat]?.length ? (
                            <div className="text-muted" style={{fontSize:11}}>Sin ventas en este período</div>
                          ) : topProductsByCat[cat].map((p,i) => (
                            <div key={i} className="d-flex justify-content-between align-items-center py-1 border-bottom" style={{fontSize:11}}>
                              <span className="text-truncate" style={{maxWidth:120}} title={p.name}>
                                {['🥇','🥈','🥉','4️⃣','5️⃣'][i]} {p.name}
                              </span>
                              <div className="text-end">
                                <div className="fw-bold text-success">{fmt(p.monto)}</div>
                                <div className="text-muted">{Math.round(p.qty)} uds</div>
                              </div>
                            </div>
                          ))}
                          <div className="mt-2 text-center">
                            <Link to={`/admin/lineas/${encodeURIComponent(cat)}`}
                              className="btn btn-sm btn-outline-primary py-0 px-2" style={{fontSize:11}}>
                              Ver detalle completo →
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal configuración */}
        {configModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">⚙️ Configurar — {configModal.cat}</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setConfigModal(null)} />
                </div>
                <form onSubmit={handleSaveConfig}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Gerente responsable</label>
                      <select className="form-select" value={configForm.responsible_user_id}
                        onChange={e=>setConfigForm({...configForm, responsible_user_id:e.target.value})}>
                        <option value="">— Sin asignar —</option>
                        {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Meta de ventas mensual</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="0" step="1000"
                          placeholder="Ej: 15000000"
                          value={configForm.meta_ventas_mensual}
                          onChange={e=>setConfigForm({...configForm, meta_ventas_mensual:e.target.value})} />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Presupuesto de compras mensual</label>
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" className="form-control" min="0" step="1000"
                          placeholder="Ej: 9000000"
                          value={configForm.presupuesto_compras_mensual}
                          onChange={e=>setConfigForm({...configForm, presupuesto_compras_mensual:e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setConfigModal(null)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold" disabled={saving}>
                      {saving ? 'Guardando...' : '✅ Guardar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default LinesOverview;