const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const apiFetch = async (endpoint, options = {}, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  // Token expirado o inválido — cerrar sesión automáticamente
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    // Solo cerrar sesión si es token expirado, no credenciales incorrectas
    if (endpoint !== '/auth/login' && endpoint !== '/auth/register') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('session-expired'));
    }
    throw new Error(data.message || 'Sesión expirada');
  }

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data.message || 'Error en la solicitud');
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
};