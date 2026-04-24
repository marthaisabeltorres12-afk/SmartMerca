from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.notificacion import Notificacion
from extensions import db
from datetime import datetime

def _staff(claims):
    return claims.get('role') in ('admin','admin_tecnico','bodeguero','supervisor','contador','auditor','cajero')

@jwt_required()
def get_notificaciones():
    """Retorna notificaciones no resueltas para mostrar en el navbar."""
    solo_pendientes = request.args.get('pendientes', 'true') == 'true'
    q = Notificacion.query
    if solo_pendientes:
        q = q.filter_by(resuelta=False)
    notifs = q.order_by(Notificacion.created_at.desc()).limit(50).all()
    return jsonify([n.to_dict() for n in notifs]), 200

@jwt_required()
def crear_notificacion():
    """Bodeguero o sistema crea una notificación."""
    claims  = get_jwt()
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    n = Notificacion(
        tipo       = data.get('tipo', 'otro'),
        titulo     = data['titulo'],
        mensaje    = data.get('mensaje', ''),
        creado_por = user_id,
    )
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201

@jwt_required()
def resolver_notificacion(id):
    """Admin marca una notificación como resuelta."""
    claims  = get_jwt()
    user_id = int(get_jwt_identity())
    n = Notificacion.query.get_or_404(id)
    n.resuelta     = True
    n.resuelto_por = user_id
    n.resuelto_at  = datetime.now()
    db.session.commit()
    return jsonify(n.to_dict()), 200

@jwt_required()
def resolver_todas():
    """Resuelve todas las notificaciones pendientes."""
    user_id = int(get_jwt_identity())
    pendientes = Notificacion.query.filter_by(resuelta=False).all()
    for n in pendientes:
        n.resuelta     = True
        n.resuelto_por = user_id
        n.resuelto_at  = datetime.now()
    db.session.commit()
    return jsonify({'message': f'{len(pendientes)} notificación(es) resueltas'}), 200


@jwt_required()
def generar_alertas_automaticas():
    """Genera notificaciones automáticas de stock bajo, vencimientos y turnos largos."""
    try:
        from models.product import Product
        from models.shift import Shift
        from datetime import date, timedelta, datetime as dt

        creadas = 0
        hoy = date.today()

        # 1. Stock bajo
        try:
            productos_bajos = Product.query.filter(
                Product.is_active == True,
                Product.stock <= Product.min_stock
            ).all()
            for p in productos_bajos:
                existe = Notificacion.query.filter_by(
                    tipo='stock_bajo',
                    titulo=f'📉 Stock bajo: {p.name}',
                    resuelta=False
                ).first()
                if not existe:
                    n = Notificacion(
                        tipo   = 'stock_bajo',
                        titulo = f'📉 Stock bajo: {p.name}',
                        mensaje= f'Stock actual: {int(p.stock)} (mínimo: {p.min_stock or 5})',
                    )
                    db.session.add(n)
                    creadas += 1
        except Exception: pass

        # 2. Vencimientos próximos (30 días)
        try:
            limite = hoy + timedelta(days=30)
            prods_venc = Product.query.filter(
                Product.is_active == True,
                Product.expiry_date != None,
                Product.expiry_date <= limite
            ).all()
            for p in prods_venc:
                dias = (p.expiry_date - hoy).days
                existe = Notificacion.query.filter_by(
                    tipo='vencimiento',
                    titulo=f'📅 Vencimiento: {p.name}',
                    resuelta=False
                ).first()
                if not existe:
                    n = Notificacion(
                        tipo   = 'vencimiento',
                        titulo = f'📅 Vencimiento: {p.name}',
                        mensaje= f'Vence el {p.expiry_date} ({dias} días)' if dias >= 0 else f'Venció hace {abs(dias)} días',
                    )
                    db.session.add(n)
                    creadas += 1
        except Exception: pass

        # 3. Turnos muy largos (+12h)
        try:
            hace_12h = dt.utcnow() - timedelta(hours=12)
            turnos_largos = Shift.query.filter(
                Shift.status == 'abierto',
                Shift.opened_at <= hace_12h
            ).all()
            for s in turnos_largos:
                nombre_cajero = s.cashier.name if s.cashier else f'Turno #{s.id}'
                existe = Notificacion.query.filter_by(
                    tipo='cierre_turno',
                    titulo=f'🔒 Turno largo: {nombre_cajero}',
                    resuelta=False
                ).first()
                if not existe:
                    horas = int((dt.utcnow() - s.opened_at).total_seconds() / 3600)
                    n = Notificacion(
                        tipo   = 'cierre_turno',
                        titulo = f'🔒 Turno largo: {nombre_cajero}',
                        mensaje= f'Lleva {horas} horas abierto sin cerrar',
                    )
                    db.session.add(n)
                    creadas += 1
        except Exception: pass

        db.session.commit()
        return jsonify({'message': f'{creadas} alerta(s) generada(s)', 'creadas': creadas}), 200

    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}', 'creadas': 0}), 200