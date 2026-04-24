from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.cash_adjustment import CashAdjustment
from models.cash_close import CashClose
from models.user import User
from extensions import db
from utils.audit import log_action

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_adjustments():
    """Lista todos los ajustes (solo admin)."""
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    cierre_id = request.args.get('cierre_id', type=int)
    query = CashAdjustment.query.order_by(CashAdjustment.created_at.desc())
    if cierre_id:
        query = query.filter_by(relacionado_a_cierre_id=cierre_id)

    return jsonify([a.to_dict() for a in query.all()]), 200


@jwt_required()
def create_adjustment():
    """
    Registra un ajuste de caja (ingreso o egreso).
    El cierre histórico NO se modifica.
    Si se envía relacionado_a_cierre_id, el ajuste queda vinculado al cierre original.
    """
    claims  = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    user_id = int(get_jwt_identity())
    data    = request.get_json()

    tipo   = data.get('tipo')
    monto  = data.get('monto')
    motivo = data.get('motivo', '').strip()
    relacionado_a_cierre_id = data.get('relacionado_a_cierre_id')
    relacionado_a_turno_id  = data.get('relacionado_a_turno_id')

    # Validaciones básicas
    if tipo not in ('ingreso', 'egreso'):
        return jsonify({'message': "El campo 'tipo' debe ser 'ingreso' o 'egreso'"}), 400
    if not monto or float(monto) <= 0:
        return jsonify({'message': 'El monto debe ser mayor a 0'}), 400
    if not motivo:
        return jsonify({'message': 'El motivo es obligatorio'}), 400

    # Si se relaciona a un cierre, verificar que exista
    if relacionado_a_cierre_id:
        cierre = CashClose.query.get(relacionado_a_cierre_id)
        if not cierre:
            return jsonify({'message': 'Cierre de caja relacionado no encontrado'}), 404

    ajuste = CashAdjustment(
        tipo                    = tipo,
        monto                   = float(monto),
        motivo                  = motivo,
        registrado_por          = user_id,
        relacionado_a_cierre_id = relacionado_a_cierre_id,
        relacionado_a_turno_id  = relacionado_a_turno_id,
    )
    db.session.add(ajuste)
    db.session.flush()

    u = User.query.get(user_id)
    desc = f"Ajuste de caja ({tipo}) por ${float(monto):,.0f}. Motivo: {motivo}"
    if relacionado_a_cierre_id:
        desc += f" | Vinculado al cierre #{relacionado_a_cierre_id}"
    if relacionado_a_turno_id:
        desc += f" | Vinculado al turno #{relacionado_a_turno_id}"

    log_action("ajuste_caja", desc)

    db.session.commit()
    return jsonify(ajuste.to_dict()), 201