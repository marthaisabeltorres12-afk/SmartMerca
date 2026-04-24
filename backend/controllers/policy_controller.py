from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.business_policy import BusinessPolicy
from extensions import db

def _get_or_create():
    policy = BusinessPolicy.query.first()
    if not policy:
        policy = BusinessPolicy()
        db.session.add(policy)
        db.session.commit()
    return policy

@jwt_required()
def get_policy():
    return jsonify(_get_or_create().to_dict()), 200

@jwt_required()
def update_policy():
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Acceso denegado'}), 403

    policy = _get_or_create()
    data   = request.get_json()

    fields = [
        'return_mode', 'return_reason_required', 'return_max_days',
        'low_stock_threshold', 'expiry_alert_days',
        'business_name', 'business_nit', 'business_phone', 'business_address',
    ]
    for f in fields:
        if f in data:
            setattr(policy, f, data[f])

    db.session.commit()
    return jsonify(policy.to_dict()), 200