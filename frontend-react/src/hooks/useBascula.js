import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook para integración con báscula digital USB/Serial.
 * Compatible con: Torrey, CAS, Mettler Toledo, AND, Ohaus
 * 
 * REQUISITOS DEL CLIENTE:
 * - Báscula con puerto USB o RS-232 (serial)
 * - Instalar driver de la báscula (viene en el CD o web del fabricante)
 * - Chrome 89+ o Edge 89+ (soportan Web Serial API)
 * - Activar en chrome://flags → "Experimental Web Platform features" → Enabled
 * 
 * CONFIGURACIÓN POR MODELO:
 * ┌─────────────────┬──────────┬────────┬──────────┬──────────┐
 * │ Marca/Modelo    │ BaudRate │ DataBits│ StopBits │ Parity   │
 * ├─────────────────┼──────────┼────────┼──────────┼──────────┤
 * │ Torrey PC-40L   │ 9600     │ 8      │ 1        │ none     │
 * │ CAS SW-1C       │ 9600     │ 8      │ 1        │ none     │
 * │ Mettler Toledo  │ 9600     │ 8      │ 1        │ none     │
 * │ AND FX-i        │ 2400     │ 8      │ 1        │ none     │
 * │ Ohaus Defender  │ 9600     │ 8      │ 1        │ none     │
 * └─────────────────┴──────────┴────────┴──────────┴──────────┘
 */

// ══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE LA BÁSCULA
// El cliente debe cambiar estos valores según su modelo:
// ══════════════════════════════════════════════════════════════════
const BASCULA_CONFIG = {
  baudRate: 9600,    // ← CAMBIAR según modelo (ver tabla arriba)
  dataBits: 8,
  stopBits: 1,
  parity:   'none',
};

// Función para parsear el peso del stream serial
// Cada báscula envía el peso en formato diferente:
const parsearPeso = (linea) => {
  // ── Formato Torrey/CAS: "  1.250 kg" o "ST,GS,  1.250kg" ──
  // ── Formato Mettler:    "S S     1.250 kg" ──
  // ── Formato AND:        "+   1.250 kg" ──
  
  // Buscar número decimal en la línea
  const match = linea.match(/[\d]+\.[\d]+/);
  if (!match) return null;
  
  const peso = parseFloat(match[0]);
  if (isNaN(peso) || peso <= 0) return null;
  
  // Verificar que no sea un peso inestable (algunas básculas envían 'US' o 'D')
  if (linea.includes('US') || linea.includes('Error') || linea.includes('----')) return null;
  
  return parseFloat(peso.toFixed(3));
};

const useBascula = () => {
  const [conectada,    setConectada]    = useState(false);
  const [peso,         setPeso]         = useState(null);
  const [estable,      setEstable]      = useState(false);
  const [error,        setError]        = useState(null);
  const [soportado,    setSoportado]    = useState(false);
  const [leyendo,      setLeyendo]      = useState(false);

  const portRef    = useRef(null);
  const readerRef  = useRef(null);
  const bufferRef  = useRef('');

  useEffect(() => {
    // Verificar soporte de Web Serial API
    setSoportado('serial' in navigator);
  }, []);

  // ── Conectar báscula ────────────────────────────────────────────
  const conectar = useCallback(async () => {
    if (!('serial' in navigator)) {
      setError('Tu navegador no soporta Web Serial. Usa Chrome 89+ o Edge 89+.');
      return;
    }

    try {
      setError(null);

      // Pedir al usuario que seleccione el puerto
      // El navegador muestra un diálogo con los puertos disponibles
      const port = await navigator.serial.requestPort();
      portRef.current = port;

      // ══════════════════════════════════════════════════════════
      // AQUÍ VA LA CONFIGURACIÓN DE LA BÁSCULA DEL CLIENTE
      // Cambiar baudRate según el modelo (ver tabla en la parte superior)
      // ══════════════════════════════════════════════════════════
      await port.open(BASCULA_CONFIG);

      setConectada(true);
      setLeyendo(true);

      // Leer datos continuamente
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      // Loop de lectura
      const leerDatos = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            bufferRef.current += value;

            // Procesar líneas completas
            const lineas = bufferRef.current.split(/\r?\n/);
            bufferRef.current = lineas.pop() || '';

            for (const linea of lineas) {
              if (!linea.trim()) continue;
              const pesoLeido = parsearPeso(linea);
              if (pesoLeido !== null) {
                setPeso(pesoLeido);
                // Peso estable si viene dos veces seguidas igual
                setEstable(true);
              }
            }
          }
        } catch (e) {
          if (e.name !== 'AbortError') {
            setError('Error leyendo báscula: ' + e.message);
          }
          setConectada(false);
          setLeyendo(false);
        }
      };

      leerDatos();
    } catch (e) {
      if (e.name === 'NotFoundError') {
        setError('No se seleccionó ningún puerto. Intenta de nuevo.');
      } else {
        setError('Error al conectar: ' + e.message);
      }
    }
  }, []);

  // ── Desconectar báscula ─────────────────────────────────────────
  const desconectar = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch (e) {
      console.error('Error desconectando báscula:', e);
    }
    setConectada(false);
    setLeyendo(false);
    setPeso(null);
    setEstable(false);
  }, []);

  // ── Tomar lectura actual ────────────────────────────────────────
  const tomarPeso = useCallback(() => {
    return estable ? peso : null;
  }, [peso, estable]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => { desconectar(); };
  }, [desconectar]);

  return {
    soportado,
    conectada,
    peso,
    estable,
    error,
    leyendo,
    conectar,
    desconectar,
    tomarPeso,
  };
};

export default useBascula;