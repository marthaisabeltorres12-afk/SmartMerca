import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt   = n => Number(n||0).toLocaleString('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0});
const fmtN  = n => Number(n||0).toLocaleString('es-CO');
const TODAY = () => new Date().toISOString().slice(0,10);

const TIPOS_NOVEDAD = [
  ['incapacidad_general',   '🏥 Incapacidad General (EPS)'],
  ['incapacidad_laboral',   '⚠️ Incapacidad Laboral (ARL)'],
  ['licencia_maternidad',   '👶 Licencia Maternidad'],
  ['licencia_paternidad',   '👨‍👧 Licencia Paternidad'],
  ['licencia_no_remunerada','📋 Licencia No Remunerada'],
  ['ausencia_injustificada','❌ Ausencia Injustificada'],
  ['permiso_remunerado',    '✅ Permiso Remunerado'],
  ['vacaciones',            '🏖️ Vacaciones'],
  ['bonificacion',          '🎁 Bonificación'],
  ['comision',              '💰 Comisión por Ventas'],
  ['prestamo',              '🏦 Préstamo'],
  ['embargo',               '⚖️ Embargo'],
  ['adelanto',              '💵 Adelanto de Salario'],
];

const EMPTY_EMP = {
  user_id:'', cedula:'', fecha_nacimiento:'', direccion:'', telefono:'',
  contacto_emergencia:'', nombre_contacto_emergencia:'',
  fecha_inicio_contrato:'', tipo_contrato:'indefinido', cargo_oficial:'',
  salario_base:'', tiene_auxilio_transporte:true,
  eps:'', fondo_pensiones:'', arl:'', caja_compensacion:'',
  clase_riesgo_arl:1, banco:'', cuenta_bancaria:'',
};

// ── PDF DESPRENDIBLE ──────────────────────────────────────────────────────
const generarDesprendible = (record, period) => {
  const doc = new jsPDF({ unit:'mm', format:[80,200] });
  doc.setFontSize(10); doc.setFont('helvetica','bold');
  doc.text('SmartMerca', 40, 8, {align:'center'});
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text('COMPROBANTE DE NÓMINA', 40, 13, {align:'center'});
  doc.text(`Período: ${period?.period || ''}`, 40, 18, {align:'center'});
  doc.line(2, 20, 78, 20);
  doc.setFont('helvetica','bold'); doc.text(record.employee_name, 4, 25);
  doc.setFont('helvetica','normal');
  doc.text(`Cédula: ${record.cedula}`, 4, 30);
  doc.text(`Cargo: ${record.cargo || '—'}`, 4, 35);
  doc.text(`Días trabajados: ${record.dias_trabajados}`, 4, 40);
  doc.line(2, 42, 78, 42);

  // Devengos
  doc.setFont('helvetica','bold'); doc.text('DEVENGOS', 4, 47);
  doc.setFont('helvetica','normal');
  let y = 52;
  const row = (label, val) => {
    if (!val || val === 0) return;
    doc.text(label, 4, y);
    doc.text(fmt(val), 76, y, {align:'right'});
    y += 5;
  };
  row('Salario base', record.salario_base_proporcional);
  row('Auxilio transporte', record.auxilio_transporte);
  row('Bonificaciones', record.bonificaciones);
  row('Comisiones', record.comisiones);
  row('H. extras diurnas', record.horas_extras_diurnas_valor);
  row('H. extras nocturnas', record.horas_extras_nocturnas_valor);
  row('Recargo nocturno', record.recargo_nocturno_valor);
  row('Dominicales/festivos', record.horas_dominicales_valor);
  doc.line(2, y, 78, y); y += 5;
  doc.setFont('helvetica','bold');
  doc.text('TOTAL DEVENGADO', 4, y);
  doc.text(fmt(record.total_devengado), 76, y, {align:'right'});
  y += 7; doc.setFont('helvetica','normal');

  // Deducciones
  doc.setFont('helvetica','bold'); doc.text('DEDUCCIONES', 4, y); y += 5;
  doc.setFont('helvetica','normal');
  row('Salud (4%)', record.deduccion_salud);
  row('Pensión (4%)', record.deduccion_pension);
  row('Otros descuentos', record.otros_descuentos);
  row('Adelanto salario', record.adelanto_salario);
  doc.line(2, y, 78, y); y += 5;
  doc.setFont('helvetica','bold');
  doc.text('TOTAL DEDUCCIONES', 4, y);
  doc.text(fmt(record.total_deducciones), 76, y, {align:'right'});
  y += 7;

  // Neto
  doc.setFillColor(30, 58, 95); doc.rect(2, y-4, 76, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.text('NETO A PAGAR', 4, y+1);
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text(fmt(record.neto_a_pagar), 76, y+1, {align:'right'});
  doc.setTextColor(0,0,0); doc.setFontSize(8); y += 10;
  doc.setFont('helvetica','normal');

  // Aportes empresa
  doc.line(2, y, 78, y); y += 5;
  doc.setFont('helvetica','bold'); doc.text('APORTES EMPRESA (info)', 4, y); y += 5;
  doc.setFont('helvetica','normal');
  row('Salud empleador', record.aporte_salud_empleador);
  row('Pensión empleador', record.aporte_pension_empleador);
  row('ARL', record.aporte_arl);
  row('Caja compensación', record.aporte_caja);
  row('SENA', record.aporte_sena);
  row('ICBF', record.aporte_icbf);
  row('Prima (provisión)', record.prima_servicios);
  row('Cesantías (provisión)', record.cesantias);
  row('Int. cesantías', record.intereses_cesantias);
  row('Vacaciones (provisión)', record.vacaciones);
  doc.line(2, y, 78, y); y += 5;
  doc.setFont('helvetica','bold');
  doc.text('COSTO TOTAL EMPRESA', 4, y);
  doc.text(fmt(record.costo_total_empleador), 76, y, {align:'right'});
  y += 8;
  doc.setFont('helvetica','normal');
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')}`, 40, y, {align:'center'});

  doc.save(`desprendible_${record.employee_name?.replace(' ','_')}_${period?.period}.pdf`);
};

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
const Nomina = () => {
  const { token, user } = useAuth();
  const isAdmin = ['admin','admin_tecnico','contador'].includes(user?.role);

  const [mainTab,    setMainTab]    = useState('empleados');
  const [employees,  setEmployees]  = useState([]);
  const [users,      setUsers]      = useState([]);
  const [periods,    setPeriods]    = useState([]);
  const [selPeriod,  setSelPeriod]  = useState(null);
  const [records,    setRecords]    = useState([]);
  const [novedades,  setNovedades]  = useState([]);
  const [myRecords,  setMyRecords]  = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [alert,      setAlert]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [confirmCalc, setConfirmCalc] = useState(false);
  const [confirmDelNov, setConfirmDelNov] = useState(null);

  // Modales empleados
  const [empModal,   setEmpModal]   = useState(false);
  const [empForm,    setEmpForm]    = useState(EMPTY_EMP);
  const [editingEmp, setEditingEmp] = useState(null);

  // Modales períodos
  const [perModal,   setPerModal]   = useState(false);
  const [perForm, setPerForm] = useState({ period: '', tipo: 'mensual', quincena: '1' });

  // Modales novedades
  const [novModal,   setNovModal]   = useState(false);
  const [novForm,    setNovForm]    = useState({ employee_id:'', tipo:'bonificacion', dias_afectados:'', valor:'', descripcion:'' });

  // Modal pago
  const [payModal,   setPayModal]   = useState(null);
  const [payForm,    setPayForm]    = useState({ metodo_pago:'transferencia', referencia_pago:'' });

  // Modal liquidación
  const [liqModal,   setLiqModal]   = useState(null);
  const [liqData,    setLiqData]    = useState(null);
  const [liqLoading, setLiqLoading] = useState(false);

  const showAlert = (type, msg) => { setAlert({type,msg}); setTimeout(()=>setAlert(null),4000); };

  const load = useCallback(async () => {
    try {
      const [emps, usrs, pers] = await Promise.all([
        apiFetch('/payroll/employees', {}, token),
        isAdmin ? apiFetch('/users/', {}, token) : Promise.resolve([]),
        apiFetch('/payroll/periods', {}, token),
      ]);
      setEmployees(Array.isArray(emps) ? emps : []);
      setUsers(Array.isArray(usrs) ? usrs : []);
      setPeriods(Array.isArray(pers) ? pers : []);
      if (!isAdmin) {
        const myR = await apiFetch('/payroll/my-records', {}, token).catch(()=>[]);
        setMyRecords(Array.isArray(myR) ? myR : []);
      }
      const liqs = await apiFetch('/payroll/liquidaciones', {}, token).catch(()=>[]);
      setLiquidaciones(Array.isArray(liqs) ? liqs : []);
    } catch(e) { showAlert('danger', e.message); }
  }, [token, isAdmin]);

  const loadPeriodData = useCallback(async (pid) => {
    try {
      const [recs, novs] = await Promise.all([
        apiFetch(`/payroll/periods/${pid}/records`, {}, token),
        apiFetch(`/payroll/periods/${pid}/novedades`, {}, token),
      ]);
      setRecords(Array.isArray(recs) ? recs : []);
      setNovedades(Array.isArray(novs) ? novs : []);
    } catch(e) {}
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selPeriod) loadPeriodData(selPeriod.id); }, [selPeriod, loadPeriodData]);

  // ── Empleados ───────────────────────────────────────────────────────────
  const handleSaveEmp = async (e) => {
    e.preventDefault();
    try {
      if (editingEmp) {
        await apiFetch(`/payroll/employees/${editingEmp.id}`, { method:'PUT', body: JSON.stringify(empForm) }, token);
        showAlert('success', 'Empleado actualizado');
      } else {
        await apiFetch('/payroll/employees', { method:'POST', body: JSON.stringify(empForm) }, token);
        showAlert('success', 'Empleado registrado');
      }
      setEmpModal(false); setEmpForm(EMPTY_EMP); setEditingEmp(null); load();
    } catch(e) { showAlert('danger', e.message); }
  };

  const openEditEmp = (emp) => {
    setEditingEmp(emp);
    setEmpForm({
      user_id: String(emp.user_id), cedula: emp.cedula,
      fecha_nacimiento: emp.fecha_nacimiento||'', direccion: emp.direccion||'',
      telefono: emp.telefono||'', contacto_emergencia: emp.contacto_emergencia||'',
      nombre_contacto_emergencia: emp.nombre_contacto_emergencia||'',
      fecha_inicio_contrato: emp.fecha_inicio_contrato,
      tipo_contrato: emp.tipo_contrato, cargo_oficial: emp.cargo_oficial||'',
      salario_base: String(emp.salario_base), tiene_auxilio_transporte: emp.tiene_auxilio_transporte,
      eps: emp.eps||'', fondo_pensiones: emp.fondo_pensiones||'',
      arl: emp.arl||'', caja_compensacion: emp.caja_compensacion||'',
      clase_riesgo_arl: emp.clase_riesgo_arl||1,
      banco: emp.banco||'', cuenta_bancaria: emp.cuenta_bancaria||'',
    });
    setEmpModal(true);
  };

  // Reemplaza tu handleCreatePeriod existente en Nomina.jsx

const handleCreatePeriod = async (e) => {
  e.preventDefault();
  if (!perForm.period) return;

  const [y, m] = perForm.period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  let fecha_inicio, fecha_fin, nombre;

  if (perForm.tipo === 'quincenal') {
    if (perForm.quincena === '1') {
      fecha_inicio = `${y}-${String(m).padStart(2,'0')}-01`;
      fecha_fin    = `${y}-${String(m).padStart(2,'0')}-15`;
      nombre = `1ª Quincena ${new Date(y,m-1).toLocaleString('es-CO',{month:'long'})} ${y}`;
    } else {
      fecha_inicio = `${y}-${String(m).padStart(2,'0')}-16`;
      fecha_fin    = `${y}-${String(m).padStart(2,'0')}-${lastDay}`;
      nombre = `2ª Quincena ${new Date(y,m-1).toLocaleString('es-CO',{month:'long'})} ${y}`;
    }
  } else {
    fecha_inicio = `${y}-${String(m).padStart(2,'0')}-01`;
    fecha_fin    = `${y}-${String(m).padStart(2,'0')}-${lastDay}`;
    nombre = `${new Date(y,m-1).toLocaleString('es-CO',{month:'long',year:'numeric'})}`;
  }

  try {
    await apiFetch('/payroll/periods', {
      method: 'POST',
      body: JSON.stringify({ nombre, fecha_inicio, fecha_fin })
    }, token);
    setPerModal(false);
    setPerForm({ period: '', tipo: 'mensual', quincena: '1' });
    load(); // recargar lista
  } catch(err) {
    showAlert('danger', err.message);
  }
};
  const handleCalculate = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/payroll/periods/${selPeriod.id}/calculate`, { method:'POST' }, token);
      showAlert('success', res.message || 'Nómina calculada');
      setConfirmCalc(false); load(); loadPeriodData(selPeriod.id);
      const updated = await apiFetch('/payroll/periods', {}, token);
      const up = Array.isArray(updated) ? updated.find(p=>p.id===selPeriod.id) : null;
      if (up) setSelPeriod(up);
    } catch(e) { showAlert('danger', e.message); }
    finally { setLoading(false); }
  };

  // ── Novedades ────────────────────────────────────────────────────────────
  const handleSaveNov = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/payroll/novedades', { method:'POST', body: JSON.stringify({ ...novForm, period_id: selPeriod.id }) }, token);
      showAlert('success', 'Novedad registrada'); setNovModal(false);
      setNovForm({ employee_id:'', tipo:'bonificacion', dias_afectados:'', valor:'', descripcion:'' });
      loadPeriodData(selPeriod.id);
    } catch(e) { showAlert('danger', e.message); }
  };

  const handleDeleteNov = async (id) => {
    try {
      await apiFetch(`/payroll/novedades/${id}`, { method:'DELETE' }, token);
      showAlert('success', 'Novedad eliminada'); setConfirmDelNov(null); loadPeriodData(selPeriod.id);
    } catch(e) { showAlert('danger', e.message); }
  };

  // ── Pago individual ──────────────────────────────────────────────────────
  const handleMarkPaid = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/payroll/records/${payModal.id}/pay`, { method:'POST', body: JSON.stringify(payForm) }, token);
      showAlert('success', 'Pago registrado'); setPayModal(null); loadPeriodData(selPeriod.id);
    } catch(e) { showAlert('danger', e.message); }
  };

  // ── Liquidación ──────────────────────────────────────────────────────────
  const openLiquidacion = async (emp) => {
    setLiqModal(emp); setLiqData(null); setLiqLoading(true);
    try {
      const res = await apiFetch(`/payroll/liquidacion/${emp.id}/calcular`, {
        method:'POST', body: JSON.stringify({ motivo_retiro: 'Renuncia voluntaria' })
      }, token);
      setLiqData(res);
    } catch(e) { showAlert('danger', e.message); }
    finally { setLiqLoading(false); }
  };

  const handleGuardarLiq = async () => {
    try {
      await apiFetch('/payroll/liquidacion', { method:'POST', body: JSON.stringify({ ...liqData, employee_id: liqModal.id }) }, token);
      showAlert('success', 'Liquidación guardada. Empleado marcado como retirado.');
      setLiqModal(null); setLiqData(null); load();
    } catch(e) { showAlert('danger', e.message); }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="d-flex">
      <Navbar />
      <main className="flex-grow-1 p-3" style={{ marginLeft:240, background:'#f8fafc', minHeight:'100vh' }}>

        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold mb-0">👥 Nómina</h4>
            <small className="text-muted">Gestión integral de empleados y pagos — Ley colombiana 2026</small>
          </div>
        </div>

        {alert && <div className={`alert alert-${alert.type} py-2`}>{alert.msg}</div>}

        {/* Tabs principales */}
        <ul className="nav nav-tabs mb-4">
          {isAdmin ? [
            ['empleados','👤 Empleados'],
            ['periodos','📅 Períodos'],
            ['liquidacion','📋 Liquidaciones'],
          ].map(([k,l])=>(
            <li key={k} className="nav-item">
              <button className={`nav-link ${mainTab===k?'active':''}`} onClick={()=>setMainTab(k)}>{l}</button>
            </li>
          )) : (
            <li className="nav-item">
              <button className="nav-link active">📄 Mis desprendibles</button>
            </li>
          )}
        </ul>

        {/* ══ TAB EMPLEADOS ══ */}
        {mainTab === 'empleados' && isAdmin && (
          <div>
            <div className="d-flex justify-content-between mb-3">
              <h5 className="fw-bold mb-0">Empleados registrados ({employees.length})</h5>
              <button className="btn btn-primary btn-sm" onClick={()=>{ setEditingEmp(null); setEmpForm(EMPTY_EMP); setEmpModal(true); }}>+ Nuevo empleado</button>
            </div>
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                  <thead className="table-light">
                    <tr><th>Empleado</th><th>Cédula</th><th>Cargo</th><th>Contrato</th><th className="text-end">Salario</th><th>Estado</th><th></th></tr>
                  </thead>
                  <tbody>
                    {!employees.length ? (
                      <tr><td colSpan="7" className="text-center text-muted py-4">Sin empleados registrados</td></tr>
                    ) : employees.map(emp=>(
                      <tr key={emp.id} style={{opacity: emp.estado==='retirado'?0.6:1}}>
                        <td className="fw-semibold">{emp.user_name}</td>
                        <td className="text-muted">{emp.cedula}</td>
                        <td>{emp.cargo_oficial||'—'}</td>
                        <td><span className="badge bg-secondary">{emp.tipo_contrato}</span></td>
                        <td className="text-end fw-bold text-success">{fmt(emp.salario_base)}</td>
                        <td>
                          <span className={`badge ${emp.estado==='activo'?'bg-success':emp.estado==='retirado'?'bg-danger':'bg-warning text-dark'}`}>
                            {emp.estado}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={()=>openEditEmp(emp)}>✏️</button>
                            {emp.estado !== 'retirado' && (
                              <button className="btn btn-sm btn-outline-danger py-0 px-2" title="Liquidar" onClick={()=>openLiquidacion(emp)}>📋 Liq.</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB PERÍODOS ══ */}
        {mainTab === 'periodos' && isAdmin && (
          <div className="row g-4">
            {/* Lista de períodos */}
            <div className="col-md-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="fw-semibold small">Períodos</span>
                <button className="btn btn-sm btn-outline-primary py-0" onClick={()=>setPerModal(true)}>+</button>
              </div>
              <div className="list-group list-group-flush border rounded">
                {!periods.length ? (
                  <div className="list-group-item text-muted small text-center py-3">Sin períodos</div>
                ) : periods.map(p=>(
                  <button key={p.id} className={`list-group-item list-group-item-action py-2 ${selPeriod?.id===p.id?'active':''}`}
                    onClick={()=>setSelPeriod(p)}>
                    <div className="fw-semibold">{p.period}</div>
                    <div style={{fontSize:11}}>{p.total_records} empleados · {fmt(p.total_neto)}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detalle del período */}
            <div className="col-md-9">
              {!selPeriod ? (
                <div className="text-center text-muted py-5"><div className="fs-2">👈</div><div>Selecciona un período</div></div>
              ) : (
                <>
                  {/* Header período */}
                  <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body py-3">
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <div>
                          <h5 className="fw-bold mb-0">📅 {selPeriod.period}</h5>
                          <small className="text-muted">{selPeriod.fecha_inicio} → {selPeriod.fecha_fin}</small>
                        </div>
                        <div className="d-flex gap-2 flex-wrap align-items-center">
                          <span>{{'abierto':'📂','calculado':'🧮','pagado':'✅'}[selPeriod.status]} {selPeriod.status}</span>
                          {selPeriod.status !== 'pagado' && (
                            <button className="btn btn-sm btn-warning fw-bold" onClick={()=>setConfirmCalc(true)} disabled={loading}>
                              🧮 {loading?'Calculando...':'Calcular nómina'}
                            </button>
                          )}
                          <button className="btn btn-sm btn-outline-primary" onClick={()=>setNovModal(true)}>+ Novedad</button>
                        </div>
                      </div>
                      {/* KPIs */}
                      {selPeriod.status !== 'abierto' && (
                        <div className="row g-2 mt-2">
                          {[
                            ['💰 Devengado total', selPeriod.total_devengado, 'success'],
                            ['➖ Deducciones', selPeriod.total_deducciones, 'danger'],
                            ['✅ Neto a pagar', selPeriod.total_neto, 'primary'],
                            ['🏢 Costo empresa', selPeriod.costo_total_empleador, 'warning'],
                          ].map(([label,val,color])=>(
                            <div key={label} className="col-6 col-md-3">
                              <div className={`card border-${color} border-1 text-center py-2`}>
                                <div className={`fw-bold text-${color}`} style={{fontSize:13}}>{fmt(val)}</div>
                                <div className="text-muted" style={{fontSize:10}}>{label}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Novedades */}
                  {novedades.length > 0 && (
                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-header py-2 fw-semibold small" style={{background:'#fffbeb'}}>
                        ⚠️ Novedades del período ({novedades.length})
                      </div>
                      <div className="table-responsive">
                        <table className="table table-sm mb-0" style={{fontSize:12}}>
                          <thead className="table-light"><tr><th>Empleado</th><th>Tipo</th><th className="text-center">Días</th><th className="text-end">Valor</th><th>Descripción</th><th></th></tr></thead>
                          <tbody>
                            {novedades.map(n=>(
                              <tr key={n.id}>
                                <td className="fw-semibold">{n.employee_name}</td>
                                <td><span className="badge bg-secondary" style={{fontSize:10}}>{n.tipo.replace(/_/g,' ')}</span></td>
                                <td className="text-center">{n.dias_afectados||'—'}</td>
                                <td className="text-end">{n.valor?fmt(n.valor):'—'}</td>
                                <td className="text-muted">{n.descripcion||'—'}</td>
                                <td><button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={()=>setConfirmDelNov(n)}>🗑</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Records de nómina */}
                  {records.length > 0 && (
                    <div className="card border-0 shadow-sm">
                      <div className="card-header py-2 fw-semibold small" style={{background:'#f0f9ff'}}>
                        📄 Nómina calculada — {records.length} empleado(s)
                      </div>
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{fontSize:12}}>
                          <thead className="table-light">
                            <tr>
                              <th>Empleado</th><th className="text-center">Días</th>
                              <th className="text-end">Devengado</th><th className="text-end">Deducciones</th>
                              <th className="text-end">Neto</th><th className="text-end">Costo empresa</th>
                              <th>Estado</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map(r=>(
                              <tr key={r.id} style={{background: r.status==='pagado'?'#f0fff4':''}}>
                                <td>
                                  <div className="fw-semibold">{r.employee_name}</div>
                                  <div className="text-muted" style={{fontSize:10}}>{r.cargo||'—'}</div>
                                </td>
                                <td className="text-center">{r.dias_trabajados}</td>
                                <td className="text-end text-success fw-bold">{fmt(r.total_devengado)}</td>
                                <td className="text-end text-danger">{fmt(r.total_deducciones)}</td>
                                <td className="text-end fw-bold text-primary">{fmt(r.neto_a_pagar)}</td>
                                <td className="text-end text-muted">{fmt(r.costo_total_empleador)}</td>
                                <td>
                                  <span className={`badge ${r.status==='pagado'?'bg-success':'bg-warning text-dark'}`}>
                                    {r.status==='pagado'?'✅ Pagado':'⏳ Pendiente'}
                                  </span>
                                </td>
                                <td>
                                  <div className="d-flex gap-1">
                                    <button className="btn btn-sm btn-outline-secondary py-0 px-1" title="Desprendible PDF"
                                      onClick={()=>generarDesprendible(r, selPeriod)}>📄</button>
                                    {r.status !== 'pagado' && (
                                      <button className="btn btn-sm btn-outline-success py-0 px-1"
                                        onClick={()=>{ setPayModal(r); setPayForm({metodo_pago:'transferencia',referencia_pago:''}); }}>
                                        💳
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB LIQUIDACIONES ══ */}
        {mainTab === 'liquidacion' && isAdmin && (
          <div>
            <h5 className="fw-bold mb-3">📋 Historial de Liquidaciones</h5>
            <div className="card border-0 shadow-sm">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                  <thead className="table-light">
                    <tr><th>Empleado</th><th>Fecha</th><th>Motivo</th><th className="text-end">Total</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {!liquidaciones.length ? (
                      <tr><td colSpan="5" className="text-center text-muted py-4">Sin liquidaciones</td></tr>
                    ) : liquidaciones.map(l=>(
                      <tr key={l.id}>
                        <td className="fw-semibold">{l.employee_name}</td>
                        <td className="text-muted">{l.fecha_liquidacion}</td>
                        <td>{l.motivo_retiro||'—'}</td>
                        <td className="text-end fw-bold text-danger">{fmt(l.total_liquidacion)}</td>
                        <td><span className={`badge ${l.pagado?'bg-success':'bg-warning text-dark'}`}>{l.pagado?'Pagada':'Pendiente'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ VISTA EMPLEADO — mis desprendibles ══ */}
        {!isAdmin && (
          <div>
            <h5 className="fw-bold mb-3">📄 Mis desprendibles de pago</h5>
            {!myRecords.length ? (
              <div className="text-center text-muted py-5">Sin desprendibles disponibles</div>
            ) : (
              <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{fontSize:13}}>
                    <thead className="table-light">
                      <tr><th>Período</th><th className="text-end">Devengado</th><th className="text-end">Deducciones</th><th className="text-end">Neto</th><th>Estado</th><th></th></tr>
                    </thead>
                    <tbody>
                      {myRecords.map(r=>(
                        <tr key={r.id}>
                          <td className="fw-semibold">Período {r.period_id}</td>
                          <td className="text-end text-success">{fmt(r.total_devengado)}</td>
                          <td className="text-end text-danger">{fmt(r.total_deducciones)}</td>
                          <td className="text-end fw-bold text-primary">{fmt(r.neto_a_pagar)}</td>
                          <td><span className={`badge ${r.status==='pagado'?'bg-success':'bg-warning text-dark'}`}>{r.status==='pagado'?'✅ Pagado':'⏳ Pendiente'}</span></td>
                          <td><button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={()=>generarDesprendible(r,{period:`P-${r.period_id}`})}>📄 PDF</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ MODALES ═══════════════ */}

        {/* Modal empleado */}
        {empModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">{editingEmp?'✏️ Editar':'👤 Nuevo'} Empleado</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setEmpModal(false)} />
                </div>
                <form onSubmit={handleSaveEmp}>
                  <div className="modal-body">
                    <div className="row g-3">
                      {!editingEmp && (
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Usuario del sistema *</label>
                          <select className="form-select" required value={empForm.user_id} onChange={e=>setEmpForm({...empForm,user_id:e.target.value})}>
                            <option value="">— Seleccionar —</option>
                            {users.filter(u=>!employees.find(e=>e.user_id===u.id)).map(u=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                          </select>
                        </div>
                      )}
                      <div className="col-md-6"><label className="form-label fw-semibold">Cédula *</label><input className="form-control" required value={empForm.cedula} onChange={e=>setEmpForm({...empForm,cedula:e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Cargo</label><input className="form-control" value={empForm.cargo_oficial} onChange={e=>setEmpForm({...empForm,cargo_oficial:e.target.value})} /></div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Tipo contrato *</label>
                        <select className="form-select" value={empForm.tipo_contrato} onChange={e=>setEmpForm({...empForm,tipo_contrato:e.target.value})}>
                          <option value="indefinido">Término indefinido</option>
                          <option value="fijo">Término fijo</option>
                          <option value="obra">Por obra o labor</option>
                          <option value="aprendizaje">Aprendizaje</option>
                          <option value="prestacion_servicios">Prestación de servicios</option>
                        </select>
                      </div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Salario base *</label><div className="input-group"><span className="input-group-text">$</span><input type="number" className="form-control" required min="0" value={empForm.salario_base} onChange={e=>setEmpForm({...empForm,salario_base:e.target.value})} /></div></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Fecha inicio contrato *</label><input type="date" className="form-control" required value={empForm.fecha_inicio_contrato} onChange={e=>setEmpForm({...empForm,fecha_inicio_contrato:e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">EPS</label><input className="form-control" value={empForm.eps} onChange={e=>setEmpForm({...empForm,eps:e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Fondo de pensiones</label><input className="form-control" value={empForm.fondo_pensiones} onChange={e=>setEmpForm({...empForm,fondo_pensiones:e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">ARL</label><input className="form-control" value={empForm.arl} onChange={e=>setEmpForm({...empForm,arl:e.target.value})} /></div>
                      <div className="col-md-4"><label className="form-label fw-semibold">Clase riesgo ARL</label>
                        <select className="form-select" value={empForm.clase_riesgo_arl} onChange={e=>setEmpForm({...empForm,clase_riesgo_arl:parseInt(e.target.value)})}>
                          <option value={1}>I — Riesgo mínimo</option>
                          <option value={2}>II — Riesgo bajo</option>
                          <option value={3}>III — Riesgo medio</option>
                          <option value={4}>IV — Riesgo alto</option>
                          <option value={5}>V — Riesgo máximo</option>
                        </select>
                      </div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Caja de compensación</label><input className="form-control" value={empForm.caja_compensacion} onChange={e=>setEmpForm({...empForm,caja_compensacion:e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Banco</label><input className="form-control" value={empForm.banco} onChange={e=>setEmpForm({...empForm,banco:e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Cuenta bancaria</label><input className="form-control" value={empForm.cuenta_bancaria} onChange={e=>setEmpForm({...empForm,cuenta_bancaria:e.target.value})} /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Teléfono</label><input className="form-control" value={empForm.telefono} onChange={e=>setEmpForm({...empForm,telefono:e.target.value})} /></div>
                      <div className="col-12">
                        <div className="form-check form-switch">
                          <input type="checkbox" className="form-check-input" checked={empForm.tiene_auxilio_transporte} onChange={e=>setEmpForm({...empForm,tiene_auxilio_transporte:e.target.checked})} />
                          <label className="form-check-label">Tiene auxilio de transporte (salario ≤ 2 SMMLV)</label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setEmpModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold">✅ Guardar</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

       {/* Modal nuevo período — reemplazar el modal existente en Nomina.jsx */}
{perModal && (
  <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
    <div className="modal-dialog modal-sm">
      <div className="modal-content">
        <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
          <h5 className="modal-title fw-bold">📅 Nuevo período</h5>
          <button className="btn-close btn-close-white" onClick={()=>setPerModal(false)} />
        </div>
        <form onSubmit={handleCreatePeriod}>
          <div className="modal-body">

            {/* Tipo de período */}
            <label className="form-label fw-semibold">Tipo de período *</label>
            <div className="d-flex gap-2 mb-3">
              <button type="button"
                className={`btn flex-fill fw-bold ${perForm.tipo==='mensual'?'btn-primary':'btn-outline-secondary'}`}
                onClick={()=>setPerForm(f=>({...f, tipo:'mensual', quincena:'1'}))}>
                📅 Mensual
              </button>
              <button type="button"
                className={`btn flex-fill fw-bold ${perForm.tipo==='quincenal'?'btn-primary':'btn-outline-secondary'}`}
                onClick={()=>setPerForm(f=>({...f, tipo:'quincenal'}))}>
                📆 Quincenal
              </button>
            </div>

            {/* Mes */}
            <label className="form-label fw-semibold">Mes (AAAA-MM) *</label>
            <input type="month" className="form-control mb-3" required
              value={perForm.period}
              onChange={e=>setPerForm(f=>({...f, period:e.target.value}))} />

            {/* Quincena — solo si es quincenal */}
            {perForm.tipo === 'quincenal' && (
              <>
                <label className="form-label fw-semibold">Quincena *</label>
                <div className="d-flex gap-2">
                  <button type="button"
                    className={`btn flex-fill fw-bold ${perForm.quincena==='1'?'btn-success':'btn-outline-secondary'}`}
                    onClick={()=>setPerForm(f=>({...f, quincena:'1'}))}>
                    1ª quincena<br/><small>Días 1–15</small>
                  </button>
                  <button type="button"
                    className={`btn flex-fill fw-bold ${perForm.quincena==='2'?'btn-success':'btn-outline-secondary'}`}
                    onClick={()=>setPerForm(f=>({...f, quincena:'2'}))}>
                    2ª quincena<br/><small>Días 16–fin</small>
                  </button>
                </div>

                {/* Vista previa de fechas */}
                {perForm.period && (
                  <div className="alert alert-info py-2 mt-3 small">
                    {(() => {
                      const [y, m] = perForm.period.split('-').map(Number);
                      const lastDay = new Date(y, m, 0).getDate();
                      return perForm.quincena === '1'
                        ? `📅 Del 1 al 15 de ${new Date(y,m-1).toLocaleString('es-CO',{month:'long'})} ${y}`
                        : `📅 Del 16 al ${lastDay} de ${new Date(y,m-1).toLocaleString('es-CO',{month:'long'})} ${y}`;
                    })()}
                  </div>
                )}
              </>
            )}

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary"
              onClick={()=>setPerModal(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary fw-bold">
              ✅ Crear período
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}

        {/* Modal novedad */}
        {novModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">⚠️ Registrar novedad</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setNovModal(false)} />
                </div>
                <form onSubmit={handleSaveNov}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fw-semibold">Empleado *</label>
                        <select className="form-select" required value={novForm.employee_id} onChange={e=>setNovForm({...novForm,employee_id:e.target.value})}>
                          <option value="">— Seleccionar —</option>
                          {employees.filter(e=>e.estado!=='retirado').map(e=><option key={e.id} value={e.id}>{e.user_name}</option>)}
                        </select>
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Tipo de novedad *</label>
                        <select className="form-select" required value={novForm.tipo} onChange={e=>setNovForm({...novForm,tipo:e.target.value})}>
                          {TIPOS_NOVEDAD.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                      {['incapacidad_general','incapacidad_laboral','licencia_maternidad','licencia_paternidad','licencia_no_remunerada','ausencia_injustificada','permiso_remunerado','vacaciones'].includes(novForm.tipo) && (
                        <div className="col-6">
                          <label className="form-label fw-semibold">Días afectados</label>
                          <input type="number" className="form-control" min="1" max="30" value={novForm.dias_afectados} onChange={e=>setNovForm({...novForm,dias_afectados:e.target.value})} />
                        </div>
                      )}
                      {['bonificacion','comision','prestamo','embargo','adelanto'].includes(novForm.tipo) && (
                        <div className="col-6">
                          <label className="form-label fw-semibold">Valor *</label>
                          <div className="input-group"><span className="input-group-text">$</span>
                            <input type="number" className="form-control" min="0" required value={novForm.valor} onChange={e=>setNovForm({...novForm,valor:e.target.value})} />
                          </div>
                        </div>
                      )}
                      <div className="col-12">
                        <label className="form-label fw-semibold">Descripción / observación</label>
                        <textarea className="form-control" rows="2" value={novForm.descripcion} onChange={e=>setNovForm({...novForm,descripcion:e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setNovModal(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary fw-bold">✅ Registrar</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal registrar pago */}
        {payModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header" style={{background:'#1e3a5f',color:'#fff'}}>
                  <h5 className="modal-title fw-bold">💳 Registrar pago</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setPayModal(null)} />
                </div>
                <form onSubmit={handleMarkPaid}>
                  <div className="modal-body">
                    <p>Empleado: <strong>{payModal.employee_name}</strong></p>
                    <p>Neto a pagar: <strong className="text-success">{fmt(payModal.neto_a_pagar)}</strong></p>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Método de pago *</label>
                      <select className="form-select" required value={payForm.metodo_pago} onChange={e=>setPayForm({...payForm,metodo_pago:e.target.value})}>
                        <option value="transferencia">Transferencia bancaria</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="cheque">Cheque</option>
                        <option value="nequi">Nequi</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Referencia / comprobante</label>
                      <input className="form-control" value={payForm.referencia_pago} onChange={e=>setPayForm({...payForm,referencia_pago:e.target.value})} placeholder="Número de transacción..." />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={()=>setPayModal(null)}>Cancelar</button>
                    <button type="submit" className="btn btn-success fw-bold">✅ Marcar como pagado</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Modal liquidación */}
        {liqModal && (
          <div className="modal d-block" style={{background:'rgba(0,0,0,0.5)',zIndex:9999}}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title fw-bold">📋 Liquidación laboral — {liqModal.user_name}</h5>
                  <button className="btn-close btn-close-white" onClick={()=>setLiqModal(null)} />
                </div>
                <div className="modal-body">
                  {liqLoading ? (
                    <div className="text-center py-4"><div className="spinner-border" /></div>
                  ) : liqData && (
                    <>
                      <div className="alert alert-warning">⚠️ Esta acción marcará al empleado como <strong>retirado</strong>.</div>
                      <div className="row g-3">
                        {[
                          ['🕐 Días trabajados total', liqData.dias_trabajados_total + ' días'],
                          ['💵 Último salario', fmt(liqData.ultimo_salario)],
                          ['🏦 Cesantías pendientes', fmt(liqData.cesantias_pendientes)],
                          ['📈 Intereses cesantías', fmt(liqData.intereses_cesantias)],
                          ['🎁 Prima pendiente', fmt(liqData.prima_pendiente)],
                          ['🏖️ Vacaciones pendientes', fmt(liqData.vacaciones_pendientes)],
                          ['⚖️ Indemnización', fmt(liqData.indemnizacion)],
                        ].map(([label,val])=>(
                          <div key={label} className="col-md-4">
                            <div className="card border-0 bg-light text-center py-2">
                              <div className="fw-bold">{val}</div>
                              <div className="text-muted small">{label}</div>
                            </div>
                          </div>
                        ))}
                        <div className="col-12">
                          <div className="card border-danger border-2 text-center py-3">
                            <div className="fw-bold text-danger fs-4">{fmt(liqData.total_liquidacion)}</div>
                            <div className="text-muted">TOTAL LIQUIDACIÓN</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={()=>setLiqModal(null)}>Cancelar</button>
                  {liqData && (
                    <button className="btn btn-danger fw-bold" onClick={handleGuardarLiq}>
                      📋 Confirmar liquidación
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirms */}
        <ConfirmModal
          show={confirmCalc}
          titulo="¿Calcular nómina?"
          tipo="warning"
          mensaje={<>Se calculará la nómina del período <strong>{selPeriod?.period}</strong>. Si ya había un cálculo anterior será reemplazado.</>}
          txtConfirmar="🧮 Sí, calcular"
          onConfirmar={handleCalculate}
          onCancelar={() => setConfirmCalc(false)}
        />
        <ConfirmModal
          show={!!confirmDelNov}
          titulo="¿Eliminar novedad?"
          mensaje={<>Se eliminará la novedad de <strong>{confirmDelNov?.employee_name}</strong>.</>}
          txtConfirmar="Sí, eliminar"
          onConfirmar={() => handleDeleteNov(confirmDelNov.id)}
          onCancelar={() => setConfirmDelNov(null)}
        />

      </main>
    </div>
  );
};

export default Nomina;