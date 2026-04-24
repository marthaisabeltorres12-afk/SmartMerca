import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';

const fmt    = n => Number(n||0).toLocaleString('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 });
const fmtNum = n => Number(n||0).toLocaleString('es-CO');

const CAUSAS = [
  { value:'vencimiento',  label:'🗓 Vencimiento',     color:'warning' },
  { value:'daño_fisico',  label:'💥 Daño físico',     color:'danger'  },
  { value:'robo',         label:'🚨 Robo',            color:'dark'    },
  { value:'error_conteo', label:'📋 Error de conteo', color:'secondary'},
  { value:'deterioro',    label:'🌡 Deterioro',       color:'info'    },
  { value:'merma',        label:'📦 Merma',           color:'secondary'},
  { value:'averia',       label:'💥 Avería',          color:'danger'  },
];

const causaLabel = v => CAUSAS.find(c=>c.value===v)?.label || v;
const causaColor = v => CAUSAS.find(c=>c.value===v)?.color || 'secondary';

const now = new Date();

const Merma = () => {
  const { token } = useAuth();
  const [tab,      setTab]      = useState('historial');
  const [records,  setRecords]  = useState([]);
  const [report,   setReport]   = useState(null);
  const [alert,    setAlert]    = useState(null);
  const [repYear,  setRepYear]  = useState(now.getFullYear());
  const [repMonth, setRepMonth] = useState(now.getMonth()+1);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const recs = await apiFetch('/shrinkage/', {}, token);
      setRecords(Array.isArray(recs) ? recs : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token]);

  const loadReport = useCallback(async () => {
    try {
      const r = await apiFetch(`/shrinkage/report?year=${repYear}&month=${repMonth}`, {}, token);
      setReport(r);
    } catch(e) { showAlert('danger', e.message); }
  }, [token, repYear, repMonth]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'reporte') loadReport(); }, [tab, loadReport]);

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-4" style={{ marginLeft:240 }}>
        <div className="mb-4">
          <h4 className="fw-bold mb-0">⚠️ Merma y Averías</h4>
          <p className="text-muted small mb-0">
            Las mermas se registran automáticamente desde <strong>Inventario → Registrar Salida</strong> cuando el motivo es daño, vencimiento, robo o pérdida.
          </p>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2`}>{alert.msg}</div>}

        <ul className="nav nav-tabs mb-4">
          {[['historial','📋 Historial'],['reporte','📊 Reporte mensual']].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
            </li>
          ))}
        </ul>

        {/* Historial */}
        {tab === 'historial' && (
          <div className="card border-0 shadow-sm">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                <thead className="table-light">
                  <tr><th>Fecha</th><th>Producto</th><th>Causa</th>
                    <th className="text-end">Cantidad</th><th className="text-end">Costo total</th><th>Observaciones</th></tr>
                </thead>
                <tbody>
                  {!records.length ? (
                    <tr><td colSpan="6" className="text-center text-muted py-4">Sin registros de merma</td></tr>
                  ) : records.map(r=>(
                    <tr key={r.id}>
                      <td className="text-muted">{r.created_at?.slice(0,10)}</td>
                      <td className="fw-semibold">{r.product_name}</td>
                      <td><span className={`badge bg-${causaColor(r.causa||r.tipo)}`}>{causaLabel(r.causa||r.tipo)}</span></td>
                      <td className="text-end">{fmtNum(r.cantidad)}</td>
                      <td className="text-end text-danger fw-bold">{r.costo_total ? fmt(r.costo_total) : '—'}</td>
                      <td className="text-muted small">{r.observaciones||r.descripcion||'—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="table-light">
                  <tr>
                    <td colSpan="4" className="text-end fw-bold">Total pérdida:</td>
                    <td className="text-end fw-bold text-danger">{fmt(records.reduce((a,r)=>a+parseFloat(r.costo_total||0),0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Reporte mensual */}
        {tab === 'reporte' && (
          <div>
            <div className="d-flex gap-2 mb-3 align-items-center">
              <select className="form-select" style={{width:160}} value={repMonth}
                onChange={e=>{setRepMonth(parseInt(e.target.value)); setReport(null);}}>
                {meses.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="form-select" style={{width:100}} value={repYear}
                onChange={e=>{setRepYear(parseInt(e.target.value)); setReport(null);}}>
                {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <button className="btn btn-primary" onClick={loadReport}>Consultar</button>
            </div>

            {!report ? (
              <div className="text-center text-muted py-4">Haz clic en Consultar para ver el reporte</div>
            ) : (
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div className="fs-3 fw-bold text-danger">{fmtNum(report.total_unidades||0)}</div>
                    <div className="text-muted small">Unidades perdidas</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div className="fs-4 fw-bold text-danger">{fmt(report.total_costo||0)}</div>
                    <div className="text-muted small">Costo total merma</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div className="fs-3 fw-bold text-warning">{report.total_registros||0}</div>
                    <div className="text-muted small">Registros</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card border-0 shadow-sm text-center py-3">
                    <div className="fs-5 fw-bold text-secondary">{meses[repMonth-1]} {repYear}</div>
                    <div className="text-muted small">Período</div>
                  </div>
                </div>

                {report.por_causa && Object.keys(report.por_causa).length > 0 && (
                  <div className="col-12">
                    <div className="card border-0 shadow-sm">
                      <div className="card-header fw-semibold py-2" style={{background:'#f8fafc'}}>Por causa</div>
                      <div className="card-body p-0">
                        <table className="table table-sm mb-0" style={{fontSize:13}}>
                          <thead className="table-light"><tr><th>Causa</th><th className="text-end">Unidades</th><th className="text-end">Costo</th></tr></thead>
                          <tbody>
                            {Object.entries(report.por_causa).map(([causa, data])=>(
                              <tr key={causa}>
                                <td><span className={`badge bg-${causaColor(causa)}`}>{causaLabel(causa)}</span></td>
                                <td className="text-end">{fmtNum(data.unidades||data)}</td>
                                <td className="text-end text-danger">{fmt(data.costo||0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Merma;