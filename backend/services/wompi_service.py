"""
Pasarela de Pagos Wompi — SmartMerca
Para cobrar los planes mensuales a los clientes de SmartMerca.

PARA ACTIVAR — SmartMerca necesita:
1. Registrarse en https://wompi.com (gratis)
2. Tener RUT del negocio y cuenta bancaria
3. Ir a Wompi Dashboard → Desarrolladores → Llaves de API
4. Agregar en variables de entorno:

   WOMPI_PUBLIC_KEY=pub_prod_xxxxxxxxxxxxxxxx
   WOMPI_PRIVATE_KEY=prv_prod_xxxxxxxxxxxxxxxx
   WOMPI_EVENTS_SECRET=prod_events_xxxxxxxxxxxxxxxx
   WOMPI_ENABLED=true

   Para pruebas (sandbox):
   WOMPI_PUBLIC_KEY=pub_test_xxxxxxxxxxxxxxxx
   WOMPI_PRIVATE_KEY=prv_test_xxxxxxxxxxxxxxxx
   WOMPI_ENABLED=true

COMISIÓN: 2.9% + $900 COP por transacción aprobada
Sin mensualidad, sin costo de activación.
"""

import os
import requests
import hashlib
import hmac
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN — SmartMerca llena estas variables
# ══════════════════════════════════════════════════════════════════════
WOMPI_PUBLIC_KEY    = os.environ.get('WOMPI_PUBLIC_KEY',    '')
WOMPI_PRIVATE_KEY   = os.environ.get('WOMPI_PRIVATE_KEY',   '')
WOMPI_EVENTS_SECRET = os.environ.get('WOMPI_EVENTS_SECRET', '')
WOMPI_ENABLED       = os.environ.get('WOMPI_ENABLED', 'false').lower() == 'true'

WOMPI_API_URL = 'https://production.wompi.co/v1'
# Para pruebas usar: 'https://sandbox.wompi.co/v1'


def _headers():
    return {
        'Authorization': f'Bearer {WOMPI_PRIVATE_KEY}',
        'Content-Type':  'application/json',
    }


def crear_link_pago(plan_nombre: str, monto_cop: int, referencia: str, email_cliente: str) -> dict:
    """
    Crea un link de pago Wompi para que el cliente pague un plan.

    Args:
        plan_nombre:   Nombre del plan (ej: "Plan Básico SmartMerca")
        monto_cop:     Monto en COP (ej: 50000)
        referencia:    Referencia única del pago (ej: "PLAN-001-2026")
        email_cliente: Email del cliente para el recibo

    Returns:
        { ok, link_pago, referencia, message }
    """
    if not WOMPI_ENABLED:
        return {'ok': False, 'message': 'Wompi no configurado. Agregar WOMPI_PUBLIC_KEY y WOMPI_PRIVATE_KEY.'}

    if not WOMPI_PUBLIC_KEY or not WOMPI_PRIVATE_KEY:
        return {'ok': False, 'message': 'Credenciales Wompi no configuradas.'}

    try:
        # ══════════════════════════════════════════════════════════════
        # WOMPI: Crear transacción de pago
        # Wompi trabaja en centavos — multiplicar por 100
        # ══════════════════════════════════════════════════════════════
        monto_centavos = monto_cop * 100

        payload = {
            'name':        plan_nombre,
            'description': f'Plan SmartMerca POS — {plan_nombre}',
            'single_use':  True,
            'collect_shipping': False,
            'currency':    'COP',
            'amount_in_cents': monto_centavos,
            'redirect_url': os.environ.get('FRONTEND_URL', 'https://smartmerca.vercel.app') + '/planes/gracias',
            'customer_data': {
                'email': email_cliente,
            },
            'reference': referencia,
        }

        res = requests.post(
            f'{WOMPI_API_URL}/payment_links',
            headers=_headers(),
            json=payload,
            timeout=15,
        )

        if res.status_code in (200, 201):
            data      = res.json().get('data', {})
            link_pago = f'https://checkout.wompi.co/l/{data.get("id", "")}'
            return {
                'ok':         True,
                'link_pago':  link_pago,
                'link_id':    data.get('id'),
                'referencia': referencia,
                'message':    'Link de pago creado correctamente',
            }
        else:
            error = res.json().get('error', {}).get('message', res.text)
            return {'ok': False, 'message': f'Error Wompi: {error}'}

    except Exception as e:
        return {'ok': False, 'message': f'Error: {str(e)}'}


def verificar_pago(referencia: str) -> dict:
    """
    Verifica el estado de un pago por su referencia.
    Retorna { ok, estado, monto, referencia }
    """
    if not WOMPI_ENABLED:
        return {'ok': False, 'message': 'Wompi no configurado'}

    try:
        res = requests.get(
            f'{WOMPI_API_URL}/transactions?reference={referencia}',
            headers=_headers(),
            timeout=10,
        )

        if res.status_code == 200:
            data         = res.json().get('data', [])
            transaccion  = data[0] if data else None
            if not transaccion:
                return {'ok': True, 'estado': 'no_encontrado', 'message': 'Sin transacciones para esta referencia'}

            estado  = transaccion.get('status', '')
            aprobado = estado == 'APPROVED'
            return {
                'ok':         True,
                'aprobado':   aprobado,
                'estado':     estado,
                'monto':      transaccion.get('amount_in_cents', 0) // 100,
                'referencia': referencia,
                'id':         transaccion.get('id'),
            }
        return {'ok': False, 'message': f'Error {res.status_code}'}

    except Exception as e:
        return {'ok': False, 'message': str(e)}


def validar_webhook(signature: str, timestamp: str, body: bytes) -> bool:
    """
    Valida que el webhook viene realmente de Wompi.
    Usar en el endpoint de eventos.
    """
    if not WOMPI_EVENTS_SECRET:
        return True  # Sin secreto configurado, aceptar todo (solo para desarrollo)

    try:
        # Wompi firma: SHA256(timestamp + body + events_secret)
        mensaje  = timestamp.encode() + body + WOMPI_EVENTS_SECRET.encode()
        expected = hashlib.sha256(mensaje).hexdigest()
        return hmac.compare_digest(expected, signature)
    except Exception:
        return False