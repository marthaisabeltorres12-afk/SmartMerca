from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.audit_log import AuditLog

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico', 'auditor', 'contador')

@jwt_required()
def get_audit_logs():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    user_id      = request.args.get('user_id', type=int)
    usuario_q    = request.args.get('usuario', '').strip()
    accion       = request.args.get('accion', '').strip()
    date_from    = request.args.get('from')
    date_to      = request.args.get('to')
    limit        = request.args.get('limit', 200, type=int)

    q = AuditLog.query

    # Filtro por user_id (registros nuevos) o por nombre parcial (históricos)
    if user_id:
        nombre_ref = AuditLog.query.filter_by(user_id=user_id).first()
        if nombre_ref:
            q = q.filter(
                (AuditLog.user_id == user_id) |
                (AuditLog.usuario_nombre == nombre_ref.usuario_nombre)
            )
        else:
            q = q.filter(AuditLog.user_id == user_id)
    if usuario_q:
        q = q.filter(AuditLog.usuario_nombre.like(f'%{usuario_q}%'))
    if accion:
        q = q.filter(AuditLog.accion.like(f'%{accion}%'))
    if date_from:
        q = q.filter(AuditLog.fecha_hora >= date_from)
    if date_to:
        q = q.filter(AuditLog.fecha_hora <= date_to + ' 23:59:59')

    logs = q.order_by(AuditLog.fecha_hora.desc()).limit(limit).all()
    return jsonify([l.to_dict() for l in logs]), 200