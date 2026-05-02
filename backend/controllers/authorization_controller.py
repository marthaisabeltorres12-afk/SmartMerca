from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.user import User
from models.admin_card import AdminCard
from models.audit_log import AuditLog
from extensions import db
from datetime import datetime

# ── Tipos de operación ─────────────────────────────────────────────────────
OPERACIONES = {
    'eliminar_producto': 'cualquiera',
    'cancelar_venta':    'cualquiera',
    'editar_precio':     'cualquiera',
    'devolucion':        'cualquiera',
    'descuento_manual':  'cualquiera',
    'reset_password':    'ambos',
}

def _log(user_id, operacion, exitoso, detalle=''):
    try:
        log = AuditLog(
            user_id        = user_id,
            usuario_nombre = 'Sistema',
            rol            = 'sistema',
            accion         = 'autorizar' if exitoso else 'autorizar_fallo',
            descripcion    = f"Op: {operacion} — {'OK' if exitoso else 'FALLO'} {detalle}",
            fecha_hora     = datetime.now(),
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        pass

def verificar_autorizacion_admin(pin=None, codigo_tarjeta=None, tipo_operacion='eliminar_producto'):
    """
    Función central de autorización.
    Retorna (True, admin_user) o (False, mensaje_error).
    """
    modo = OPERACIONES.get(tipo_operacion, 'cualquiera')

    admins = User.query.filter(
        User.role.in_(['admin', 'admin_tecnico']),
        User.is_active == True,
        User.admin_pin != None
    ).all()

    if not admins:
        return False, 'No hay administradores con PIN configurado'

    pin_ok     = False
    tarjeta_ok = False
    admin_auth = None

    if pin:
        for admin in admins:
            if admin.check_pin(str(pin)):
                pin_ok = True
                admin_auth = admin
                break

    if codigo_tarjeta:
        card = AdminCard.query.filter_by(
            code=codigo_tarjeta.strip(), is_active=True
        ).first()
        if card:
            tarjeta_ok = True
            admin_auth = card.admin

    if modo == 'ambos':
        if pin_ok and tarjeta_ok:
            _log(admin_auth.id if admin_auth else None, tipo_operacion, True)
            return True, admin_auth
        faltante = []
        if not pin_ok:     faltante.append('PIN')
        if not tarjeta_ok: faltante.append('código de tarjeta')
        _log(None, tipo_operacion, False, f"Faltó: {', '.join(faltante)}")
        return False, f'Se requieren AMBOS factores. Faltó: {", ".join(faltante)}'
    else:
        if pin_ok or tarjeta_ok:
            _log(admin_auth.id if admin_auth else None, tipo_operacion, True)
            return True, admin_auth
        _log(None, tipo_operacion, False)
        return False, 'PIN incorrecto o tarjeta no válida'


@jwt_required()
def autorizar():
    """Endpoint universal — el frontend lo llama para cualquier acción sensible."""
    data           = request.get_json() or {}
    pin            = data.get('pin')
    codigo_tarjeta = data.get('codigo_tarjeta')
    tipo_operacion = data.get('tipo_operacion', 'eliminar_producto')

    ok, resultado = verificar_autorizacion_admin(pin, codigo_tarjeta, tipo_operacion)
    if ok:
        return jsonify({
            'autorizado':   True,
            'admin_nombre': resultado.name if resultado else 'Admin',
            'mensaje':      f'Autorizado por {resultado.name if resultado else "Admin"}',
        }), 200
    return jsonify({'autorizado': False, 'mensaje': resultado}), 403


@jwt_required()
def reset_by_admin_seguro():
    """Reset de contraseña — requiere PIN + tarjeta (doble factor)."""
    data           = request.get_json() or {}
    pin            = data.get('pin')
    codigo_tarjeta = data.get('codigo_tarjeta')
    email_usuario  = data.get('username')
    nueva_pass     = data.get('password')

    if not email_usuario or not nueva_pass:
        return jsonify({'message': 'Usuario y nueva contraseña son requeridos'}), 400

    ok, resultado = verificar_autorizacion_admin(pin, codigo_tarjeta, 'reset_password')
    if not ok:
        return jsonify({'message': resultado}), 403

    usuario = User.query.filter_by(email=email_usuario).first()
    if not usuario:
        usuario = User.query.filter_by(name=email_usuario).first()
    if not usuario:
        return jsonify({'message': 'Usuario no encontrado'}), 404

    usuario.set_password(nueva_pass)
    db.session.commit()
    return jsonify({'message': f'Contraseña de {usuario.name} actualizada correctamente'}), 200


@jwt_required()
def crear_tarjeta():
    """Admin genera su tarjeta de autorización."""
    claims  = get_jwt()
    user_id = int(get_jwt_identity())
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Solo administradores'}), 403

    AdminCard.query.filter_by(admin_id=user_id).update({'is_active': False})
    db.session.commit()

    code = AdminCard.generate_code()
    card = AdminCard(admin_id=user_id, code=code)
    db.session.add(card)
    db.session.commit()
    return jsonify({'message': 'Tarjeta creada', 'card': card.to_dict()}), 201


@jwt_required()
def get_mi_tarjeta():
    user_id = int(get_jwt_identity())
    card    = AdminCard.query.filter_by(admin_id=user_id, is_active=True).first()
    return jsonify({'card': card.to_dict() if card else None}), 200


@jwt_required()
def revocar_tarjeta():
    user_id = int(get_jwt_identity())
    AdminCard.query.filter_by(admin_id=user_id).update({'is_active': False})
    db.session.commit()
    return jsonify({'message': 'Tarjeta revocada'}), 200