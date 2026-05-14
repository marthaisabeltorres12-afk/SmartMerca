from werkzeug.security import check_password_hash, generate_password_hash
from flask import request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_mail import Message
from models.user import User
from extensions import db, mail
import secrets
from datetime import datetime, timedelta

def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'message': 'Credenciales inválidas'}), 401

    if not user.approved:
        return jsonify({'message': '⏳ Tu cuenta está pendiente de aprobación. Contacta al administrador.'}), 403

    if not user.is_active:
        return jsonify({'message': 'Tu cuenta está desactivada. Contacta al administrador.'}), 403

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role}
    )
    return jsonify({'access_token': access_token, 'user': user.to_dict()}), 200

def register():
    data = request.get_json()
    if User.query.filter_by(email=data.get('email')).first():
        return jsonify({'message': 'El correo ya está registrado'}), 400

    allowed_roles = ['admin', 'cajero', 'bodeguero', 'supervisor', 'contador', 'auditor']
    role = data.get('role', 'cajero')
    if role not in allowed_roles:
        role = 'cajero'

    user = User(
        name      = data['name'],
        email     = data['email'],
        role      = role,
        approved  = False,
        is_active = True
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({
        'message': '✅ Registro exitoso. Tu cuenta está pendiente de aprobación por el administrador.',
        'user': user.to_dict()
    }), 201

@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    return jsonify(user.to_dict()), 200

def forgot_password():
    data = request.get_json()
    email = data.get('email')
    user = User.query.filter_by(email=email).first()

    # Siempre responder igual por seguridad
    if not user:
        return jsonify({'message': 'Si el correo está registrado, recibirás las instrucciones en tu bandeja de entrada.'}), 200

    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()

    # Enviar correo
    try:
        reset_url = f"http://localhost:3002/reset-password?token={token}"
        msg = Message(
            subject='SmartMerca — Recuperación de contraseña',
            recipients=[user.email],
            html=f"""
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
              <h2 style="color:#1e293b;margin-bottom:8px;">🛒 SmartMerca</h2>
              <h3 style="color:#374151;font-weight:600;">Recuperación de contraseña</h3>
              <p style="color:#6b7280;">Hola <strong>{user.name}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>
              <p style="color:#6b7280;">Usa el siguiente código en la pantalla de restablecimiento:</p>
              <div style="background:#1e293b;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
                <code style="color:#60a5fa;font-size:14px;word-break:break-all;">{token}</code>
              </div>
              <a href="{reset_url}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-bottom:16px;">
                Restablecer contraseña
              </a>
              <p style="color:#9ca3af;font-size:12px;">Este enlace expira en <strong>1 hora</strong>. Si no solicitaste esto, ignora este correo.</p>
            </div>
            """
        )
        mail.send(msg)
    except Exception as e:
        # Si falla el correo, no exponer el error al usuario
        current_app.logger.error(f"Error enviando correo: {e}")

    return jsonify({
        'message': 'Si el correo está registrado, recibirás las instrucciones en tu bandeja de entrada.'
    }), 200

def reset_password():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify({'message': 'Token y nueva contraseña son requeridos'}), 400

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify({'message': 'Token inválido'}), 400

    if user.reset_token_expires < datetime.utcnow():
        return jsonify({'message': 'El token ha expirado'}), 400

    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.session.commit()
    return jsonify({'message': 'Contraseña actualizada exitosamente'}), 200

from werkzeug.security import check_password_hash

def reset_by_admin():
    data = request.json

    username = data.get('username')
    new_password = data.get('password')
    pin = data.get('pin')

    print("Reset intento:", username, pin)

    admin = User.query.filter_by(role='admin').first()

    if not admin:
        return jsonify({'message': 'No hay admin'}), 404

    if not admin.admin_pin:
        return jsonify({'message': 'Admin sin PIN'}), 403

    # ✅ VALIDAR HASH
    if not check_password_hash(admin.admin_pin, pin):
        return jsonify({'message': 'PIN incorrecto'}), 403

    user = User.query.filter_by(email=username).first()

    if not user:
        return jsonify({'message': 'Usuario no encontrado'}), 404

    user.set_password(new_password)
    db.session.commit()

    print("✅ Contraseña cambiada")

    return jsonify({'message': 'OK'})
def set_admin_pin():
    data = request.json
    pin = data.get('pin')

    admin = User.query.filter_by(role='admin').first()

    if not admin:
        return jsonify({'message': 'No hay admin'}), 404

    # 🔐 guardar hash
    admin.admin_pin = generate_password_hash(pin)

    db.session.commit()

    return jsonify({'message': 'PIN guardado'})