from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from extensions import db
from sqlalchemy import text

audit_bp = Blueprint('audit', __name__)

@audit_bp.route('/', methods=['GET'])
@jwt_required()
def get_logs():
    limit     = request.args.get('limit', 500)
    from_date = request.args.get('from', None)
    to_date   = request.args.get('to',   None)

    conditions = []
    if from_date: conditions.append(f"DATE(fecha_hora) >= '{from_date}'")
    if to_date:   conditions.append(f"DATE(fecha_hora) <= '{to_date}'")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    # Excluir acciones de venta — solo mostrar acciones importantes
    excluir = "accion NOT IN ('venta', 'sale')"
    if conditions:
        where = f"WHERE {excluir} AND " + " AND ".join(conditions)
    else:
        where = f"WHERE {excluir}"
    query = f"SELECT * FROM audit_logs {where} ORDER BY fecha_hora DESC LIMIT {limit}"

    logs = db.session.execute(text(query)).fetchall()
    return jsonify([{
        "id":             l.id,
        "usuario_nombre": l.usuario_nombre,
        "rol":            l.rol,
        "accion":         l.accion,
        "descripcion":    l.descripcion,
        "fecha_hora":     str(l.fecha_hora),
    } for l in logs])

@audit_bp.route('/log', methods=['POST'])
@jwt_required()
def post_log():
    from flask_jwt_extended import get_jwt_identity, get_jwt
    from models.user import User
    data = request.get_json()

    # Obtener nombre y rol del cajero que hace la petición
    try:
        uid    = int(get_jwt_identity())
        claims = get_jwt()
        u      = User.query.get(uid)
        nombre = u.name if u else 'Cajero'
        rol    = claims.get('role', 'cajero')
    except:
        nombre = 'Cajero'
        rol    = 'cajero'

    accion      = data.get('accion', 'accion')
    descripcion = data.get('descripcion', '')

    db.session.execute(text("""
        INSERT INTO audit_logs (usuario_nombre, rol, accion, descripcion, fecha_hora)
        VALUES (:usuario_nombre, :rol, :accion, :descripcion, NOW())
    """), {
        'usuario_nombre': nombre,
        'rol':            rol,
        'accion':         accion,
        'descripcion':    descripcion,
    })
    db.session.commit()
    return jsonify({'ok': True}), 201