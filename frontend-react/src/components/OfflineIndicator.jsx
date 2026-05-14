import React from 'react';
 
const OfflineIndicator = ({ isOnline, pendingCount, syncing, onSync }) => {
  if (isOnline && pendingCount === 0) return null;
 
  return (
    <div style={{
      position:   'fixed',
      bottom:     16,
      right:      16,
      zIndex:     9999,
      background: isOnline ? '#16a34a' : '#dc2626',
      color:      '#fff',
      padding:    '10px 16px',
      borderRadius: 12,
      fontSize:   13,
      fontWeight: 700,
      boxShadow:  '0 4px 20px rgba(0,0,0,0.3)',
      display:    'flex',
      alignItems: 'center',
      gap:        10,
      maxWidth:   280,
    }}>
      <span style={{ fontSize: 18 }}>{isOnline ? '🌐' : '📴'}</span>
      <div>
        <div>{isOnline ? 'Conectado' : 'Sin conexión'}</div>
        {pendingCount > 0 && (
          <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>
            {pendingCount} venta{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      {isOnline && pendingCount > 0 && (
        <button
          onClick={onSync}
          disabled={syncing}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border:     'none',
            color:      '#fff',
            padding:    '4px 10px',
            borderRadius: 8,
            fontSize:   12,
            cursor:     'pointer',
            fontWeight: 700,
          }}>
          {syncing ? '...' : '🔄 Sync'}
        </button>
      )}
    </div>
  );
};
 
export default OfflineIndicator;