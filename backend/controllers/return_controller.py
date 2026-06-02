from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.return_order import ReturnOrder, ReturnItem
from models.sale import Sale
from models.product import Product
from models.customer import Customer
from models.inventory import InventoryMovement
from models.business_policy import BusinessPolicy
from extensions import db
from datetime import datetime, date

@jwt_required()
def get_returns():
    returns = ReturnOrder.query.order_by(ReturnOrder.created_at.desc()).all()
    return jsonify([r.to_dict() for r in returns]), 200

@jwt_required()
def get_sale_for_return(sale_id):
    sale = Sale.query.get_or_404(sale_id)
    return jsonify(sale.to_dict()), 200

@jwt_required()
def create_return():
    user_id          = int(get_jwt_identity())
    data             = request.get_json()
    sale_id          = data.get('sale_id')
    items            = data.get('items', [])
    reason           = data.get('reason', '').strip()
    mode             = data.get('mode')
    exchange_product    = data.get('exchange_product', '').strip()  # Nombre producto a cambio
    exchange_product_id = data.get('exchange_product_id')           # ID producto a cambio
    exchange_qty        = float(data.get('exchange_qty', 1))        # Cantidad del producto a cambio
    exchange_price      = float(data.get('exchange_price', 0))      # Precio del producto a cambio
    authorized_by       = data.get('authorized_by', '')             # Nombre del admin que autorizo con PIN

    if not sale_id or not items:
        return jsonify({'message': 'Venta e items son requeridos'}), 400

    # ── Validar política del negocio ──────────────────────────────────────────
    policy = BusinessPolicy.query.first()
    if policy:
        # Motivo obligatorio
        if policy.return_reason_required and not reason:
            return jsonify({'message': 'El motivo de la devolución es obligatorio según las políticas del negocio'}), 400

        # Modo de devolución permitido
        if policy.return_mode == 'dinero' and mode != 'dinero':
            return jsonify({'message': 'Solo se permiten devoluciones en dinero según las políticas del negocio'}), 400
        if policy.return_mode == 'cambio' and mode != 'cambio':
            return jsonify({'message': 'Solo se permiten cambios por otro producto según las políticas del negocio'}), 400

        # Días máximos para devolver
        if policy.return_max_days:
            sale_check = Sale.query.get(sale_id)
            if sale_check and sale_check.created_at:
                dias = (datetime.utcnow() - sale_check.created_at).days
                if dias > policy.return_max_days:
                    return jsonify({'message': f'La venta supera los {policy.return_max_days} días permitidos para devolución'}), 400
    # ─────────────────────────────────────────────────────────────────────────

    # ── Validar si se necesita PIN ───────────────────────────────────────────
    if policy:
        pin_monto    = policy.return_pin_monto    or 30000
        pin_multiple = policy.return_pin_multiple
        total_items  = len(items)
        total_monto  = sum(float(i.get('price', 0)) * float(i.get('quantity', 1)) for i in items)

        requiere_pin = False
        if mode in ('dinero', 'ambos') and total_monto > pin_monto:
            requiere_pin = True
        if pin_multiple and total_items > 1:
            requiere_pin = True

        if requiere_pin and not authorized_by:
            return jsonify({
                'message': 'Esta devolucion requiere autorizacion del administrador (PIN)',
                'requiere_pin': True
            }), 403
    # ─────────────────────────────────────────────────────────────────────────

    sale = Sale.query.get_or_404(sale_id)

    # 🚫 Validar que ningún producto haya sido devuelto antes en esa venta
    for item in items:
        product_id = item.get('product_id')
        product = Product.query.get(product_id)
        product_name = product.name if product else f'ID {product_id}'

        already_returned = db.session.query(ReturnItem)\
            .join(ReturnOrder, ReturnItem.return_order_id == ReturnOrder.id)\
            .filter(
                ReturnOrder.sale_id == sale_id,
                ReturnItem.product_id == product_id
            ).first()

        if already_returned:
            return jsonify({
                'message': f'El producto "{product_name}" ya fue devuelto en esta venta y no puede devolverse nuevamente.'
            }), 400
    total = 0
    # Calcular diferencia de precio si es cambio de producto
    diferencia = 0
    if mode == 'cambio' and exchange_product_id:
        total_devuelto  = sum(float(i.get('price',0)) * float(i.get('quantity',1)) for i in items)
        total_entregado = exchange_price * exchange_qty
        diferencia      = total_entregado - total_devuelto  # + cliente paga, - negocio devuelve

    return_order = ReturnOrder(
        sale_id             = sale_id,
        cashier_id          = user_id,
        customer_id         = sale.customer_id,
        reason              = reason,
        mode                = mode,
        exchange_product    = exchange_product if mode == 'cambio' else None,
        exchange_product_id = exchange_product_id if mode == 'cambio' else None,
        exchange_qty        = exchange_qty if mode == 'cambio' else 1,
        exchange_price      = exchange_price if mode == 'cambio' else None,
        diferencia          = diferencia,
        authorized_by       = authorized_by or None,
        total               = 0
    )
    db.session.add(return_order)
    db.session.flush()

    for item in items:
        product = Product.query.get(item['product_id'])
        if not product:
            continue
        qty   = float(item['quantity'])
        price = float(item['price'])
        total += price * qty

        # Restaurar stock del producto devuelto
        product.stock += qty

        # Eliminar o reducir la salida de venta correspondiente
        # en vez de crear una entrada nueva que aparecería en la tabla
        mov = InventoryMovement.query.filter_by(
            product_id = product.id,
            type       = 'salida',
            reason     = 'Venta'
        ).order_by(InventoryMovement.created_at.desc()).first()

        if mov:
            if qty >= float(mov.quantity):
                db.session.delete(mov)           # devolución total → elimina el registro
            else:
                mov.quantity = float(mov.quantity) - qty  # devolución parcial → reduce

        db.session.add(ReturnItem(
            return_order_id = return_order.id,
            product_id      = product.id,
            product_name    = product.name,
            quantity        = qty,
            price           = price
        ))

    return_order.total = total

    # Descontar stock del producto entregado a cambio
    if mode == 'cambio' and exchange_product_id:
        prod_cambio = Product.query.get(exchange_product_id)
        if prod_cambio:
            if prod_cambio.stock < exchange_qty:
                db.session.rollback()
                return jsonify({'message': f'Stock insuficiente de "{prod_cambio.name}" para el cambio'}), 400
            prod_cambio.stock -= exchange_qty
            db.session.add(InventoryMovement(
                product_id = prod_cambio.id,
                type       = 'salida',
                quantity   = exchange_qty,
                reason     = f'Cambio de producto — devolucion #{return_order.id}',
            ))

    if sale.customer_id:
        customer = Customer.query.get(sale.customer_id)
        if customer:
            pts_to_remove = int(total / 1000)
            customer.points = max(0, customer.points - pts_to_remove)

    db.session.commit()
    return jsonify(return_order.to_dict()), 201