from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.user import User
from extensions import db
from utils.audit import log_action
from datetime import datetime

@jwt_required()
def verify_pin():
    data   = request.get_json()
    pin    = str(data.get('pin', '')).strip()
    action = data.get('action', '')
    detail = data.get('detail', '')

    if not pin:
        return jsonify({'message': 'PIN requerido'}), 400

    admins = User.query.filter(
        User.role.in_(['admin', 'admin_tecnico']),
        User.is_active == True,
        User.admin_pin.isnot(None)
    ).all()

    authorized_by = None
    for admin in admins:
        if admin.check_pin(pin):
            authorized_by = admin
            break

    if not authorized_by:
        try:
            log_action('PIN_FAILED', f'PIN incorrecto — Acción: {action} — {detail}')
        except Exception as e:
            import logging
            logging.error(f'Error registrando PIN_FAILED en auditoría: {e}')
        return jsonify({'message': '❌ PIN incorrecto'}), 401

    try:
        log_action(
            'PIN_AUTH',
            f'Autorizado por {authorized_by.name} — Acción: {action} — {detail}',
            autorizador_nombre = authorized_by.name,
            autorizador_rol    = authorized_by.role,
        )
    except Exception as e:
        import logging
        logging.error(f'Error registrando PIN_AUTH en auditoría: {e}')

    return jsonify({
        'authorized': True,
        'admin_name': authorized_by.name,
        'admin_id':   authorized_by.id,
    }), 200


@jwt_required()
def set_pin():
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Solo admins pueden configurar PIN'}), 403

    data = request.get_json()
    pin  = str(data.get('pin', '')).strip()

    if not pin.isdigit() or not (4 <= len(pin) <= 6):
        return jsonify({'message': 'El PIN debe ser de 4 a 6 dígitos numéricos'}), 400

    user = User.query.get(get_jwt_identity())
    user.set_pin(pin)
    db.session.commit()
    return jsonify({'message': '✅ PIN configurado correctamente'}), 200