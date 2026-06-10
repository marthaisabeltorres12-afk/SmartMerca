import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../services/api';

const PlanContext = createContext({});

export const PLANES_INFO = {
  basico: {
    nombre: 'Básico', precio: 80000,
    limites: { cajas: 1, usuarios: 3, sucursales: 1 },
    color: '#2563eb',
  },
  estandar: {
    nombre: 'Estándar', precio: 150000,
    limites: { cajas: 6, usuarios: 10, sucursales: 2 },
    color: '#16a34a',
  },
  premium: {
    nombre: 'Premium', precio: 250000,
    limites: { cajas: 999, usuarios: 999, sucursales: 999 },
    color: '#7c3aed',
  },
};

const BASICO = [
  'ventas', 'codigo_barras', 'efectivo_nequi_transferencia',
  'pago_mixto', 'presentaciones', 'control_stock',
  'alertas_stock', 'cartera', 'turnos', 'auditoria',
  'backup', 'importar_excel', 'offline', 'pin_autorizacion', 'credito_avanzado',
  'descuentos_temporales', 'clientes_basico',
];

const ESTANDAR = [
  ...BASICO,
  'pin_autorizacion', 'tarjeta_autorizacion', 'etiquetas', 'devoluciones', 'domicilios',
  'promociones', 'cupones', 'ordenes_compra',
  'reportes_excel', 'reportes_pdf', 'dian', 'multicaja',
  'analisis_ventas', 'credito_avanzado', 'listas_precios',
  'supervisor', 'bodeguero', 'sucursales_2',
];

const PREMIUM = [
  ...ESTANDAR,
  'sucursales_ilimitadas', 'cajas_ilimitadas', 'usuarios_ilimitados',
  'contador', 'auditor', 'camara_ia', 'catalogo_qr',
  'bascula', 'datafono', 'dashboard_avanzado',
];

export const PLAN_FEATURES = { basico: BASICO, estandar: ESTANDAR, premium: PREMIUM };

export const PlanProvider = ({ children }) => {
  const { token } = useAuth();
  const [plan, setPlan]           = useState('basico');
  const [planVence, setPlanVence] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiFetch('/system-config/', {}, token)
      .then(cfg => {
        setPlan(cfg.plan_actual || 'basico');
        setPlanVence(cfg.plan_vence || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const diasRestantes = planVence
    ? (() => {
        const [y, m, d] = planVence.split('-').map(Number);
        const vence = new Date(y, m - 1, d); // fecha local sin UTC
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        return Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));
      })()
    : null;

  const hasFeature = (feature) => {
    if (!plan) return false;
    return (PLAN_FEATURES[plan] || BASICO).includes(feature);
  };

  const planVencido = diasRestantes !== null ? diasRestantes < 0 : false;
  const soloLectura = diasRestantes !== null ? diasRestantes < -7 : false;

  const planInfo = PLANES_INFO[plan] || PLANES_INFO.basico;

  return (
    <PlanContext.Provider value={{
      plan, planVence, diasRestantes, planInfo,
      hasFeature, planVencido, soloLectura, loading,
    }}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => useContext(PlanContext);