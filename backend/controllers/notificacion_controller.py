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
    try:
        from models.product import Product
        from models.shift import Shift
        from datetime import datetime as dt

        # Auto-resolver vencimientos de productos con stock=0 o inactivos
        notifs_venc = Notificacion.query.filter_by(tipo='vencimiento', resuelta=False).all()
        for n in notifs_venc:
            nombre = n.titulo.replace('📅 Vencimiento: ', '').strip()
            p = Product.query.filter_by(name=nombre).first()
            if not p or not p.is_active or p.stock <= 0:
                n.resuelta = True; n.resuelto_at = dt.now()

        # Auto-resolver stock bajo de productos que ya tienen stock suficiente
        notifs_stock = Notificacion.query.filter_by(tipo='stock_bajo', resuelta=False).all()
        for n in notifs_stock:
            nombre = n.titulo.replace('📉 Stock bajo: ', '').strip()
            p = Product.query.filter_by(name=nombre, is_active=True).first()
            if not p or p.stock > (p.min_stock or 5):
                n.resuelta = True; n.resuelto_at = dt.now()

        # Auto-resolver turnos largos ya cerrados
        notifs_turno = Notificacion.query.filter_by(tipo='cierre_turno', resuelta=False).all()
        for n in notifs_turno:
            nombre_cajero = n.titulo.replace('🔒 Turno largo: ', '').strip()
            turno = Shift.query.join(Shift.cashier).filter(
                Shift.status == 'abierto'
            ).first()
            if not turno:
                n.resuelta = True; n.resuelto_at = dt.now()

        db.session.commit()
    except Exception:
        pass

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
        resueltas = 0
        hoy = date.today()

        # ── Auto-resolver notificaciones que ya no aplican ──────────────────

        # Stock bajo resuelto: producto con stock > min_stock
        try:
            notifs_stock = Notificacion.query.filter_by(tipo='stock_bajo', resuelta=False).all()
            for n in notifs_stock:
                # Extraer nombre del producto del título "📉 Stock bajo: NombreProducto"
                nombre = n.titulo.replace('📉 Stock bajo: ', '').strip()
                p = Product.query.filter_by(name=nombre, is_active=True).first()
                # Resolver si: producto no existe, está inactivo, stock=0 (agotado a propósito) o stock > min_stock
                if not p or p.stock > (p.min_stock or 5):
                    n.resuelta = True; n.resuelto_at = dt.now(); resueltas += 1
        except Exception: pass

        # Vencimiento resuelto: producto con stock=0 (vendido/dado de baja) o is_active=False
        try:
            notifs_venc = Notificacion.query.filter_by(tipo='vencimiento', resuelta=False).all()
            for n in notifs_venc:
                nombre = n.titulo.replace('📅 Vencimiento: ', '').strip()
                p = Product.query.filter_by(name=nombre).first()
                # Resolver si: producto no existe, inactivo, o stock=0
                if not p or not p.is_active or p.stock <= 0:
                    n.resuelta = True; n.resuelto_at = dt.now(); resueltas += 1
        except Exception: pass

        # Turno largo resuelto: turno ya cerrado
        try:
            notifs_turno = Notificacion.query.filter_by(tipo='cierre_turno', resuelta=False).all()
            for n in notifs_turno:
                nombre = n.titulo.replace('🔒 Turno largo: ', '').strip()
                turno_abierto = Shift.query.join(Shift.cashier).filter(
                    Shift.status == 'abierto'
                ).first()
                if not turno_abierto:
                    n.resuelta = True; n.resuelto_at = dt.now(); resueltas += 1
        except Exception: pass

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

        # Limpiar duplicados: dejar solo la más reciente por tipo+titulo
        try:
            from sqlalchemy import func
            subq = db.session.query(
                Notificacion.tipo, Notificacion.titulo,
                func.max(Notificacion.id).label('max_id')
            ).filter_by(resuelta=False).group_by(Notificacion.tipo, Notificacion.titulo).subquery()

            duplicados = Notificacion.query.filter(
                Notificacion.resuelta == False,
                ~Notificacion.id.in_(
                    db.session.query(subq.c.max_id)
                )
            ).all()
            for d in duplicados:
                d.resuelta = True; d.resuelto_at = dt.now()
            db.session.commit()
        except Exception: pass

        return jsonify({'message': f'{creadas} alerta(s) generada(s), {resueltas} resuelta(s)', 'creadas': creadas}), 200

    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}', 'creadas': 0}), 200