import React from 'react';

/**
 * Modal de confirmación reutilizable.
 * Props:
 *   show        - boolean
 *   titulo      - string
 *   mensaje     - string o JSX
 *   tipo        - 'danger' | 'warning' | 'primary' (color del botón confirmar)
 *   txtConfirmar - texto del botón confirmar
 *   txtCancelar  - texto del botón cancelar
 *   onConfirmar - función al confirmar
 *   onCancelar  - función al cancelar
 */
const ConfirmModal = ({
  show,
  titulo = '¿Estás seguro?',
  mensaje = 'Esta acción no se puede deshacer.',
  tipo = 'danger',
  txtConfirmar = 'Sí, confirmar',
  txtCancelar = 'Cancelar',
  onConfirmar,
  onCancelar,
}) => {
  if (!show) return null;

  const iconos = {
    danger:  '🗑️',
    warning: '⚠️',
    primary: '✅',
    success: '✅',
  };

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 99999 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }}>
        <div className="modal-content border-0 shadow">
          <div className={`modal-header bg-${tipo} text-white border-0`}>
            <h5 className="modal-title fw-bold">
              {iconos[tipo] || '❓'} {titulo}
            </h5>
          </div>
          <div className="modal-body py-4">
            <p className="mb-0" style={{ fontSize: 15 }}>{mensaje}</p>
          </div>
          <div className="modal-footer border-0 gap-2">
            <button
              className="btn btn-outline-secondary px-4"
              onClick={onCancelar}
            >
              {txtCancelar}
            </button>
            <button
              className={`btn btn-${tipo} px-4 fw-bold`}
              onClick={onConfirmar}
            >
              {txtConfirmar}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;