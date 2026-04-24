from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.presentation import ProductPresentation
from models.product import Product
from extensions import db

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── Todas las presentaciones ──────────────────────────────────────────────
@jwt_required()
def get_all():
    items = ProductPresentation.query\
        .filter_by(is_active=True)\
        .order_by(ProductPresentation.base_product_id, ProductPresentation.units_per_pack)\
        .all()
    return jsonify([p.to_dict() for p in items]), 200

# ── Presentaciones de un producto ─────────────────────────────────────────
@jwt_required()
def get_by_product(product_id):
    items = ProductPresentation.query\
        .filter_by(base_product_id=product_id)\
        .order_by(ProductPresentation.units_per_pack)\
        .all()
    return jsonify([p.to_dict() for p in items]), 200

# ── Crear presentación ────────────────────────────────────────────────────
@jwt_required()
def create():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    data = request.get_json()
    base_id = data.get('base_product_id')
    if not base_id or not Product.query.get(base_id):
        return jsonify({'message': 'Producto base no encontrado'}), 404

    units = int(data.get('units_per_pack', 1))
    if units < 1:
        return jsonify({'message': 'Las unidades por pack deben ser >= 1'}), 400

    p = ProductPresentation(
        base_product_id = base_id,
        name            = data.get('name', '').strip(),
        units_per_pack  = units,
        price           = float(data.get('price', 0)),
        barcode         = data.get('barcode') or None,
        is_active       = True,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201

# ── Actualizar presentación ───────────────────────────────────────────────
@jwt_required()
def update(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    p    = ProductPresentation.query.get_or_404(id)
    data = request.get_json()

    if 'name'           in data: p.name           = data['name']
    if 'units_per_pack' in data: p.units_per_pack  = int(data['units_per_pack'])
    if 'price'          in data: p.price           = float(data['price'])
    if 'barcode'        in data: p.barcode         = data['barcode'] or None
    if 'is_active'      in data: p.is_active       = data['is_active']

    db.session.commit()
    return jsonify(p.to_dict()), 200

# ── Eliminar presentación ─────────────────────────────────────────────────
@jwt_required()
def delete(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    p = ProductPresentation.query.get_or_404(id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'Eliminado'}), 200