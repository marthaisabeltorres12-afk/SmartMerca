from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.purchase_order import PurchaseOrder, PurchaseOrderItem
from models.product import Product
from models.inventory import InventoryMovement
from extensions import db
from datetime import datetime
from utils.audit import log_action

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

def _gen_numero():
    """Genera número de orden PO-2026-001"""
    year = datetime.now().year
    last = PurchaseOrder.query.filter(
        PurchaseOrder.numero_orden.like(f'PO-{year}-%')
    ).order_by(PurchaseOrder.id.desc()).first()
    if last:
        try:
            num = int(last.numero_orden.split('-')[-1]) + 1
        except:
            num = 1
    else:
        num = 1
    return f'PO-{year}-{num:03d}'


# ── Listar órdenes ────────────────────────────────────────────────────────────
@jwt_required()
def get_orders():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    status      = request.args.get('status')
    supplier_id = request.args.get('supplier_id', type=int)

    q = PurchaseOrder.query
    if status:      q = q.filter_by(status=status)
    if supplier_id: q = q.filter_by(supplier_id=supplier_id)

    orders = q.order_by(PurchaseOrder.created_at.desc()).all()
    return jsonify([o.to_dict() for o in orders]), 200


# ── Crear orden ───────────────────────────────────────────────────────────────
@jwt_required()
def create_order():
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    user_id = int(get_jwt_identity())
    data    = request.get_json()

    if not data.get('supplier_id'):
        return jsonify({'message': 'El proveedor es obligatorio'}), 400
    if not data.get('items') or not len(data['items']):
        return jsonify({'message': 'La orden debe tener al menos un producto'}), 400

    order = PurchaseOrder(
        numero_orden   = _gen_numero(),
        supplier_id    = data['supplier_id'],
        status         = 'enviada',
        fecha_esperada = data.get('fecha_esperada') or None,
        notas          = data.get('notas') or None,
        created_by     = user_id,
    )
    db.session.add(order)
    db.session.flush()

    for item in data['items']:
        db.session.add(PurchaseOrderItem(
            purchase_order_id     = order.id,
            product_id            = item['product_id'],
            cantidad_solicitada   = float(item['cantidad_solicitada']),
            precio_costo_acordado = float(item['precio_costo_acordado']) if item.get('precio_costo_acordado') else None,
            notas                 = item.get('notas') or None,
        ))

    db.session.commit()
    log_action('crear', f'Orden de compra {order.numero_orden} creada — {len(data["items"])} productos')
    return jsonify(order.to_dict()), 201


# ── Aprobar orden ─────────────────────────────────────────────────────────────
@jwt_required()
def approve_order(id):
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    order = PurchaseOrder.query.get_or_404(id)
    if order.status != 'borrador':
        return jsonify({'message': f'La orden ya está en estado "{order.status}"'}), 400

    order.status      = 'enviada'
    order.approved_by = int(get_jwt_identity())
    db.session.commit()
    log_action('editar', f'Orden {order.numero_orden} aprobada y enviada al proveedor')
    return jsonify(order.to_dict()), 200


# ── Cancelar orden ────────────────────────────────────────────────────────────
@jwt_required()
def cancel_order(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    order = PurchaseOrder.query.get_or_404(id)
    if order.status in ('completada', 'cancelada'):
        return jsonify({'message': f'No se puede cancelar una orden {order.status}'}), 400

    order.status = 'cancelada'
    db.session.commit()
    log_action('editar', f'Orden {order.numero_orden} cancelada')
    return jsonify(order.to_dict()), 200


# ── Registrar recepción ───────────────────────────────────────────────────────
@jwt_required()
def receive_order(id):
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    order = PurchaseOrder.query.get_or_404(id)
    if order.status not in ('enviada', 'parcial'):
        return jsonify({'message': f'No se puede recibir una orden en estado "{order.status}"'}), 400

    data      = request.get_json()
    recepciones = data.get('items', [])  # [{item_id, cantidad_recibida}]

    if not recepciones:
        return jsonify({'message': 'Debes indicar las cantidades recibidas'}), 400

    for rec in recepciones:
        item = PurchaseOrderItem.query.filter_by(
            id=rec['item_id'], purchase_order_id=order.id
        ).first()
        if not item:
            continue

        cant = float(rec.get('cantidad_recibida', 0))
        if cant <= 0:
            continue

        pendiente = float(item.cantidad_solicitada) - float(item.cantidad_recibida)
        cant = min(cant, pendiente)  # no recibir más de lo pendiente

        item.cantidad_recibida = float(item.cantidad_recibida) + cant

        # Actualizar stock del producto
        product = Product.query.get(item.product_id)
        if product:
            product.stock += cant
            # Actualizar precio de costo si viene en la orden
            if item.precio_costo_acordado:
                pass  # el costo se registra en InventoryMovement

            db.session.add(InventoryMovement(
                product_id  = product.id,
                type        = 'entrada',
                quantity    = cant,
                unit_cost   = float(item.precio_costo_acordado) if item.precio_costo_acordado else None,
                reason      = f'Recepción orden {order.numero_orden}',
                supplier_id = order.supplier_id,
            ))

    # Actualizar status de la orden
    todos_completos = all(
        float(i.cantidad_recibida) >= float(i.cantidad_solicitada)
        for i in order.items
    )
    alguno_recibido = any(float(i.cantidad_recibida) > 0 for i in order.items)

    if todos_completos:
        order.status = 'completada'
    elif alguno_recibido:
        order.status = 'parcial'

    db.session.commit()
    log_action('editar', f'Recepción registrada en orden {order.numero_orden} — estado: {order.status}')
    return jsonify(order.to_dict()), 200


# ── Productos sugeridos (stock bajo) ─────────────────────────────────────────
@jwt_required()
def get_suggested_products():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    products = Product.query.filter(
        Product.is_active == True,
        Product.stock <= Product.min_stock
    ).order_by(Product.stock.asc()).all()

    return jsonify([{
        'id':        p.id,
        'name':      p.name,
        'stock':     p.stock,
        'min_stock': p.min_stock or 5,
        'supplier_id': p.supplier_id,
        'supplier':  p.supplier.company_name or p.supplier.name if p.supplier else None,
    } for p in products]), 200