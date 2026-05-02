from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.sale import Sale, SaleItem
from models.sale_payment import SalePayment
from models.product import Product
from models.inventory import InventoryMovement
from extensions import db
from sqlalchemy import func
try:
    from utils.audit import log_action
except Exception:
    def log_action(*a, **k): pass

@jwt_required()
def get_sales():
    sales = Sale.query.order_by(Sale.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sales]), 200

@jwt_required()
def get_sales_by_cashier():
    results = db.session.query(
        Sale.cashier_id,
        func.count(Sale.id).label('ventas'),
        func.sum(Sale.total).label('total')
    ).group_by(Sale.cashier_id).all()

    from models.user import User
    data = []
    for r in results:
        u = User.query.get(r.cashier_id)
        data.append({
            'cashier': u.name if u else 'Desconocido',
            'ventas':  r.ventas,
            'total':   float(r.total or 0)
        })
    return jsonify(data), 200

@jwt_required()
def get_sales_by_cashier_detail():
    from models.user import User
    results = db.session.query(
        Sale.cashier_id,
        func.count(Sale.id).label('ventas'),
        func.sum(Sale.total).label('total')
    ).group_by(Sale.cashier_id).all()

    data = []
    for r in results:
        u     = User.query.get(r.cashier_id)
        items = db.session.query(
            SaleItem.product_id,
            func.sum(SaleItem.quantity).label('qty'),
            func.sum(SaleItem.quantity * SaleItem.price).label('subtotal')
        ).join(Sale).filter(Sale.cashier_id == r.cashier_id)\
         .group_by(SaleItem.product_id).all()

        products_sold = []
        for item in items:
            p = Product.query.get(item.product_id)
            products_sold.append({
                'product':  p.name if p else 'Eliminado',
                'quantity': int(item.qty),
                'subtotal': float(item.subtotal or 0)
            })

        data.append({
            'cashier':  u.name if u else 'Desconocido',
            'ventas':   r.ventas,
            'total':    float(r.total or 0),
            'products': products_sold
        })
    return jsonify(data), 200

@jwt_required()
def create_sale():
    user_id = int(get_jwt_identity())
    data    = request.get_json()
    items   = data.get('items', [])
    if not items:
        return jsonify({'message': 'La venta debe tener al menos un producto'}), 400

    from models.user import User
    from models.presentation import ProductPresentation

    cashier = User.query.get(user_id)
    sale = Sale(
        cashier_id     = user_id,
        cashier_name   = cashier.name if cashier else '',
        customer_id    = data.get('customer_id') or None,
        payment_method = data.get('payment_method', 'efectivo'),
        total          = 0
    )
    db.session.add(sale)
    db.session.flush()

    total = 0
    for item in items:
        qty   = float(item.get('quantity', 1))
        price = float(item.get('price', 0)) if item.get('price') else None

        # ── Presentación (cubeta de huevos, etc.) ────────────────────────
        if item.get('presentation_id'):
            pres = ProductPresentation.query.get(item['presentation_id'])
            if not pres:
                db.session.rollback()
                return jsonify({'message': 'Presentación no encontrada'}), 404

            # SELECT FOR UPDATE — bloquea la fila hasta que termine esta transacción
            try:
                from sqlalchemy import text as sa_text
                db.session.execute(
                    sa_text('SELECT id FROM products WHERE id = :id FOR UPDATE NOWAIT'),
                    {'id': pres.base_product_id}
                )
            except Exception:
                db.session.rollback()
                return jsonify({'message': f'El stock de "{pres.base_product.name}" está siendo procesado por otra caja. Intenta de nuevo.'}), 409

            # Refrescar desde BD después del bloqueo
            db.session.refresh(pres.base_product)
            base = pres.base_product
            units_needed = qty * pres.units_per_pack

            if base.stock < units_needed:
                db.session.rollback()
                return jsonify({
                    'message': f'Stock insuficiente de "{base.name}". '
                               f'Necesitas {int(units_needed)} uds, hay {base.stock}.'
                }), 400

            item_price    = float(pres.price) if not price else price
            item_name     = f'{pres.name} ({pres.units_per_pack} {base.name})'
            item_subtotal = item_price * qty
            total        += item_subtotal

            base.stock -= units_needed

            db.session.add(SaleItem(
                sale_id      = sale.id,
                product_id   = base.id,
                product_name = item_name,
                quantity     = qty,
                price        = item_price,
            ))
            db.session.add(InventoryMovement(
                product_id = base.id,
                type       = 'salida',
                quantity   = units_needed,
                reason     = f'Venta presentación: {pres.name} ×{int(qty)}'
            ))

        # ── Producto normal ───────────────────────────────────────────────
        else:
            # SELECT FOR UPDATE — bloquea la fila hasta que termine esta transacción
            try:
                from sqlalchemy import text as sa_text
                db.session.execute(
                    sa_text('SELECT id FROM products WHERE id = :id FOR UPDATE NOWAIT'),
                    {'id': item['product_id']}
                )
            except Exception:
                db.session.rollback()
                nombre = Product.query.get(item['product_id'])
                nombre = nombre.name if nombre else str(item['product_id'])
                return jsonify({'message': f'El stock de "{nombre}" está siendo procesado por otra caja. Intenta de nuevo.'}), 409

            # Refrescar desde BD después del bloqueo
            product = Product.query.get(item['product_id'])
            if not product:
                db.session.rollback()
                return jsonify({'message': 'Producto no encontrado'}), 404

            db.session.refresh(product)

            if product.stock < qty:
                db.session.rollback()
                return jsonify({'message': f'Stock insuficiente para {product.name}'}), 400

            item_price = price if price else float(product.final_price)

            # ── Aplicar lista de precios del cliente ──────────────────────
            if not price and data.get('customer_id'):
                try:
                    from models.customer import Customer
                    from models.price_list import PriceList, PriceListItem
                    customer = Customer.query.get(data['customer_id'])
                    if customer and customer.price_list_id:
                        pl = PriceList.query.get(customer.price_list_id)
                        if pl and pl.is_active:
                            item_especial = PriceListItem.query.filter_by(
                                price_list_id=pl.id, product_id=product.id
                            ).first()
                            if item_especial:
                                item_price = float(item_especial.precio_especial)
                            elif pl.tipo == 'porcentaje' and pl.descuento_pct:
                                item_price = round(float(product.final_price) * (1 - float(pl.descuento_pct) / 100), 0)
                except Exception:
                    pass
            total     += item_price * qty
            product.stock -= qty

            # ── Descuento FIFO en lotes ───────────────────────────────────
            try:
                from controllers.inventory_controller import descuento_fifo
                descuento_fifo(product.id, qty)
            except Exception:
                pass

            db.session.add(SaleItem(
                sale_id      = sale.id,
                product_id   = product.id,
                product_name = product.name,
                quantity     = qty,
                price        = item_price,
            ))
            db.session.add(InventoryMovement(
                product_id = product.id,
                type       = 'salida',
                quantity   = qty,
                reason     = 'Venta'
            ))

    sale.total = total

    # ── Guardar pagos desglosados en sale_payments ────────────────────────
    payments = data.get('payments', [])
    pm_str   = data.get('payment_method', 'efectivo')

    if payments:
        # El frontend envía lista de pagos [{metodo, monto, referencia, cambio}]
        for p in payments:
            db.session.add(SalePayment(
                sale_id    = sale.id,
                metodo     = p.get('metodo', 'efectivo'),
                monto      = float(p.get('monto', 0)),
                cambio     = float(p.get('cambio', 0)),
                referencia = p.get('referencia') or None,
            ))
        # Generar resumen textual para payment_method
        metodos = [p.get('metodo') for p in payments]
        sale.payment_method = 'mixto:' + '+'.join(metodos) if len(metodos) > 1 else metodos[0]
    else:
        # Compatibilidad: si no viene payments, crear uno solo con el método
        cambio = float(data.get('cambio', 0))
        db.session.add(SalePayment(
            sale_id    = sale.id,
            metodo     = pm_str.replace('mixto:', '').split('+')[0] if 'mixto:' in pm_str else pm_str,
            monto      = total,
            cambio     = cambio,
            referencia = data.get('referencia') or None,
        ))

    # Auditoría
    prods_txt = ', '.join([
        (i.get('product_name') or str(i.get('product_id',''))) + f' x{i.get("quantity",1)}'
        for i in items
    ])
    log_action('venta', 'sale', sale.id,
        f'Venta #{sale.id} — {data.get("payment_method","efectivo")} — Total: ${total:,.0f} — Productos: {prods_txt[:200]}')
    db.session.commit()
# ── AGREGAR en sale_controller.py — función create_sale() ────────────────
# Después de db.session.commit() al final de create_sale(), agregar:

    # Liberar reservas del carrito al confirmar la venta
    try:
        from controllers.cart_reservation_controller import CartReservation
        product_ids = [i.get('product_id') for i in items if i.get('product_id')]
        reservas = CartReservation.query.filter(
            CartReservation.cashier_id == user_id,
            CartReservation.product_id.in_(product_ids)
        ).all()
        for r in reservas:
            product = Product.query.get(r.product_id)
            if product:
                product.reserved_stock = max(0, (product.reserved_stock or 0) - float(r.quantity))
            db.session.delete(r)
        db.session.commit()
    except Exception as e:
        print(f'[create_sale] Error liberando reservas: {e}')
    # Verificar reabastecimiento en segundo plano
    try:
        import threading
        from services.replenishment_service import check_and_alert_replenishment
        product_ids_sold = [i.get('product_id') for i in items if i.get('product_id')]
        if product_ids_sold:
            t = threading.Thread(target=check_and_alert_replenishment, args=(product_ids_sold,), daemon=True)
            t.start()
    except Exception:
        pass

    return jsonify(sale.to_dict()), 201