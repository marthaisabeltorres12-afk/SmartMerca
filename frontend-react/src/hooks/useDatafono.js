import { useState, useCallback } from 'react';
 
const useDatafono = (token) => {
  const [procesando, setProcesando] = useState(false);
  const [resultado,  setResultado]  = useState(null);
 
  const cobrar = useCallback(async (monto, referencia) => {
    setProcesando(true);
    setResultado(null);
    try {
      const res  = await fetch('/api/datafono/cobrar', {
        method:  'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` },
        body:    JSON.stringify({ monto, referencia }),
      });
      const data = await res.json();
      setResultado(data);
      return data;
    } catch(e) {
      const err = { ok: false, message: e.message };
      setResultado(err);
      return err;
    } finally {
      setProcesando(false);
    }
  }, [token]);
 
  const limpiar = () => setResultado(null);
 
  return { procesando, resultado, cobrar, limpiar };
};
 
export default useDatafono;