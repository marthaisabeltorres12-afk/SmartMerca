from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.sale import Sale, SaleItem
from models.product import Product
from models.shift import Shift
from extensions import db
from sqlalchemy import func
from datetime import date, datetime, timedelta

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_dashboard_today():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    today     = date.today()
    yesterday = today - timedelta(days=1)
    now       = datetime.now()

    # ── Ventas de hoy ────────────────────────────────────────────────────
    from sqlalchemy import text

    # IDs de ventas que tienen devolución registrada hoy
    ids_devueltos = db.session.execute(
        text("SELECT DISTINCT sale_id FROM return_orders WHERE DATE(created_at) = :today"),
        {"today": str(today)}
    ).scalars().all()

    q_hoy = db.session.query(
        func.count(Sale.id).label('count'),
        func.sum(Sale.total).label('total')
    ).filter(func.date(Sale.created_at) == today)

    # Excluir ventas con devolución
    if ids_devueltos:
        q_hoy = q_hoy.filter(~Sale.id.in_(ids_devueltos))

    ventas_hoy = q_hoy.first()

    total_hoy = float(ventas_hoy.total or 0)
    count_hoy = int(ventas_hoy.count or 0)

    # Restar el monto total devuelto hoy
    total_devuelto = db.session.execute(
        text("SELECT COALESCE(SUM(total), 0) FROM return_orders WHERE DATE(created_at) = :today"),
        {"today": str(today)}
    ).scalar()
    total_hoy = max(0, total_hoy - float(total_devuelto or 0))

    ticket_promedio = round(total_hoy / count_hoy, 0) if count_hoy > 0 else 0

    # ── Ventas de ayer hasta la misma hora ──────────────────────────────
    hora_actual = now.strftime('%H:%M:%S')
    # IDs devueltos de ayer
    ids_devueltos_ayer = db.session.execute(
        text("SELECT DISTINCT sale_id FROM return_orders WHERE DATE(created_at) = :ayer"),
        {"ayer": str(yesterday)}
    ).scalars().all()

    q_ayer = db.session.query(
        func.sum(Sale.total).label('total')
    ).filter(
        func.date(Sale.created_at) == yesterday,
        func.time(Sale.created_at) <= hora_actual
    )
    if ids_devueltos_ayer:
        q_ayer = q_ayer.filter(~Sale.id.in_(ids_devueltos_ayer))
    ventas_ayer = q_ayer.first()

    total_devuelto_ayer = db.session.execute(
        text("SELECT COALESCE(SUM(total), 0) FROM return_orders WHERE DATE(created_at) = :ayer"),
        {"ayer": str(yesterday)}
    ).scalar()
    total_ayer = max(0, float(ventas_ayer.total or 0) - float(total_devuelto_ayer or 0))
    variacion_pct = 0
    if total_ayer > 0:
        variacion_pct = round(((total_hoy - total_ayer) / total_ayer) * 100, 1)
    elif total_hoy > 0:
        variacion_pct = 100

    # ── Ventas por método de pago hoy ────────────────────────────────────
    try:
        from models.sale_payment import SalePayment
        q_pagos = db.session.query(
            SalePayment.metodo,
            func.sum(SalePayment.monto).label('total')
        ).join(Sale).filter(func.date(Sale.created_at) == today)
        q_pagos = _filtro_ventas_validas(q_pagos)
        pagos_hoy = q_pagos.group_by(SalePayment.metodo).all()
        metodos = {r.metodo: float(r.total) for r in pagos_hoy}
    except Exception:
        metodos = {}

    # ── Cajero top del día ───────────────────────────────────────────────
    q_cajero = db.session.query(
        Sale.cashier_name,
        func.sum(Sale.total).label('total')
    ).filter(func.date(Sale.created_at) == today)
    cajero_top = q_cajero.group_by(Sale.cashier_name)\
        .order_by(func.sum(Sale.total).desc()).first()

    # ── Top 5 productos del día ──────────────────────────────────────────
    q_top = db.session.query(
        SaleItem.product_name,
        func.sum(SaleItem.quantity).label('qty'),
        func.sum(SaleItem.quantity * SaleItem.price).label('valor')
    ).join(Sale).filter(func.date(Sale.created_at) == today)
    top_productos = q_top.group_by(SaleItem.product_name)\
        .order_by(func.sum(SaleItem.quantity * SaleItem.price).desc()).limit(5).all()

    # ── Alertas activas ──────────────────────────────────────────────────
    stock_bajo = Product.query.filter(
        Product.is_active == True,
        Product.stock <= Product.min_stock
    ).count()
    stock_cero = Product.query.filter(
        Product.is_active == True,
        Product.stock == 0
    ).count()
    vencimientos = Product.query.filter(
        Product.is_active == True,
        Product.expiry_date != None,
        Product.expiry_date <= str(today + timedelta(days=7)),
        Product.stock > 0
    ).count()
    turno_largo = Shift.query.filter(
        Shift.status == 'abierto',
        Shift.opened_at <= datetime.now() - timedelta(hours=12)
    ).count()

    return jsonify({
        'ventas_hoy':      total_hoy,
        'transacciones':   count_hoy,
        'ticket_promedio': ticket_promedio,
        'total_ayer':      total_ayer,
        'variacion_pct':   variacion_pct,
        'metodos_pago':    metodos,
        'cajero_top':      {'nombre': cajero_top.cashier_name, 'total': float(cajero_top.total)} if cajero_top else None,
        'top_productos':   [{'nombre': r.product_name, 'qty': float(r.qty), 'valor': float(r.valor)} for r in top_productos],
        'alertas': {
            'stock_bajo':   stock_bajo,
            'stock_cero':   stock_cero,
            'vencimientos': vencimientos,
            'turno_largo':  turno_largo,
            'total':        stock_bajo + stock_cero + vencimientos + turno_largo,
        }
    }), 200