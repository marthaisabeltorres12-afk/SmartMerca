from flask import jsonify, render_template_string
from models.product import Product
from models.business_policy import BusinessPolicy

def get_catalogo_productos():
    """Endpoint público — sin autenticación — para el catálogo."""
    products = Product.query.filter_by(is_active=True).order_by(
        Product.category, Product.name).all()
    policy = BusinessPolicy.query.first()

    data = []
    for p in products:
        data.append({
            'id':       p.id,
            'name':     p.name,
            'price':    float(p.price),
            'category': p.category or 'General',
            'stock':    float(p.stock),
            'barcode':  p.barcode,
            'image_url': p.image_url if hasattr(p, 'image_url') else None,
            'gramaje':  f"{p.gramaje_cantidad} {p.gramaje_unidad}" if p.gramaje_cantidad else None,
        })

    return jsonify({
        'products':     data,
        'business_name':    policy.business_name    if policy else 'Supermercado',
        'business_phone':   policy.business_phone   if policy else '',
        'business_address': policy.business_address if policy else '',
    }), 200