from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from services.dian_service import emitir_factura_alegra, verificar_conexion_alegra
import os

dian_bp = Blueprint('dian', __name__)

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')


@dian_bp.route('/estado', methods=['GET'])
@jwt_required()
def estado_dian():
    """Estado de la configuración DIAN."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    enabled    = os.environ.get('ALEGRA_ENABLED', 'false').lower() == 'true'
    configured = bool(os.environ.get('ALEGRA_EMAIL') and os.environ.get('ALEGRA_TOKEN'))

    return jsonify({
        'enabled':      enabled,
        'configured':   configured,
        'resolucion':   os.environ.get('DIAN_RESOLUCION', 'No configurada'),
        'prefijo':      os.environ.get('DIAN_PREFIJO', 'FACT'),
        'proveedor':    'Alegra',
    }), 200


@dian_bp.route('/verificar', methods=['GET'])
@jwt_required()
def verificar_dian():
    """Verificar conexión con Alegra."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403
    resultado = verificar_conexion_alegra()
    return jsonify(resultado), 200 if resultado['ok'] else 400


@dian_bp.route('/emitir/<int:sale_id>', methods=['POST'])
@jwt_required()
def emitir_factura(sale_id):
    """
    Emitir factura electrónica DIAN para una venta existente.
    Body: { tipoDoc, nit, nombre, direccion, telefono }
    """
    from models.sale import Sale
    from models.user import User
    from flask_jwt_extended import get_jwt_identity

    sale = Sale.query.get_or_404(sale_id)
    data = request.get_json() or {}

    if not data.get('nit') or not data.get('nombre'):
        return jsonify({'message': 'NIT y nombre del cliente son obligatorios'}), 400

    user_id = int(get_jwt_identity())
    cashier = User.query.get(user_id)

    resultado = emitir_factura_alegra(
        sale         = sale,
        dian_cliente = data,
        cashier_name = cashier.name if cashier else 'Cajero',
    )

    if resultado['ok']:
        return jsonify(resultado), 200
    return jsonify(resultado), 400