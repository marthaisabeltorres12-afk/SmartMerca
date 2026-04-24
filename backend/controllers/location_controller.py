from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.location import Location, LocationStock, StockTransfer
from models.product import Product
from extensions import db
from utils.audit import log_action

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── CRUD ubicaciones ──────────────────────────────────────────────────────────
@jwt_required()
def get_locations():
    locations = Location.query.filter_by(is_active=True).order_by(Location.tipo, Location.nombre).all()
    return jsonify([l.to_dict() for l in locations]), 200


@jwt_required()
def create_location():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    if not data.get('nombre'):
        return jsonify({'message': 'El nombre es obligatorio'}), 400
    loc = Location(
        nombre               = data['nombre'],
        tipo                 = data.get('tipo', 'bodega'),
        requiere_temperatura = data.get('requiere_temperatura', False),
    )
    db.session.add(loc)
    db.session.commit()
    return jsonify(loc.to_dict()), 201


@jwt_required()
def update_location(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    loc  = Location.query.get_or_404(id)
    data = request.get_json()
    for k in ('nombre', 'tipo', 'requiere_temperatura', 'is_active'):
        if k in data: setattr(loc, k, data[k])
    db.session.commit()
    return jsonify(loc.to_dict()), 200


# ── Stock por ubicación ───────────────────────────────────────────────────────
@jwt_required()
def get_location_stock(location_id):
    Location.query.get_or_404(location_id)
    items = LocationStock.query.filter_by(location_id=location_id).filter(LocationStock.cantidad > 0).all()
    return jsonify([i.to_dict() for i in items]), 200


@jwt_required()
def get_product_locations(product_id):
    """Retorna todas las ubicaciones donde hay stock de un producto."""
    items = LocationStock.query.filter_by(product_id=product_id).filter(LocationStock.cantidad > 0).all()
    return jsonify([i.to_dict() for i in items]), 200


# ── Registrar traslado ────────────────────────────────────────────────────────
@jwt_required()
def create_transfer():
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    user_id = int(get_jwt_identity())
    data    = request.get_json()

    product_id       = data.get('product_id')
    from_location_id = data.get('from_location_id')
    to_location_id   = data.get('to_location_id')
    cantidad         = float(data.get('cantidad', 0))
    motivo           = data.get('motivo', '').strip() or None

    if not all([product_id, from_location_id, to_location_id]):
        return jsonify({'message': 'Producto y ubicaciones son obligatorios'}), 400
    if cantidad <= 0:
        return jsonify({'message': 'La cantidad debe ser mayor a 0'}), 400
    if from_location_id == to_location_id:
        return jsonify({'message': 'El origen y destino no pueden ser iguales'}), 400

    product = Product.query.get_or_404(product_id)
    Location.query.get_or_404(from_location_id)
    Location.query.get_or_404(to_location_id)

    # Verificar stock en origen
    origen = LocationStock.query.filter_by(product_id=product_id, location_id=from_location_id).first()
    if not origen or float(origen.cantidad) < cantidad:
        disponible = float(origen.cantidad) if origen else 0
        return jsonify({'message': f'Stock insuficiente en origen. Hay {disponible} unidades de {product.name}'}), 400

    # Descontar origen
    origen.cantidad = float(origen.cantidad) - cantidad

    # Sumar destino
    destino = LocationStock.query.filter_by(product_id=product_id, location_id=to_location_id).first()
    if destino:
        destino.cantidad = float(destino.cantidad) + cantidad
    else:
        destino = LocationStock(product_id=product_id, location_id=to_location_id, cantidad=cantidad)
        db.session.add(destino)

    # Registrar traslado
    transfer = StockTransfer(
        product_id       = product_id,
        from_location_id = from_location_id,
        to_location_id   = to_location_id,
        cantidad         = cantidad,
        motivo           = motivo,
        created_by       = user_id,
    )
    db.session.add(transfer)
    db.session.commit()

    from_loc = Location.query.get(from_location_id)
    to_loc   = Location.query.get(to_location_id)
    log_action('editar', f'Traslado {product.name}: {cantidad} uds de {from_loc.nombre} → {to_loc.nombre}')
    return jsonify(transfer.to_dict()), 201


# ── Historial de traslados ────────────────────────────────────────────────────
@jwt_required()
def get_transfers():
    product_id  = request.args.get('product_id', type=int)
    location_id = request.args.get('location_id', type=int)
    q = StockTransfer.query
    if product_id:  q = q.filter_by(product_id=product_id)
    if location_id: q = q.filter(
        (StockTransfer.from_location_id == location_id) |
        (StockTransfer.to_location_id   == location_id)
    )
    transfers = q.order_by(StockTransfer.created_at.desc()).limit(100).all()
    return jsonify([t.to_dict() for t in transfers]), 200


# ── Agregar stock a una ubicación (al registrar entrada) ─────────────────────
def add_stock_to_location(product_id, location_id, cantidad):
    """Helper para agregar stock a una ubicación desde inventory_controller."""
    if not location_id:
        return
    ls = LocationStock.query.filter_by(product_id=product_id, location_id=location_id).first()
    if ls:
        ls.cantidad = float(ls.cantidad) + float(cantidad)
    else:
        db.session.add(LocationStock(product_id=product_id, location_id=location_id, cantidad=float(cantidad)))