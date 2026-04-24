from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from services.replenishment_service import calculate_replenishment_needs
from extensions import db

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')


@jwt_required()
def get_suggestions():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    # Leer semanas de configuración
    weeks = 3
    try:
        from models.system_config import SystemConfig
        cfg = SystemConfig.query.filter_by(key='replenishment_weeks_ahead').first()
        if cfg:
            weeks = int(cfg.value)
    except Exception:
        pass

    suggestions = calculate_replenishment_needs(weeks_ahead=weeks)
    return jsonify(suggestions), 200


@jwt_required()
def create_order_from_suggestion():
    """
    Crea una orden de compra en borrador desde una sugerencia.
    Recibe: { supplier_id, items: [{product_id, cantidad_solicitada, precio_costo_acordado}] }
    """
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    user_id = int(get_jwt_identity())
    data    = request.get_json()

    if not data.get('supplier_id') or not data.get('items'):
        return jsonify({'message': 'supplier_id e items son obligatorios'}), 400

    # Reusar la lógica de creación de orden de compra
    from models.purchase_order import PurchaseOrder, PurchaseOrderItem
    from controllers.purchase_order_controller import _gen_numero

    order = PurchaseOrder(
        numero_orden   = _gen_numero(),
        supplier_id    = data['supplier_id'],
        status         = 'enviada',
        notas          = 'Generada automáticamente por sugerencia de reabastecimiento',
        created_by     = user_id,
    )
    db.session.add(order)
    db.session.flush()

    for item in data['items']:
        db.session.add(PurchaseOrderItem(
            purchase_order_id     = order.id,
            product_id            = item['product_id'],
            cantidad_solicitada   = float(item.get('cantidad_solicitada', 1)),
            precio_costo_acordado = float(item['precio_costo_acordado']) if item.get('precio_costo_acordado') else None,
        ))

    db.session.commit()
    return jsonify({'message': f'Orden {order.numero_orden} creada en borrador', 'order_id': order.id, 'numero_orden': order.numero_orden}), 201