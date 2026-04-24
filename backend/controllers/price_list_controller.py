from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.price_list import PriceList, PriceListItem
from models.customer import Customer
from models.product import Product
from extensions import db

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── Listar listas ────────────────────────────────────────────────────────────
@jwt_required()
def get_price_lists():
    lists = PriceList.query.filter_by(is_active=True).order_by(PriceList.nombre).all()
    return jsonify([l.to_dict() for l in lists]), 200


# ── Crear lista ──────────────────────────────────────────────────────────────
@jwt_required()
def create_price_list():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    if not data.get('nombre'):
        return jsonify({'message': 'El nombre es obligatorio'}), 400
    pl = PriceList(
        nombre        = data['nombre'],
        descripcion   = data.get('descripcion') or None,
        tipo          = data.get('tipo', 'porcentaje'),
        descuento_pct = float(data['descuento_pct']) if data.get('descuento_pct') else None,
    )
    db.session.add(pl)
    db.session.commit()
    return jsonify(pl.to_dict()), 201


# ── Actualizar lista ─────────────────────────────────────────────────────────
@jwt_required()
def update_price_list(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    pl   = PriceList.query.get_or_404(id)
    data = request.get_json()
    for k in ('nombre', 'descripcion', 'tipo', 'is_active'):
        if k in data: setattr(pl, k, data[k])
    if 'descuento_pct' in data:
        pl.descuento_pct = float(data['descuento_pct']) if data['descuento_pct'] else None
    db.session.commit()
    return jsonify(pl.to_dict()), 200


# ── Obtener items de una lista ───────────────────────────────────────────────
@jwt_required()
def get_price_list_items(id):
    PriceList.query.get_or_404(id)
    items = PriceListItem.query.filter_by(price_list_id=id).all()
    return jsonify([i.to_dict() for i in items]), 200


# ── Agregar / actualizar precio especial ────────────────────────────────────
@jwt_required()
def upsert_price_list_item(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    PriceList.query.get_or_404(id)
    data = request.get_json()
    product_id      = data.get('product_id')
    precio_especial = data.get('precio_especial')
    if not product_id or not precio_especial:
        return jsonify({'message': 'product_id y precio_especial son obligatorios'}), 400
    if not Product.query.get(product_id):
        return jsonify({'message': 'Producto no encontrado'}), 404

    item = PriceListItem.query.filter_by(price_list_id=id, product_id=product_id).first()
    if item:
        item.precio_especial = float(precio_especial)
    else:
        item = PriceListItem(price_list_id=id, product_id=product_id, precio_especial=float(precio_especial))
        db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 200


# ── Eliminar precio especial ─────────────────────────────────────────────────
@jwt_required()
def delete_price_list_item(id, item_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    item = PriceListItem.query.filter_by(id=item_id, price_list_id=id).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Eliminado'}), 200


# ── Obtener precio para un cliente + producto ────────────────────────────────
@jwt_required()
def get_customer_price(customer_id, product_id):
    """Retorna el precio que aplica para un cliente específico en un producto."""
    customer = Customer.query.get_or_404(customer_id)
    product  = Product.query.get_or_404(product_id)

    if not customer.price_list_id:
        return jsonify({'price': float(product.final_price), 'list_applied': False}), 200

    pl   = PriceList.query.get(customer.price_list_id)
    item = PriceListItem.query.filter_by(price_list_id=pl.id, product_id=product_id).first()

    if item:
        return jsonify({'price': float(item.precio_especial), 'list_applied': True, 'list_name': pl.nombre}), 200
    elif pl.tipo == 'porcentaje' and pl.descuento_pct:
        precio = float(product.final_price) * (1 - float(pl.descuento_pct) / 100)
        return jsonify({'price': round(precio, 0), 'list_applied': True, 'list_name': pl.nombre}), 200

    return jsonify({'price': float(product.final_price), 'list_applied': False}), 200