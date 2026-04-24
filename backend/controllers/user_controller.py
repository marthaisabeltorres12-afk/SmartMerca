from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.user import User
from extensions import db

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_users():
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

@jwt_required()
def get_user(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user = User.query.get_or_404(id)
    return jsonify(user.to_dict()), 200

@jwt_required()
def create_user():
    claims = get_jwt()
    role_creator = claims.get('role')
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Correo ya registrado'}), 400

    # Admin técnico puede crear cualquier rol
    # Admin de tienda puede crear todos los roles excepto admin_tecnico
    role = data.get('role', 'cajero')
    allowed = ['admin_tecnico','admin','cajero','bodeguero','supervisor','contador','auditor']
    if role not in allowed:
        role = 'cajero'
    if role_creator == 'admin' and role == 'admin_tecnico':
        return jsonify({'message': 'No puedes crear administradores técnicos'}), 403

    user = User(
        name      = data['name'],
        email     = data['email'],
        role      = role,
        is_active = data.get('is_active', True),
        approved  = True  # creado por admin = aprobado automáticamente
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@jwt_required()
def approve_user(id):
    claims = get_jwt()
    role_approver = claims.get('role')

    user = User.query.get_or_404(id)

    # Admin técnico aprueba todo
    # Admin de tienda aprueba cajeros y otros admins de tienda
    if role_approver == 'admin_tecnico' and user.role != 'admin_tecnico':
        user.approved = True
    elif role_approver == 'admin' and user.role in ('cajero', 'admin'):
        user.approved = True
    else:
        return jsonify({'message': 'No tienes permiso para aprobar este rol'}), 403

    db.session.commit()
    return jsonify(user.to_dict()), 200

@jwt_required()
def reject_user(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user = User.query.get_or_404(id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Usuario rechazado y eliminado'}), 200

@jwt_required()
def update_user(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user = User.query.get_or_404(id)
    data = request.get_json()
    if 'password' in data and data['password']:
        user.set_password(data.pop('password'))
    else:
        data.pop('password', None)
    if 'name'      in data: user.name      = data['name']
    if 'email'     in data: user.email     = data['email']
    if 'role'      in data: user.role      = data['role']
    if 'is_active' in data: user.is_active = bool(data['is_active'])
    if 'approved'  in data: user.approved  = bool(data['approved'])
    db.session.commit()
    return jsonify(user.to_dict()), 200

@jwt_required()
def delete_user(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user = User.query.get_or_404(id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Usuario eliminado'}), 200