"""
Servicio de Datáfono Integrado — SmartMerca
Integración con Getnet (Bancolombia) y Redeban

PARA ACTIVAR — El cliente necesita:
1. Tener datáfono físico Getnet o Redeban
2. Solicitar al banco las credenciales de integración:
   - Getnet (Bancolombia): https://getnet.co → Solicitar SDK
   - Redeban: https://redeban.com → Contactar ejecutivo comercial
3. Agregar en variables de entorno del servidor:

   === GETNET (BANCOLOMBIA) ===
   DATAFONO_PROVEEDOR=getnet
   GETNET_MERCHANT_ID=tu-merchant-id-aqui
   GETNET_TERMINAL_ID=tu-terminal-id-aqui
   GETNET_API_KEY=tu-api-key-aqui
   GETNET_ENABLED=true

   === REDEBAN ===
   DATAFONO_PROVEEDOR=redeban
   REDEBAN_MERCHANT_ID=tu-merchant-id-aqui
   REDEBAN_TERMINAL_ID=tu-terminal-id-aqui
   REDEBAN_API_KEY=tu-api-key-aqui
   REDEBAN_ENABLED=true

NOTA: Sin estas credenciales, SmartMerca funciona en modo manual
(el cajero confirma manualmente que el datáfono aprobó el pago).
"""

import os
import requests
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN — El cliente llena estas variables cuando tenga el SDK
# ══════════════════════════════════════════════════════════════════════
DATAFONO_PROVEEDOR = os.environ.get('DATAFONO_PROVEEDOR', '')  # 'getnet' o 'redeban'
GETNET_ENABLED     = os.environ.get('GETNET_ENABLED',  'false').lower() == 'true'
REDEBAN_ENABLED    = os.environ.get('REDEBAN_ENABLED', 'false').lower() == 'true'

# Getnet (Bancolombia)
GETNET_MERCHANT_ID = os.environ.get('GETNET_MERCHANT_ID', '')
GETNET_TERMINAL_ID = os.environ.get('GETNET_TERMINAL_ID', '')
GETNET_API_KEY     = os.environ.get('GETNET_API_KEY',     '')
GETNET_API_URL     = 'https://api.getnet.co/v1'  # ← URL real del SDK Getnet

# Redeban
REDEBAN_MERCHANT_ID = os.environ.get('REDEBAN_MERCHANT_ID', '')
REDEBAN_TERMINAL_ID = os.environ.get('REDEBAN_TERMINAL_ID', '')
REDEBAN_API_KEY     = os.environ.get('REDEBAN_API_KEY',     '')
REDEBAN_API_URL     = 'https://api.redeban.com/v1'  # ← URL real del SDK Redeban


def enviar_cobro_datafono(monto: float, referencia: str, descripcion: str = 'Venta SmartMerca') -> dict:
    """
    Envía el monto al datáfono para que el cliente pase la tarjeta.

    Args:
        monto:      Valor a cobrar en COP
        referencia: Número de venta o referencia única
        descripcion: Descripción del cobro

    Returns:
        { ok, aprobado, codigo_autorizacion, referencia_banco, message }
    """
    if GETNET_ENABLED and DATAFONO_PROVEEDOR == 'getnet':
        return _cobrar_getnet(monto, referencia, descripcion)
    elif REDEBAN_ENABLED and DATAFONO_PROVEEDOR == 'redeban':
        return _cobrar_redeban(monto, referencia, descripcion)
    else:
        # Modo manual — el cajero confirma manualmente
        return {
            'ok':       True,
            'manual':   True,
            'aprobado': None,
            'message':  'Datáfono en modo manual — confirmar pago físicamente',
        }


def _cobrar_getnet(monto: float, referencia: str, descripcion: str) -> dict:
    """
    Integración con Getnet (Bancolombia).
    
    ══════════════════════════════════════════════════════════════════
    PARA EL CLIENTE:
    Solicitar el SDK completo en https://getnet.co/desarrolladores
    o llamar al 01 8000 931 551 (Bancolombia empresas)
    El SDK incluye la documentación de endpoints y ejemplos.
    ══════════════════════════════════════════════════════════════════
    """
    if not GETNET_MERCHANT_ID or not GETNET_API_KEY:
        return {'ok': False, 'message': 'Credenciales Getnet no configuradas'}

    try:
        # ══════════════════════════════════════════════════════════
        # ENDPOINT GETNET — Reemplazar con el endpoint real del SDK
        # cuando el cliente tenga las credenciales
        # ══════════════════════════════════════════════════════════
        payload = {
            'merchantId':  GETNET_MERCHANT_ID,
            'terminalId':  GETNET_TERMINAL_ID,
            'amount':      int(monto),           # Getnet usa centavos o pesos según versión SDK
            'currency':    'COP',
            'reference':   referencia,
            'description': descripcion,
            'transactionType': 'SALE',
        }

        res = requests.post(
            f'{GETNET_API_URL}/transactions/sale',
            headers={
                'Authorization': f'Bearer {GETNET_API_KEY}',
                'Content-Type':  'application/json',
            },
            json=payload,
            timeout=30,  # Datáfonos pueden tardar hasta 30s
        )

        if res.status_code == 200:
            data = res.json()
            aprobado = data.get('status') in ('APPROVED', 'APROBADO', '00')
            return {
                'ok':                  True,
                'aprobado':            aprobado,
                'codigo_autorizacion': data.get('authorizationCode', ''),
                'referencia_banco':    data.get('bankReference', ''),
                'message':             'Aprobado' if aprobado else data.get('responseMessage', 'Rechazado'),
            }
        return {'ok': False, 'message': f'Error Getnet {res.status_code}: {res.text}'}

    except requests.exceptions.Timeout:
        return {'ok': False, 'message': 'El datáfono no respondió. Verifica que esté encendido y conectado.'}
    except Exception as e:
        return {'ok': False, 'message': f'Error: {str(e)}'}


def _cobrar_redeban(monto: float, referencia: str, descripcion: str) -> dict:
    """
    Integración con Redeban.
    
    ══════════════════════════════════════════════════════════════════
    PARA EL CLIENTE:
    Contactar ejecutivo comercial Redeban: https://redeban.com
    o llamar al (601) 338 9999
    Solicitar integración API para punto de venta.
    ══════════════════════════════════════════════════════════════════
    """
    if not REDEBAN_MERCHANT_ID or not REDEBAN_API_KEY:
        return {'ok': False, 'message': 'Credenciales Redeban no configuradas'}

    try:
        # ══════════════════════════════════════════════════════════
        # ENDPOINT REDEBAN — Reemplazar con el endpoint real del SDK
        # cuando el cliente tenga las credenciales
        # ══════════════════════════════════════════════════════════
        payload = {
            'merchant_id': REDEBAN_MERCHANT_ID,
            'terminal_id': REDEBAN_TERMINAL_ID,
            'amount':      int(monto * 100),     # Redeban usa centavos
            'currency':    '170',                # 170 = COP en ISO 4217
            'reference':   referencia,
            'type':        'sale',
        }

        res = requests.post(
            f'{REDEBAN_API_URL}/payment/sale',
            headers={
                'x-api-key':    REDEBAN_API_KEY,
                'Content-Type': 'application/json',
            },
            json=payload,
            timeout=30,
        )

        if res.status_code == 200:
            data     = res.json()
            aprobado = data.get('response_code') == '00'
            return {
                'ok':                  True,
                'aprobado':            aprobado,
                'codigo_autorizacion': data.get('auth_code', ''),
                'referencia_banco':    data.get('rrn', ''),
                'message':             'Aprobado' if aprobado else data.get('response_message', 'Rechazado'),
            }
        return {'ok': False, 'message': f'Error Redeban {res.status_code}: {res.text}'}

    except requests.exceptions.Timeout:
        return {'ok': False, 'message': 'El datáfono no respondió.'}
    except Exception as e:
        return {'ok': False, 'message': f'Error: {str(e)}'}


def verificar_datafono() -> dict:
    """Verifica el estado del datáfono."""
    if GETNET_ENABLED:
        return {'proveedor': 'Getnet', 'configurado': bool(GETNET_MERCHANT_ID), 'activo': True}
    elif REDEBAN_ENABLED:
        return {'proveedor': 'Redeban', 'configurado': bool(REDEBAN_MERCHANT_ID), 'activo': True}
    return {'proveedor': None, 'configurado': False, 'activo': False, 'message': 'Datáfono en modo manual'}