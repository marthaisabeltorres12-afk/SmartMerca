from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.system_config import SystemConfig
from extensions import db

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_config():
    config = SystemConfig.query.first()
    if not config:
        # Crear configuración por defecto si no existe
        config = SystemConfig()
        db.session.add(config)
        db.session.commit()
    return jsonify(config.to_dict()), 200

@jwt_required()
def save_config():
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    config = SystemConfig.query.first()
    if not config:
        config = SystemConfig()
        db.session.add(config)

    if 'min_stock' in data:
        config.min_stock = int(data['min_stock'])
    if 'session_hours' in data:
        config.session_hours = int(data['session_hours'])
    if 'jwt_active' in data:
        config.jwt_active = bool(data['jwt_active'])
    if 'cors_active' in data:
        config.cors_active = bool(data['cors_active'])

    db.session.commit()
    return jsonify(config.to_dict()), 200