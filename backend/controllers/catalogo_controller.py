from flask import jsonify
from models.product import Product
from models.business_policy import BusinessPolicy

def get_catalogo_productos():
    """Endpoint público — sin autenticación — para el catálogo."""
    from datetime import date
    from models.promotion import Promotion

    today = date.today()
    products = Product.query.filter_by(is_active=True).order_by(
        Product.category, Product.name).all()
    policy = BusinessPolicy.query.first()

    # Cargar todas las promos activas de una vez
    promos = Promotion.query.filter_by(is_active=True).all()
    promo_map = {}
    for pr in promos:
        if pr.product_id:
            if pr.date_from and today < pr.date_from: continue
            if pr.date_to and today > pr.date_to: continue
            promo_map[pr.product_id] = pr

    data = []
    for p in products:
        promo = promo_map.get(p.id)
        promo_info = None
        final_price = float(p.price)
        if promo:
            promo_info = {
                'type':           promo.type,
                'discount_value': float(promo.discount_value) if promo.discount_value else None,
                'buy_quantity':   int(promo.buy_quantity) if promo.buy_quantity else None,
                'free_quantity':  int(promo.free_quantity) if promo.free_quantity else None,
            }
            if promo.type == 'descuento_pct' and promo.discount_value:
                final_price = round(float(p.price) * (1 - float(promo.discount_value) / 100))
            elif promo.type == 'descuento_fijo' and promo.discount_value:
                final_price = max(0, float(p.price) - float(promo.discount_value))

        data.append({
            'id':          p.id,
            'name':        p.name,
            'price':       float(p.price),
            'final_price': final_price,
            'category':    p.category or 'General',
            'stock':       float(p.stock),
            'barcode':     p.barcode,
            'image_url':   p.image_url if hasattr(p, 'image_url') else None,
            'gramaje':     f"{p.gramaje_cantidad} {p.gramaje_unidad}" if p.gramaje_cantidad else None,
            'gramaje_unidad': p.gramaje_unidad,
            'promo_info':  promo_info,
        })

    return jsonify({
        'products':         data,
        'business_name':    policy.business_name    if policy else 'Supermercado',
        'business_phone':   policy.business_phone   if policy else '',
        'business_address': policy.business_address if policy else '',
    }), 200


def get_catalogo_sucursales():
    """Endpoint público — devuelve sucursales activas."""
    from models.branch import Branch
    sucursales = Branch.query.filter_by(is_active=True).order_by(Branch.nombre).all()
    return jsonify([{'id': s.id, 'nombre': s.nombre} for s in sucursales]), 200


def get_catalogo_promociones():
    """Endpoint público — devuelve promociones activas del día."""
    from datetime import date
    from models.promotion import Promotion
    today = date.today()
    promos = Promotion.query.filter_by(is_active=True).all()
    result = []
    for pr in promos:
        if pr.date_from and today < pr.date_from: continue
        if pr.date_to and today > pr.date_to: continue
        result.append({
            'id':             pr.id,
            'product_id':     pr.product_id,
            'type':           pr.type,
            'discount_value': float(pr.discount_value) if pr.discount_value else None,
            'buy_quantity':   int(pr.buy_quantity) if pr.buy_quantity else None,
            'free_quantity':  int(pr.free_quantity) if pr.free_quantity else None,
            'is_valid_today': True,
        })
    return jsonify(result), 200