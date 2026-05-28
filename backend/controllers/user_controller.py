from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
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
    if 'avatar'     in data: user.avatar     = data['avatar']
    db.session.commit()
    return jsonify(user.to_dict()), 200

@jwt_required()
def _solo_admin_tecnico_puede_gestionar_admins(claims, role_objetivo):
    """Solo admin_tecnico puede crear/editar usuarios con rol admin_tecnico."""
    if role_objetivo in ('admin_tecnico', 'admin_tech'):
        return claims.get('role') in ('admin_tecnico', 'admin_tech')
    return True

def delete_user(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user = User.query.get_or_404(id)

    # Verificar si tiene turnos o ventas
    from sqlalchemy import text
    uid = user.id
    turnos = db.session.execute(
        text("SELECT COUNT(*) FROM shifts WHERE cashier_id = :uid"), {"uid": uid}
    ).scalar() or 0
    ventas = db.session.execute(
        text("SELECT COUNT(*) FROM sales WHERE cashier_id = :uid"), {"uid": uid}
    ).scalar() or 0

    if turnos > 0 or ventas > 0:
        # Desactivar en vez de eliminar
        user.is_active = False
        db.session.commit()
        return jsonify({
            'action':  'deactivated',
            'message': f'"{user.name}" tiene {turnos} turno(s) y {ventas} venta(s) registradas y no puede eliminarse.',
            'detail':  'El usuario fue desactivado y no podrá iniciar sesión, pero se conserva su historial.',
            'turnos':  turnos,
            'ventas':  ventas,
        }), 200

    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Usuario eliminado'}), 200

@jwt_required()
def update_my_avatar():
    """Permite a cualquier usuario actualizar su propia foto de perfil."""
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    data    = request.get_json() or {}
    avatar  = data.get('avatar', '')
    if not avatar:
        return jsonify({'message': 'Avatar requerido'}), 400
    # Validar tamaño (max 2MB en base64 ~= 2.7MB string)
    if len(avatar) > 3_000_000:
        return jsonify({'message': 'La imagen es demasiado grande. Máximo 2MB'}), 400
    user.avatar = avatar
    db.session.commit()
    return jsonify({'message': 'Avatar actualizado', 'avatar': user.avatar}), 200