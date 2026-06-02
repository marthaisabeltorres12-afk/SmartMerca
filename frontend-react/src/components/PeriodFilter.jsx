/**
 * PeriodFilter — Componente reutilizable de filtro de período
 * Igual al que aparece en Reports.jsx del admin.
 * Usado en SupervisorDashboard, ContadorDashboard y AuditorDashboard.
 */
import React from 'react';

const PeriodFilter = ({
  dateFrom, setDateFrom,
  dateTo,   setDateTo,
  timeFrom, setTimeFrom,
  timeTo,   setTimeTo,
  onPDF,    onExcel,
  count,    countLabel = 'registros',
  disableExport = false,
}) => {
  const fmt = d => d.toISOString().slice(0, 10);

  const setPeriod = (key) => {
    const hoy = new Date();
    if (key === 'hoy') {
      setDateFrom(fmt(hoy)); setDateTo(fmt(hoy));
    } else if (key === 'ayer') {
      const ay = new Date(hoy); ay.setDate(ay.getDate() - 1);
      setDateFrom(fmt(ay)); setDateTo(fmt(ay));
    } else if (key === 'semana') {
      const lun = new Date(hoy); lun.setDate(hoy.getDate() - hoy.getDay() + 1);
      setDateFrom(fmt(lun)); setDateTo(fmt(hoy));
    } else if (key === 'mes') {
      setDateFrom(fmt(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
      setDateTo(fmt(hoy));
    } else if (key === 'mes_ant') {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      setDateFrom(fmt(ini)); setDateTo(fmt(fin));
    } else if (key === 'trimestre') {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
      setDateFrom(fmt(ini)); setDateTo(fmt(hoy));
    }
    if (setTimeFrom) setTimeFrom('');
    if (setTimeTo)   setTimeTo('');
  };

  const limpiar = () => {
    setDateFrom(''); setDateTo('');
    if (setTimeFrom) setTimeFrom('');
    if (setTimeTo)   setTimeTo('');
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      <div className="card-body py-3">
        <div className="row g-2 align-items-end">

          {/* Atajos de período */}
          <div className="col-12 mb-1">
            <div className="d-flex gap-1 flex-wrap align-items-center">
              <span className="text-muted small me-1">Período:</span>
              {[
                ['hoy',       'Hoy'],
                ['ayer',      'Ayer'],
                ['semana',    'Esta semana'],
                ['mes',       'Este mes'],
                ['mes_ant',   'Mes pasado'],
                ['trimestre', 'Trimestre'],
              ].map(([key, label]) => (
                <button key={key} className="btn btn-sm btn-outline-secondary rounded-pill py-0 px-2"
                  style={{ fontSize: 12 }}
                  onClick={() => setPeriod(key)}>
                  {label}
                </button>
              ))}
              <button className="btn btn-sm btn-outline-danger rounded-pill py-0 px-2"
                style={{ fontSize: 12, borderColor: '#dc3545' }}
                onClick={limpiar}>
                ✕ Limpiar
              </button>
            </div>
          </div>

          {/* Fecha inicio */}
          <div className="col-md-2 col-6">
            <label className="form-label small fw-semibold mb-1">Fecha inicio</label>
            <input type="date" className="form-control form-control-sm"
              value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>

          {/* Hora inicio */}
          {setTimeFrom && (
            <div className="col-md-2 col-6">
              <label className="form-label small fw-semibold mb-1">Hora inicio</label>
              <input type="time" className="form-control form-control-sm"
                value={timeFrom || ''} onChange={e => setTimeFrom(e.target.value)}
                disabled={!dateFrom} />
            </div>
          )}

          {/* Fecha fin */}
          <div className="col-md-2 col-6">
            <label className="form-label small fw-semibold mb-1">Fecha fin</label>
            <input type="date" className="form-control form-control-sm"
              value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>

          {/* Hora fin */}
          {setTimeTo && (
            <div className="col-md-2 col-6">
              <label className="form-label small fw-semibold mb-1">Hora fin</label>
              <input type="time" className="form-control form-control-sm"
                value={timeTo || ''} onChange={e => setTimeTo(e.target.value)}
                disabled={!dateTo} />
            </div>
          )}

          {/* Badge de resultados */}
          {dateFrom && count !== undefined && (
            <div className="col-auto align-self-end">
              <span className="badge bg-primary py-2" style={{ fontSize: 12 }}>
                {dateFrom} → {dateTo || 'hoy'} · {count} {countLabel}
              </span>
            </div>
          )}

          {/* Botones PDF y Excel */}
          <div className="col-auto align-self-end d-flex gap-2">
            <button
              className="btn btn-danger fw-semibold d-flex align-items-center gap-1"
              onClick={onPDF}
              disabled={disableExport || !dateFrom}>
              <i className="bi bi-file-earmark-pdf-fill"/>  PDF
            </button>
            <button
              className="btn btn-success fw-semibold d-flex align-items-center gap-1"
              onClick={onExcel}
              disabled={disableExport || !dateFrom}>
              <i className="bi bi-file-earmark-excel-fill"/> Excel
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PeriodFilter;