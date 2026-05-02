from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.product import Product
from extensions import db
from sqlalchemy import text
from datetime import datetime

# ── Modelo inline (simple) ────────────────────────────────────────────────
class CartReservation(db.Model):
    __tablename__ = 'cart_reservations'
    id               = db.Column(db.Integer, primary_key=True)
    cashier_id       = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    cash_register_id = db.Column(db.Integer, nullable=True)
    product_id       = db.Column(db.Integer, db.ForeignKey('products.id', ondelete='CASCADE'), nullable=False)
    quantity         = db.Column(db.Numeric(10,3), nullable=False, default=0)
    created_at       = db.Column(db.DateTime, default=datetime.now)
    updated_at       = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    product = db.relationship('Product', foreign_keys=[product_id])


# ── Stock disponible real = stock - reserved_stock ────────────────────────
def stock_disponible(product):
    """Stock real menos lo que está reservado en carritos de OTRAS cajas."""
    reservado = product.reserved_stock or 0
    return max(0, (product.stock or 0) - reservado)


# ── RESERVAR al agregar al carrito ────────────────────────────────────────
@jwt_required()
def reservar():
    """
    POST /api/reservas/reservar
    Body: { product_id, quantity, cash_register_id? }
    Agrega/actualiza la reserva del cajero para ese producto.
    """
    user_id = int(get_jwt_identity())
    data    = request.get_json() or {}
    product_id       = data.get('product_id')
    quantity         = float(data.get('quantity', 0))
    cash_register_id = data.get('cash_register_id')

    if not product_id or quantity < 0:
        return jsonify({'message': 'product_id y quantity requeridos'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'message': 'Producto no encontrado'}), 404

    # Reserva actual de ESTE cajero para este producto
    reserva_actual = CartReservation.query.filter_by(
        cashier_id=user_id, product_id=product_id
    ).first()

    cantidad_actual = float(reserva_actual.quantity) if reserva_actual else 0
    diferencia      = quantity - cantidad_actual  # cuánto más necesita

    # Stock disponible (descontando reservas de OTROS cajeros)
    reservado_otros = (product.reserved_stock or 0) - cantidad_actual
    stock_libre     = (product.stock or 0) - reservado_otros

    if diferencia > 0 and stock_libre < diferencia:
        return jsonify({
            'ok':               False,
            'message':          f'Solo quedan {stock_libre} disponibles de "{product.name}"',
            'stock_disponible': stock_libre,
            'product_name':     product.name,
        }), 200

    # Actualizar reserva
    if quantity == 0:
        # Liberar reserva
        if reserva_actual:
            product.reserved_stock = max(0, (product.reserved_stock or 0) - cantidad_actual)
            db.session.delete(reserva_actual)
    elif reserva_actual:
        # Actualizar cantidad
        product.reserved_stock = max(0, (product.reserved_stock or 0) + diferencia)
        reserva_actual.quantity = quantity
        reserva_actual.updated_at = datetime.now()
    else:
        # Nueva reserva
        product.reserved_stock = (product.reserved_stock or 0) + quantity
        nueva = CartReservation(
            cashier_id       = user_id,
            cash_register_id = cash_register_id,
            product_id       = product_id,
            quantity         = quantity,
        )
        db.session.add(nueva)

    db.session.commit()
    return jsonify({
        'ok':               True,
        'stock_disponible': max(0, (product.stock or 0) - (product.reserved_stock or 0)),
        'reserved_stock':   product.reserved_stock,
    }), 200


# ── LIBERAR reservas del cajero (al cerrar turno o vaciar carrito) ─────────
@jwt_required()
def liberar():
    """
    POST /api/reservas/liberar
    Body: { product_ids?: [1,2,3] }  — si vacío, libera todo el carrito del cajero
    """
    user_id = int(get_jwt_identity())
    data    = request.get_json() or {}
    product_ids = data.get('product_ids')  # None = liberar todo

    query = CartReservation.query.filter_by(cashier_id=user_id)
    if product_ids:
        query = query.filter(CartReservation.product_id.in_(product_ids))

    reservas = query.all()
    for r in reservas:
        product = Product.query.get(r.product_id)
        if product:
            product.reserved_stock = max(0, (product.reserved_stock or 0) - float(r.quantity))
        db.session.delete(r)

    db.session.commit()
    return jsonify({'ok': True, 'liberadas': len(reservas)}), 200


# ── Ver stock disponible de varios productos ──────────────────────────────
@jwt_required()
def stock_disponible_bulk():
    """
    GET /api/reservas/stock?ids=1,2,3
    Retorna stock disponible (stock - reserved_stock) para varios productos.
    """
    ids_str = request.args.get('ids', '')
    if not ids_str:
        return jsonify({}), 200

    try:
        ids = [int(i) for i in ids_str.split(',') if i.strip()]
    except ValueError:
        return jsonify({'message': 'IDs inválidos'}), 400

    productos = Product.query.filter(Product.id.in_(ids)).all()
    return jsonify({
        str(p.id): {
            'stock':          p.stock,
            'reserved_stock': p.reserved_stock or 0,
            'disponible':     max(0, (p.stock or 0) - (p.reserved_stock or 0)),
        }
        for p in productos
    }), 200