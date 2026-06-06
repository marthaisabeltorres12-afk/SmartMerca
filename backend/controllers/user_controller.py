from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.user import User
from extensions import db

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

def _can_read_users(claims):
    # Admins y auditor pueden VER usuarios (auditor solo lectura)
    return claims.get('role') in ('admin', 'admin_tecnico', 'auditor')

@jwt_required()
def get_users():
    claims = get_jwt()
    if not _can_read_users(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

@jwt_required()
def get_user(id):
    claims = get_jwt()
    if not _can_read_users(claims):
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

    role = data.get('role', 'cajero')
    allowed = ['admin_tecnico','admin','cajero','bodeguero','supervisor','contador','auditor']
    if role not in allowed:
        role = 'cajero'
    if role_creator == 'admin' and role == 'admin_tecnico':
        return jsonify({'message': 'No puedes crear administradores técnicos'}), 403

    user = User(
        name       = data['name'],
        email      = data['email'],
        role       = role,
        is_active  = data.get('is_active', True),
        approved   = True,
        phone      = data.get('phone', ''),
        address    = data.get('address', ''),
        doc_type   = data.get('doc_type', 'CC'),
        doc_number = data.get('doc_number', ''),
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

    if 'name' in data:
        user.name = data['name']

    if 'email' in data:
        existing_user = User.query.filter(
            User.email == data['email'],
            User.id != user.id
        ).first()

        if existing_user:
            return jsonify({
                'message': 'El correo electrónico ya está en uso'
            }), 400

        user.email = data['email']

    if 'role' in data:
        user.role = data['role']

    if 'is_active' in data:
        user.is_active = bool(data['is_active'])

    if 'approved' in data:
        user.approved = bool(data['approved'])

    if 'avatar' in data:
        user.avatar = data['avatar']

    if 'phone' in data:
        user.phone = data.get('phone', '')

    if 'address' in data:
        user.address = data.get('address', '')

    if 'doc_type' in data:
        user.doc_type = data.get('doc_type', 'CC')

    if 'doc_number' in data:
        user.doc_number = data.get('doc_number', '')

    db.session.commit()
    return jsonify(user.to_dict()), 200
@jwt_required()
def _solo_admin_tecnico_puede_gestionar_admins(claims, role_objetivo):
    if role_objetivo in ('admin_tecnico', 'admin_tech'):
        return claims.get('role') in ('admin_tecnico', 'admin_tech')
    return True

@jwt_required()
def delete_user(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user = User.query.get_or_404(id)

    from sqlalchemy import text
    uid = user.id
    turnos = db.session.execute(
        text("SELECT COUNT(*) FROM shifts WHERE cashier_id = :uid"), {"uid": uid}
    ).scalar() or 0
    ventas = db.session.execute(
        text("SELECT COUNT(*) FROM sales WHERE cashier_id = :uid"), {"uid": uid}
    ).scalar() or 0

    if turnos > 0 or ventas > 0:
        user.is_active = False
        db.session.commit()
        return jsonify({
            'action':  'deactivated',
            'message': f'"{user.name}" tiene {turnos} turno(s) y {ventas} venta(s) y no puede eliminarse.',
            'detail':  'El usuario fue desactivado. Se conserva su historial.',
            'turnos':  turnos,
            'ventas':  ventas,
        }), 200

    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Usuario eliminado'}), 200

@jwt_required()
def update_my_avatar():
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    data    = request.get_json() or {}
    avatar  = data.get('avatar', '')
    if not avatar:
        return jsonify({'message': 'Avatar requerido'}), 400
    if len(avatar) > 3_000_000:
        return jsonify({'message': 'La imagen es demasiado grande. Máximo 2MB'}), 400
    user.avatar = avatar
    db.session.commit()
    return jsonify({'message': 'Avatar actualizado', 'avatar': user.avatar}), 200