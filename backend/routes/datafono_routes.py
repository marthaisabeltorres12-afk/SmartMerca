from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from services.datafono_service import enviar_cobro_datafono, verificar_datafono

datafono_bp = Blueprint('datafono', __name__)


@datafono_bp.route('/estado', methods=['GET'])
@jwt_required()
def estado_datafono():
    """Estado del datáfono."""
    resultado = verificar_datafono()
    return jsonify(resultado), 200


@datafono_bp.route('/cobrar', methods=['POST'])
@jwt_required()
def cobrar():
    """
    Enviar cobro al datáfono.
    Body: { monto, referencia, descripcion? }
    """
    data = request.get_json() or {}
    monto      = float(data.get('monto', 0))
    referencia = str(data.get('referencia', ''))

    if monto <= 0:
        return jsonify({'message': 'Monto inválido'}), 400
    if not referencia:
        return jsonify({'message': 'Referencia requerida'}), 400

    resultado = enviar_cobro_datafono(
        monto       = monto,
        referencia  = referencia,
        descripcion = data.get('descripcion', 'Venta SmartMerca'),
    )

    status = 200 if resultado.get('ok') else 400
    return jsonify(resultado), status