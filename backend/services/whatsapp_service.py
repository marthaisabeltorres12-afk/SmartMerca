import os
import requests
from datetime import datetime

# ── Configuración Meta WhatsApp Cloud API ─────────────────────────────────
# Obtener en: https://developers.facebook.com/apps/
# Variables de entorno necesarias:
#   WHATSAPP_TOKEN     = Token de acceso de Meta
#   WHATSAPP_PHONE_ID  = ID del número de teléfono de WhatsApp Business
#   WHATSAPP_ENABLED   = true/false

WHATSAPP_TOKEN    = os.environ.get('WHATSAPP_TOKEN', '')
WHATSAPP_PHONE_ID = os.environ.get('WHATSAPP_PHONE_ID', '')
WHATSAPP_ENABLED  = os.environ.get('WHATSAPP_ENABLED', 'false').lower() == 'true'

META_API_URL = f'https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}/messages'


def _limpiar_telefono(telefono: str) -> str:
    """Convierte número colombiano a formato internacional E.164."""
    if not telefono:
        return ''
    # Quitar espacios, guiones, paréntesis
    t = ''.join(c for c in str(telefono) if c.isdigit())
    # Colombia: si empieza con 3 (celular) → agregar 57
    if t.startswith('3') and len(t) == 10:
        t = '57' + t
    # Si ya tiene código de país
    if t.startswith('57') and len(t) == 12:
        return t
    return t


def enviar_ticket_whatsapp(sale, customer, cashier_name: str) -> bool:
    """
    Envía el ticket de venta por WhatsApp al cliente.
    Retorna True si se envió, False si falló o no está configurado.
    """
    if not WHATSAPP_ENABLED or not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        print('[WhatsApp] No configurado — saltando envío')
        return False

    if not customer or not customer.phone:
        print('[WhatsApp] Cliente sin teléfono — saltando envío')
        return False

    telefono = _limpiar_telefono(customer.phone)
    if not telefono:
        return False

    # Formatear items
    items_txt = ''
    total = 0
    for item in (sale.items or []):
        qty   = float(item.quantity)
        price = float(item.price)
        sub   = qty * price
        total += sub
        qty_str = f'{qty:.3f} kg' if qty != int(qty) else f'{int(qty)} und'
        items_txt += f'• {item.product_name} x{qty_str} = ${sub:,.0f}\n'

    fecha = datetime.now().strftime('%d/%m/%Y %H:%M')

    # Mensaje de texto enriquecido
    mensaje = (
        f'🛒 *SmartMerca — Ticket de compra*\n'
        f'━━━━━━━━━━━━━━━━━━━━\n'
        f'📅 {fecha}\n'
        f'👤 Cajero: {cashier_name}\n'
        f'🧾 Venta #{str(sale.id).zfill(6)}\n'
        f'━━━━━━━━━━━━━━━━━━━━\n'
        f'{items_txt}'
        f'━━━━━━━━━━━━━━━━━━━━\n'
        f'💰 *TOTAL: ${total:,.0f}*\n'
        f'💳 Pago: {(sale.payment_method or "efectivo").upper()}\n'
        f'━━━━━━━━━━━━━━━━━━━━\n'
        f'¡Gracias por su compra! 🙏\n'
        f'Vuelva pronto 😊'
    )

    payload = {
        'messaging_product': 'whatsapp',
        'recipient_type':    'individual',
        'to':                telefono,
        'type':              'text',
        'text': {
            'preview_url': False,
            'body':        mensaje,
        }
    }

    try:
        res = requests.post(
            META_API_URL,
            headers={
                'Authorization': f'Bearer {WHATSAPP_TOKEN}',
                'Content-Type':  'application/json',
            },
            json=payload,
            timeout=10,
        )
        if res.status_code == 200:
            print(f'[WhatsApp] Ticket enviado a {telefono} — Venta #{sale.id}')
            return True
        else:
            print(f'[WhatsApp] Error {res.status_code}: {res.text}')
            return False
    except Exception as e:
        print(f'[WhatsApp] Exception: {e}')
        return False


def enviar_alerta_stock(producto_nombre: str, stock_actual: int, stock_minimo: int, admin_telefono: str) -> bool:
    """
    Envía alerta de stock bajo al administrador por WhatsApp.
    """
    if not WHATSAPP_ENABLED or not WHATSAPP_TOKEN or not WHATSAPP_PHONE_ID:
        return False

    telefono = _limpiar_telefono(admin_telefono)
    if not telefono:
        return False

    mensaje = (
        f'⚠️ *SmartMerca — Alerta de Stock*\n'
        f'━━━━━━━━━━━━━━━━━━━━\n'
        f'📦 Producto: *{producto_nombre}*\n'
        f'📉 Stock actual: *{stock_actual} unidades*\n'
        f'🔴 Stock mínimo: {stock_minimo} unidades\n'
        f'━━━━━━━━━━━━━━━━━━━━\n'
        f'⚡ Se requiere reabastecimiento urgente.\n'
        f'Ingresa a SmartMerca para hacer el pedido.'
    )

    payload = {
        'messaging_product': 'whatsapp',
        'recipient_type':    'individual',
        'to':                telefono,
        'type':              'text',
        'text': {'preview_url': False, 'body': mensaje}
    }

    try:
        res = requests.post(
            META_API_URL,
            headers={
                'Authorization': f'Bearer {WHATSAPP_TOKEN}',
                'Content-Type':  'application/json',
            },
            json=payload,
            timeout=10,
        )
        return res.status_code == 200
    except Exception as e:
        print(f'[WhatsApp alerta] Exception: {e}')
        return False