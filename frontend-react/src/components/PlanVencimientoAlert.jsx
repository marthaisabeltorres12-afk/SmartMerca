import React from 'react';
import { usePlan } from '../context/PlanContext';

const PLAN_NOMBRES = { basico: 'Básico', estandar: 'Estándar', premium: 'Premium' };

const PlanVencimientoAlert = () => {
  const { plan, planVence, diasRestantes, planVencido } = usePlan();

  if (!planVence) return null;
  if (diasRestantes > 3 && !planVencido) return null;

  // Ya venció
  if (planVencido) {
    return (
      <div className="alert mb-4 fw-semibold d-flex align-items-center gap-3"
        style={{
          background: '#fef2f2', border: '1.5px solid #fca5a5',
          borderRadius: 12, color: '#991b1b',
        }}>
        <i className="bi bi-x-circle-fill fs-4 text-danger"></i>
        <div className="flex-grow-1">
          <div className="fw-bold">Tu plan {PLAN_NOMBRES[plan]} venció el {new Date(planVence).toLocaleDateString('es-CO')}</div>
          <div className="small fw-normal">Algunas funciones están bloqueadas. Renueva para recuperar el acceso completo.</div>
        </div>
        <a href="https://smartmerca.com.co#planes" target="_blank" rel="noreferrer"
          className="btn btn-danger btn-sm fw-bold px-3 flex-shrink-0">
          Renovar ahora
        </a>
      </div>
    );
  }

  // Vence en 1-3 días
  const color = diasRestantes <= 1 ? '#fef2f2' : '#fffbeb';
  const borderColor = diasRestantes <= 1 ? '#fca5a5' : '#fde047';
  const textColor = diasRestantes <= 1 ? '#991b1b' : '#854d0e';
  const icon = diasRestantes <= 1 ? 'bi-exclamation-triangle-fill text-danger' : 'bi-clock-fill text-warning';

  return (
    <div className="alert mb-4 fw-semibold d-flex align-items-center gap-3"
      style={{ background: color, border: `1.5px solid ${borderColor}`, borderRadius: 12, color: textColor }}>
      <i className={`bi ${icon} fs-4`}></i>
      <div className="flex-grow-1">
        <div className="fw-bold">
          Tu plan vence {diasRestantes === 0 ? 'hoy' : `en ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`}
          {' '}— {new Date(planVence).toLocaleDateString('es-CO')}
        </div>
        <div className="small fw-normal">Renueva antes de que venza para no perder el acceso a tus módulos.</div>
      </div>
      <a href="https://smartmerca.com.co#planes" target="_blank" rel="noreferrer"
        className="btn btn-warning btn-sm fw-bold px-3 flex-shrink-0 text-dark">
        Renovar plan
      </a>
    </div>
  );
};

export default PlanVencimientoAlert;