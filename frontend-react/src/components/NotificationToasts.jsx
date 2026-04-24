import React, { useEffect } from 'react';

const TYPE_COLORS = {
  danger:  { bg:'#dc2626', border:'#fca5a5' },
  warning: { bg:'#d97706', border:'#fde68a' },
  info:    { bg:'#2563eb', border:'#93c5fd' },
  success: { bg:'#059669', border:'#6ee7b7' },
};

const NotificationToasts = ({ toasts, onDismiss }) => {
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 360,
    }}>
      {toasts.map(toast => (
        <Toast key={toast.toastId} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const Toast = ({ toast, onDismiss }) => {
  const colors = TYPE_COLORS[toast.type] || TYPE_COLORS.info;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.toastId), 6000);
    return () => clearTimeout(t);
  }, [toast.toastId, onDismiss]);

  return (
    <div style={{
      background: '#1e293b',
      border: `1px solid ${colors.border}`,
      borderLeft: `4px solid ${colors.bg}`,
      borderRadius: 8,
      padding: '12px 16px',
      color: '#f1f5f9',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      animation: 'slideInRight 0.3s ease',
      fontSize: 13,
    }}>
      <i className={`bi ${toast.icon}`} style={{ color: colors.bg, fontSize: 18, marginTop: 1 }}></i>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{toast.title}</div>
        <div style={{ color: '#94a3b8', fontSize: 12 }}>{toast.message}</div>
      </div>
      <button
        onClick={() => onDismiss(toast.toastId)}
        style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:16, padding:0, lineHeight:1 }}>
        ×
      </button>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default NotificationToasts;