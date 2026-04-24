from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.business_line import BusinessLine
from models.product import Product
from models.sale import Sale, SaleItem
from extensions import db
from datetime import datetime, timedelta
from sqlalchemy import func

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── CRUD líneas ────────────────────────────────────────────────────────────
@jwt_required()
def get_lines():
    lines = BusinessLine.query.order_by(BusinessLine.name).all()
    return jsonify([l.to_dict() for l in lines]), 200

@jwt_required()
def create_line():
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    if not data.get('name'): return jsonify({'message': 'Nombre requerido'}), 400
    if BusinessLine.query.filter_by(name=data['name']).first():
        return jsonify({'message': f"Ya existe la línea \"{data['name']}\""}), 400
    line = BusinessLine(
        name=data['name'],
        color=data.get('color', '#3b82f6'),
    )
    db.session.add(line)
    db.session.commit()
    return jsonify(line.to_dict()), 201

@jwt_required()
def update_line(id):
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    line = BusinessLine.query.get_or_404(id)
    data = request.get_json()
    for k in ('name', 'color', 'is_active', 'responsible_user_id',
              'presupuesto_compras_mensual', 'meta_ventas_mensual'):
        if k in data:
            val = data[k]
            if k in ('presupuesto_compras_mensual', 'meta_ventas_mensual'):
                val = float(val) if val else None
            if k == 'responsible_user_id':
                val = int(val) if val else None
            setattr(line, k, val)
    db.session.commit()
    return jsonify(line.to_dict()), 200

@jwt_required()
def delete_line(id):
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    line = BusinessLine.query.get_or_404(id)
    # Desvincular productos antes de eliminar
    Product.query.filter_by(line_id=id).update({'line_id': None})
    db.session.delete(line)
    db.session.commit()
    return jsonify({'message': 'Línea eliminada'}), 200

# ── Dashboard de una línea ─────────────────────────────────────────────────
@jwt_required()
def line_dashboard(id):
    line = BusinessLine.query.get_or_404(id)

    # Periodo: hoy / semana / mes
    period = request.args.get('period', 'mes')
    now    = datetime.utcnow()
    if   period == 'hoy':    since = now.replace(hour=0, minute=0, second=0)
    elif period == 'semana': since = now - timedelta(days=7)
    else:                    since = now.replace(day=1, hour=0, minute=0, second=0)

    # Productos de esta línea
    products = Product.query.filter_by(line_id=id).all()
    product_ids = [p.id for p in products]

    # Ventas que contienen al menos un producto de esta línea
    if product_ids:
        sale_ids_query = db.session.query(SaleItem.sale_id)\
            .filter(SaleItem.product_id.in_(product_ids))\
            .distinct()
        sales = Sale.query\
            .filter(Sale.id.in_(sale_ids_query))\
            .filter(Sale.created_at >= since)\
            .all()
    else:
        sales = []

    # Totales
    total_ventas  = len(sales)
    total_ingresos = sum(float(s.total) for s in sales)

    # Desglose por medio de pago
    pagos = {}
    for s in sales:
        m = s.payment_method or 'efectivo'
        pagos[m] = pagos.get(m, 0) + float(s.total)

    # Productos más vendidos (solo los de esta línea)
    sold_map = {}
    for s in sales:
        for item in s.items:
            if item.product_id in product_ids:
                name = item.product.name if item.product else item.product_name or '?'
                sold_map[name] = sold_map.get(name, 0) + float(item.quantity)
    top_products = sorted(sold_map.items(), key=lambda x: -x[1])[:10]

    # Cajeros
    cajeros = {}
    for s in sales:
        name = s.cashier.name if s.cashier else s.cashier_name or '?'
        if name not in cajeros: cajeros[name] = {'ventas': 0, 'total': 0}
        cajeros[name]['ventas'] += 1
        cajeros[name]['total']  += float(s.total)
    cajeros_list = sorted(cajeros.items(), key=lambda x: -x[1]['total'])

    # Clientes frecuentes
    clientes = {}
    for s in sales:
        if s.customer_id:
            cname = s.customer.name if s.customer else '?'
            if cname not in clientes: clientes[cname] = {'visitas': 0, 'total': 0}
            clientes[cname]['visitas'] += 1
            clientes[cname]['total']   += float(s.total)
    clientes_list = sorted(clientes.items(), key=lambda x: -x[1]['visitas'])[:10]

    # Stock de productos de la línea
    stock_info = [
        {
            'name':       p.display_name or p.name,
            'stock':      p.stock,
            'min_stock':  p.min_stock or 5,
            'stock_alert':p.stock_alert,
            'price':      float(p.price),
        }
        for p in products
    ]

    return jsonify({
        'line':            line.to_dict(),
        'period':          period,
        'total_ventas':    total_ventas,
        'total_ingresos':  total_ingresos,
        'pagos':           pagos,
        'top_products':    [{'name': n, 'qty': q} for n, q in top_products],
        'cajeros':         [{'name': n, **v} for n, v in cajeros_list],
        'clientes':        [{'name': n, **v} for n, v in clientes_list],
        'stock':           stock_info,
        'n_products':      len(products),
        'meta_ventas':     float(line.meta_ventas_mensual) if line.meta_ventas_mensual else None,
        'pct_meta_ventas': round((total_ingresos / float(line.meta_ventas_mensual)) * 100, 1)
                           if line.meta_ventas_mensual and float(line.meta_ventas_mensual) > 0 else None,
    }), 200