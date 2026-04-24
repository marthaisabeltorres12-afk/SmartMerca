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
    ventas_hoy = db.session.query(
        func.count(Sale.id).label('count'),
        func.sum(Sale.total).label('total')
    ).filter(
        func.date(Sale.created_at) == today
    ).first()

    total_hoy = float(ventas_hoy.total or 0)
    count_hoy = int(ventas_hoy.count or 0)
    ticket_promedio = round(total_hoy / count_hoy, 0) if count_hoy > 0 else 0

    # ── Ventas de ayer hasta la misma hora ──────────────────────────────
    hora_actual = now.strftime('%H:%M:%S')
    ventas_ayer = db.session.query(
        func.sum(Sale.total).label('total')
    ).filter(
        func.date(Sale.created_at) == yesterday,
        func.time(Sale.created_at) <= hora_actual
    ).first()

    total_ayer = float(ventas_ayer.total or 0)
    variacion_pct = 0
    if total_ayer > 0:
        variacion_pct = round(((total_hoy - total_ayer) / total_ayer) * 100, 1)
    elif total_hoy > 0:
        variacion_pct = 100

    # ── Ventas por método de pago hoy ────────────────────────────────────
    try:
        from models.sale_payment import SalePayment
        pagos_hoy = db.session.query(
            SalePayment.metodo,
            func.sum(SalePayment.monto).label('total')
        ).join(Sale).filter(
            func.date(Sale.created_at) == today
        ).group_by(SalePayment.metodo).all()
        metodos = {r.metodo: float(r.total) for r in pagos_hoy}
    except Exception:
        metodos = {}

    # ── Cajero top del día ───────────────────────────────────────────────
    cajero_top = db.session.query(
        Sale.cashier_name,
        func.sum(Sale.total).label('total')
    ).filter(
        func.date(Sale.created_at) == today
    ).group_by(Sale.cashier_name).order_by(func.sum(Sale.total).desc()).first()

    # ── Top 5 productos del día ──────────────────────────────────────────
    top_productos = db.session.query(
        SaleItem.product_name,
        func.sum(SaleItem.quantity).label('qty'),
        func.sum(SaleItem.quantity * SaleItem.price).label('valor')
    ).join(Sale).filter(
        func.date(Sale.created_at) == today
    ).group_by(SaleItem.product_name).order_by(
        func.sum(SaleItem.quantity * SaleItem.price).desc()
    ).limit(5).all()

    # ── Alertas activas ──────────────────────────────────────────────────
    stock_bajo   = Product.query.filter(
        Product.is_active == True,
        Product.stock <= Product.min_stock
    ).count()
    stock_cero   = Product.query.filter(
        Product.is_active == True,
        Product.stock == 0
    ).count()
    vencimientos = Product.query.filter(
        Product.is_active == True,
        Product.expiry_date != None,
        Product.expiry_date <= str(today + timedelta(days=7)),
        Product.stock > 0
    ).count()

    # Turnos abiertos muy largos (más de 12 horas)
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