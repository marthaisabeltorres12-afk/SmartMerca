from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from services.whatsapp_service import enviar_alerta_stock, _limpiar_telefono
import os

whatsapp_bp = Blueprint('whatsapp', __name__)

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')


@whatsapp_bp.route('/config', methods=['GET'])
@jwt_required()
def get_config():
    """Estado de configuración de WhatsApp."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    return jsonify({
        'enabled':    os.environ.get('WHATSAPP_ENABLED', 'false').lower() == 'true',
        'configured': bool(os.environ.get('WHATSAPP_TOKEN') and os.environ.get('WHATSAPP_PHONE_ID')),
        'phone_id':   os.environ.get('WHATSAPP_PHONE_ID', '')[:8] + '...' if os.environ.get('WHATSAPP_PHONE_ID') else '',
    }), 200


@whatsapp_bp.route('/test', methods=['POST'])
@jwt_required()
def test_whatsapp():
    """Enviar mensaje de prueba."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    data     = request.get_json() or {}
    telefono = data.get('telefono', '')

    if not telefono:
        return jsonify({'message': 'Ingresa un número de teléfono'}), 400

    import requests as req
    token    = os.environ.get('WHATSAPP_TOKEN', '')
    phone_id = os.environ.get('WHATSAPP_PHONE_ID', '')

    if not token or not phone_id:
        return jsonify({'message': 'WhatsApp no configurado. Agrega WHATSAPP_TOKEN y WHATSAPP_PHONE_ID en las variables de entorno.'}), 400

    tel = _limpiar_telefono(telefono)
    payload = {
        'messaging_product': 'whatsapp',
        'recipient_type':    'individual',
        'to':                tel,
        'type':              'text',
        'text': {
            'preview_url': False,
            'body': '✅ *SmartMerca POS*\n\nConexión exitosa con WhatsApp Business API.\n¡Los tickets de venta llegarán automáticamente! 🎉'
        }
    }

    try:
        res = req.post(
            f'https://graph.facebook.com/v19.0/{phone_id}/messages',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json=payload, timeout=10
        )
        if res.status_code == 200:
            return jsonify({'message': f'Mensaje enviado a {telefono}'}), 200
        else:
            return jsonify({'message': f'Error Meta API: {res.text}'}), 400
    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'}), 500


@whatsapp_bp.route('/alerta-stock', methods=['POST'])
@jwt_required()
def alerta_stock_manual():
    """Enviar alerta de stock manualmente."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    data = request.get_json() or {}
    ok = enviar_alerta_stock(
        producto_nombre = data.get('producto', 'Producto'),
        stock_actual    = data.get('stock_actual', 0),
        stock_minimo    = data.get('stock_minimo', 5),
        admin_telefono  = data.get('telefono', ''),
    )
    if ok:
        return jsonify({'message': 'Alerta enviada correctamente'}), 200
    return jsonify({'message': 'Error enviando alerta — verifica configuración'}), 400