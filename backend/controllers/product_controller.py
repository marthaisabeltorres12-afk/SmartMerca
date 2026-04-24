from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.product import Product
from extensions import db
from utils.audit import log_action

def _nombre_usuario():
    try:
        from models.user import User
        u = User.query.get(int(get_jwt_identity()))
        return u.name if u else "Admin"
    except:
        return "Admin"

def _registrar_historial_precio(product, data, user_id):
    """Registra cambios de precio y costo en price_history."""
    try:
        from models.price_history import PriceHistory

        # Precio de venta
        if 'price' in data:
            nuevo = float(data['price'])
            anterior = float(product.price)
            if anterior != nuevo:
                variacion = round((nuevo - anterior) / anterior * 100, 2) if anterior > 0 else None
                db.session.add(PriceHistory(
                    product_id      = product.id,
                    tipo            = 'precio_venta',
                    precio_anterior = anterior,
                    precio_nuevo    = nuevo,
                    variacion_pct   = variacion,
                    cambiado_por    = user_id,
                ))

        # Costo (unit_cost si existe en el modelo)
        if 'unit_cost' in data and hasattr(product, 'unit_cost'):
            nuevo = float(data['unit_cost'])
            anterior = float(product.unit_cost or 0)
            if anterior != nuevo:
                variacion = round((nuevo - anterior) / anterior * 100, 2) if anterior > 0 else None
                db.session.add(PriceHistory(
                    product_id      = product.id,
                    tipo            = 'costo',
                    precio_anterior = anterior,
                    precio_nuevo    = nuevo,
                    variacion_pct   = variacion,
                    cambiado_por    = user_id,
                ))
    except Exception as e:
        import logging
        logging.error(f'Error registrando historial precio: {e}')
@jwt_required()
def get_products():
    claims = get_jwt()
    role = claims.get('role', '')

    if role == 'cajero':
        products = Product.query.filter_by(is_active=True).all()
    else:
        products = Product.query.all()

    return jsonify([p.to_dict() for p in products]), 200


@jwt_required()
def get_product(id):
    product = Product.query.get_or_404(id)
    return jsonify(product.to_dict()), 200


@jwt_required()
def create_product():
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    if not data.get('barcode'):
        data.pop('barcode', None)

    # Campos válidos del modelo Product
    VALID = {'name','description','price','stock','category','barcode',
             'expiry_date','discount','discount_start','discount_end',
             'supplier_id','min_stock','gramaje_cantidad','gramaje_unidad','is_active'}
    clean = {k: v for k, v in data.items() if k in VALID and v not in ('', None) or k in ('name','price')}
    # Limpiar strings vacíos en campos opcionales
    for k in ('gramaje_cantidad','gramaje_unidad','barcode','expiry_date'):
        if clean.get(k) == '':
            clean.pop(k, None)

    product = Product(**clean)
    db.session.add(product)
    db.session.commit()

    # ✅ LOG
    log_action("crear", f"{_nombre_usuario()} creó el producto {product.name} — Precio ${product.price}")

    return jsonify(product.to_dict()), 201


@jwt_required()
def update_product(id):
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Acceso denegado'}), 403

    product = Product.query.get_or_404(id)
    data = request.get_json()

    old_price = product.price

    # Registrar historial antes de aplicar cambios
    user_id = int(get_jwt_identity())
    _registrar_historial_precio(product, data, user_id)

    for key, value in data.items():
        if hasattr(product, key):
            setattr(product, key, value)

    db.session.commit()


    if 'price' in data and old_price != product.price:
        log_action("editar", f"{_nombre_usuario()} cambió el precio de {product.name}: ${old_price} → ${product.price}")
    else:
        log_action("editar", f"{_nombre_usuario()} editó el producto {product.name}")

    return jsonify(product.to_dict()), 200


@jwt_required()
def toggle_product(id):
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Acceso denegado'}), 403

    product = Product.query.get_or_404(id)
    product.is_active = not product.is_active
    db.session.commit()

    estado = "activado" if product.is_active else "desactivado"

  
    log_action("editar", f"{_nombre_usuario()} {estado} el producto {product.name}")

    return jsonify(product.to_dict()), 200


@jwt_required()
def delete_product(id):
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Acceso denegado'}), 403

    product = Product.query.get_or_404(id)

    nombre = product.name 

    db.session.delete(product)
    db.session.commit()

    # ✅ LOG
    log_action("eliminar", f"{_nombre_usuario()} eliminó el producto {nombre}")

    return jsonify({'message': 'Producto eliminado'}), 200

@jwt_required()
def get_price_history(id):
    from models.price_history import PriceHistory
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico'):
        return jsonify({'message': 'Acceso denegado'}), 403
    Product.query.get_or_404(id)
    history = PriceHistory.query.filter_by(product_id=id)\
        .order_by(PriceHistory.created_at.desc()).limit(100).all()
    return jsonify([h.to_dict() for h in history]), 200