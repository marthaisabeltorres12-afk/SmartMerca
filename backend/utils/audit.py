from flask_jwt_extended import get_jwt_identity, get_jwt
from extensions import db
from datetime import datetime

def log_action(accion, descripcion, autorizador_nombre=None, autorizador_rol=None):
    try:
        uid    = int(get_jwt_identity())
        claims = get_jwt()
        from models.user import User
        u = User.query.get(uid)
        usuario_nombre = u.name if u else "Sistema"
        rol            = claims.get('role', 'desconocido')
        user_id        = uid
    except:
        usuario_nombre = "Sistema"
        rol            = "sistema"
        user_id        = None

    # Si hubo autorización de admin, ajustar descripción
    if autorizador_nombre:
        descripcion    = f"{autorizador_nombre} autorizó: {descripcion} (realizado por {usuario_nombre})"
        usuario_nombre = autorizador_nombre
        rol            = autorizador_rol or "admin"
        user_id        = None  # el autorizador no tiene JWT activo en este contexto

    from sqlalchemy import text
    db.session.execute(text("""
        INSERT INTO audit_logs (user_id, usuario_nombre, rol, accion, descripcion, fecha_hora)
        VALUES (:user_id, :usuario_nombre, :rol, :accion, :descripcion, :fecha_hora)
    """), {
        "user_id":        user_id,
        "usuario_nombre": usuario_nombre,
        "rol":            rol,
        "accion":         accion,
        "descripcion":    descripcion,
        "fecha_hora":     datetime.now(),
    })
    db.session.commit()