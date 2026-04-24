from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.promotion import Promotion
from models.product import Product
from extensions import db

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_promotions():
    promos = Promotion.query.order_by(Promotion.created_at.desc()).all()
    return jsonify([p.to_dict() for p in promos]), 200

@jwt_required()
def get_active_promotions():
    """Solo las vigentes hoy — usado por el cajero en ventas."""
    from datetime import date
    today = date.today()
    promos = Promotion.query.filter_by(is_active=True).all()
    valid  = [p.to_dict() for p in promos if p.is_valid_today]
    return jsonify(valid), 200

@jwt_required()
def create_promotion():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    if not data.get('name') or not data.get('product_id') or not data.get('type'):
        return jsonify({'message': 'Nombre, producto y tipo son requeridos'}), 400

    promo = Promotion(
        name            = data['name'],
        type            = data['type'],
        is_active       = data.get('is_active', True),
        product_id      = int(data['product_id']),
        discount_value  = float(data.get('discount_value') or 0),
        buy_quantity    = int(data.get('buy_quantity') or 1),
        free_quantity   = int(data.get('free_quantity') or 0),
        free_product_id = int(data['free_product_id']) if data.get('free_product_id') else None,
        date_from       = data.get('date_from') or None,
        date_to         = data.get('date_to')   or None,
    )
    db.session.add(promo)
    db.session.commit()
    return jsonify(promo.to_dict()), 201

@jwt_required()
def update_promotion(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    promo = Promotion.query.get_or_404(id)
    data  = request.get_json()

    for f in ['name', 'type', 'is_active', 'discount_value',
              'buy_quantity', 'free_quantity', 'date_from', 'date_to']:
        if f in data:
            setattr(promo, f, data[f] or None if f in ('date_from','date_to') else data[f])

    if 'product_id' in data:
        promo.product_id = int(data['product_id'])
    if 'free_product_id' in data:
        promo.free_product_id = int(data['free_product_id']) if data['free_product_id'] else None

    db.session.commit()
    return jsonify(promo.to_dict()), 200

@jwt_required()
def delete_promotion(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    promo = Promotion.query.get_or_404(id)
    db.session.delete(promo)
    db.session.commit()
    return jsonify({'message': 'Promoción eliminada'}), 200

@jwt_required()
def toggle_promotion(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    promo = Promotion.query.get_or_404(id)
    promo.is_active = not promo.is_active
    db.session.commit()
    return jsonify(promo.to_dict()), 200