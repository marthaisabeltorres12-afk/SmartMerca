"""
Servicio de Facturación Electrónica DIAN Real — SmartMerca
Integración con Alegra API (proveedor tecnológico autorizado DIAN)

PARA ACTIVAR — El cliente necesita:
1. Cuenta en Alegra (https://alegra.com) — desde $59.000 COP/mes
2. Ir a Alegra → Configuración → API → Copiar:
   - Email de la cuenta Alegra
   - Token de API
3. Agregar en variables de entorno del servidor:
   ALEGRA_EMAIL=correo@delcliente.com
   ALEGRA_TOKEN=el-token-de-api-aqui
   ALEGRA_ENABLED=true

ALTERNATIVA SIIGO:
   SIIGO_USER=usuario
   SIIGO_ACCESS_KEY=clave-de-acceso
   SIIGO_ENABLED=true
"""

import os
import requests
import base64
from datetime import datetime

# ══════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN — El cliente llena estas variables de entorno
# ══════════════════════════════════════════════════════════════════════
ALEGRA_EMAIL   = os.environ.get('ALEGRA_EMAIL',   '')
ALEGRA_TOKEN   = os.environ.get('ALEGRA_TOKEN',   '')
ALEGRA_ENABLED = os.environ.get('ALEGRA_ENABLED', 'false').lower() == 'true'

ALEGRA_API_URL = 'https://api.alegra.com/api/v1'

# Número de resolución DIAN del cliente
# ══════════════════════════════════════════════════════════════════════
# PARA EL CLIENTE: Ingresar el número de resolución DIAN aquí
# o en variables de entorno DIAN_RESOLUCION y DIAN_PREFIJO
# ══════════════════════════════════════════════════════════════════════
DIAN_RESOLUCION = os.environ.get('DIAN_RESOLUCION', '18764050366042')
DIAN_PREFIJO    = os.environ.get('DIAN_PREFIJO',    'FACT')


def _get_auth_headers():
    """Genera headers de autenticación para Alegra API."""
    credentials = f'{ALEGRA_EMAIL}:{ALEGRA_TOKEN}'
    encoded     = base64.b64encode(credentials.encode()).decode()
    return {
        'Authorization': f'Basic {encoded}',
        'Content-Type':  'application/json',
    }


def emitir_factura_alegra(sale, dian_cliente: dict, cashier_name: str) -> dict:
    """
    Emite una factura electrónica real en Alegra y la reporta a la DIAN.

    Args:
        sale: objeto Sale con los items de la venta
        dian_cliente: { tipoDoc, nit, nombre, direccion, telefono }
        cashier_name: nombre del cajero

    Returns:
        { ok, numero_factura, cufe, pdf_url, message }
    """
    if not ALEGRA_ENABLED:
        return {'ok': False, 'message': 'Facturación DIAN no configurada. Agregar ALEGRA_EMAIL y ALEGRA_TOKEN.'}

    if not ALEGRA_EMAIL or not ALEGRA_TOKEN:
        return {'ok': False, 'message': 'Credenciales de Alegra no configuradas.'}

    try:
        # ── 1. Buscar o crear cliente en Alegra ───────────────────────
        cliente_alegra_id = _buscar_o_crear_cliente_alegra(dian_cliente)

        # ── 2. Construir items de la factura ──────────────────────────
        items_factura = []
        for item in (sale.items or []):
            items_factura.append({
                'id':       item.product_id,
                'name':     item.product_name,
                'quantity': float(item.quantity),
                'price':    float(item.price),
                'tax':      [],  # Sin IVA por defecto — ajustar según el producto
            })

        # ── 3. Crear factura en Alegra ────────────────────────────────
        payload = {
            'date':         datetime.now().strftime('%Y-%m-%d'),
            'dueDate':      datetime.now().strftime('%Y-%m-%d'),
            'client':       {'id': cliente_alegra_id},
            'items':        items_factura,
            'paymentMethod': 'cash',
            'observations': f'Venta #{sale.id} — Cajero: {cashier_name}',
            'stamp': {
                # ══════════════════════════════════════════════════════
                # DATOS DE RESOLUCIÓN DIAN DEL CLIENTE
                # Alegra los toma automáticamente si están configurados
                # en la cuenta. Si no, agregar aquí:
                # 'generateStamp': True,
                # ══════════════════════════════════════════════════════
                'generateStamp': True,
            }
        }

        response = requests.post(
            f'{ALEGRA_API_URL}/invoices',
            headers=_get_auth_headers(),
            json=payload,
            timeout=15,
        )

        if response.status_code in (200, 201):
            data           = response.json()
            numero_factura = data.get('numberTemplate', {}).get('fullNumber', str(sale.id))
            cufe           = data.get('stamp', {}).get('cufe', '')
            pdf_url        = data.get('pdf', '')

            print(f'[DIAN Alegra] Factura {numero_factura} emitida — CUFE: {cufe}')
            return {
                'ok':             True,
                'numero_factura': numero_factura,
                'cufe':           cufe,
                'pdf_url':        pdf_url,
                'message':        f'Factura {numero_factura} emitida correctamente',
            }
        else:
            error_msg = response.json().get('message', response.text)
            print(f'[DIAN Alegra] Error {response.status_code}: {error_msg}')
            return {'ok': False, 'message': f'Error Alegra: {error_msg}'}

    except requests.exceptions.Timeout:
        return {'ok': False, 'message': 'Alegra no respondió. Verifica tu conexión.'}
    except Exception as e:
        print(f'[DIAN Alegra] Exception: {e}')
        return {'ok': False, 'message': f'Error al emitir factura: {str(e)}'}


def _buscar_o_crear_cliente_alegra(dian_cliente: dict) -> int:
    """Busca el cliente en Alegra por NIT, o lo crea si no existe."""
    nit = dian_cliente.get('nit', '')

    # Buscar cliente existente
    try:
        res = requests.get(
            f'{ALEGRA_API_URL}/contacts',
            headers=_get_auth_headers(),
            params={'identification': nit},
            timeout=10,
        )
        if res.status_code == 200:
            contactos = res.json()
            if contactos:
                return contactos[0]['id']
    except Exception:
        pass

    # Crear cliente nuevo
    tipo_doc_map = {
        'NIT': 'NIT', 'CC': 'CC', 'CE': 'CE', 'Pasaporte': 'PASSPORT'
    }
    payload = {
        'name':           dian_cliente.get('nombre', 'Consumidor Final'),
        'identification': nit,
        'identificationObject': {
            'type':   tipo_doc_map.get(dian_cliente.get('tipoDoc', 'CC'), 'CC'),
            'number': nit,
        },
        'address': { 'address': dian_cliente.get('direccion', '') },
        'phone':    dian_cliente.get('telefono', ''),
        'type':    ['client'],
    }

    res = requests.post(
        f'{ALEGRA_API_URL}/contacts',
        headers=_get_auth_headers(),
        json=payload,
        timeout=10,
    )

    if res.status_code in (200, 201):
        return res.json()['id']

    # Si falla, usar cliente genérico de Alegra (ID 1 = Consumidor Final)
    return 1


def verificar_conexion_alegra() -> dict:
    """Verifica que las credenciales de Alegra sean válidas."""
    if not ALEGRA_EMAIL or not ALEGRA_TOKEN:
        return {'ok': False, 'message': 'Credenciales no configuradas'}
    try:
        res = requests.get(
            f'{ALEGRA_API_URL}/company',
            headers=_get_auth_headers(),
            timeout=10,
        )
        if res.status_code == 200:
            empresa = res.json()
            return {
                'ok':      True,
                'empresa': empresa.get('name', ''),
                'nit':     empresa.get('identification', ''),
                'message': 'Conexión exitosa con Alegra',
            }
        return {'ok': False, 'message': f'Error {res.status_code}: {res.text}'}
    except Exception as e:
        return {'ok': False, 'message': str(e)}