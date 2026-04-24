from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
try:
    from utils.audit import log_action
except ImportError:
    def log_action(*a, **k): pass
from models.inventory import InventoryMovement
from models.inventory_batch import InventoryBatch
from models.product import Product
from extensions import db

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

def _can_inventory(claims):
    return claims.get('role') in ('admin', 'admin_tecnico', 'bodeguero')

def _create_batch(product_id, qty, unit_cost, expiry_date, supplier_id, numero_lote=None):
    """Crea un lote de inventario cuando entra mercancía."""
    batch = InventoryBatch(
        product_id        = product_id,
        numero_lote       = numero_lote,
        cantidad_inicial  = qty,
        cantidad_actual   = qty,
        fecha_vencimiento = expiry_date or None,
        costo_unitario    = unit_cost or None,
        supplier_id       = supplier_id or None,
        status            = 'activo',
    )
    db.session.add(batch)
    return batch

def descuento_fifo(product_id, qty_needed):
    """
    Descuenta qty_needed unidades de los lotes activos ordenados por fecha_vencimiento ASC (FIFO).
    Retorna True si se pudo descontar todo, False si no hay stock suficiente.
    """
    lotes = InventoryBatch.query.filter_by(
        product_id=product_id, status='activo'
    ).order_by(
        InventoryBatch.fecha_vencimiento.asc().nullslast(),
        InventoryBatch.fecha_entrada.asc()
    ).all()

    restante = float(qty_needed)
    for lote in lotes:
        if restante <= 0:
            break
        disponible = float(lote.cantidad_actual)
        if disponible <= 0:
            continue
        descuento = min(disponible, restante)
        lote.cantidad_actual = disponible - descuento
        if lote.cantidad_actual <= 0:
            lote.status = 'agotado'
        restante -= descuento

    return restante <= 0

@jwt_required()
def get_movements():
    mvs = InventoryMovement.query.order_by(InventoryMovement.created_at.desc()).all()
    return jsonify([m.to_dict() for m in mvs]), 200

@jwt_required()
def create_entry():
    """Entrada de un solo producto existente."""
    claims = get_jwt()
    if not _can_inventory(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    data      = request.get_json()
    product   = Product.query.get_or_404(data['product_id'])
    qty       = int(data['quantity'])
    unit_cost = float(data['unit_cost']) if data.get('unit_cost') else None
    product.stock += qty
    if data.get('expiry_date'):
        product.expiry_date = data['expiry_date']
    if data.get('price') and float(data['price']) != float(product.price):
        try:
            from models.price_history import PriceHistory
            from flask_jwt_extended import get_jwt_identity
            uid = int(get_jwt_identity())
            anterior = float(product.price)
            nuevo = float(data['price'])
            db.session.add(PriceHistory(product_id=product.id, tipo='precio_venta',
                precio_anterior=anterior, precio_nuevo=nuevo,
                variacion_pct=round((nuevo-anterior)/anterior*100,2) if anterior>0 else None,
                cambiado_por=uid))
        except Exception: pass
        product.price = float(data['price'])
    if data.get('min_stock') is not None:
        product.min_stock = int(data['min_stock'])
    mv = InventoryMovement(
        product_id  = product.id,
        type        = 'entrada',
        quantity    = qty,
        unit_cost   = unit_cost,
        expiry_date = data.get('expiry_date') or None,
        reason      = data.get('reason', 'Llegada de mercancía'),
        supplier_id = data.get('supplier_id') or None,
    )
    db.session.add(mv)
    # Crear lote
    _create_batch(product.id, qty, unit_cost, data.get('expiry_date'), data.get('supplier_id'), data.get('numero_lote'))
    db.session.commit()
    return jsonify(mv.to_dict()), 201


@jwt_required()
def create_entry_new_product():
    """Crea producto nuevo + primera entrada."""
    claims = get_jwt()
    if not _can_inventory(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()

    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'message': 'El nombre es requerido'}), 400

    price = float(data.get('price') or 0)
    if not price:
        return jsonify({'message': 'El precio de venta es requerido'}), 400

    qty = int(data.get('quantity') or 0)
    if qty <= 0:
        return jsonify({'message': 'La cantidad debe ser mayor a 0'}), 400

    # Si ya existe con ese nombre, suma stock en vez de fallar
    existing = Product.query.filter_by(name=name).first()
    if existing:
        existing.stock += qty
        if data.get('price'):
            existing.price = price
        if data.get('expiry_date'):
            existing.expiry_date = data['expiry_date']
        if data.get('min_stock') is not None:
            existing.min_stock = int(data['min_stock'])
        mv = InventoryMovement(
            product_id  = existing.id,
            type        = 'entrada',
            quantity    = qty,
            unit_cost   = float(data['unit_cost']) if data.get('unit_cost') else None,
            expiry_date = data.get('expiry_date') or None,
            reason      = data.get('reason', 'Entrada de mercancía'),
            supplier_id = int(data['supplier_id']) if data.get('supplier_id') else None,
        )
        db.session.add(mv)
        db.session.commit()
        return jsonify({'message': f'Stock de "{name}" actualizado', 'product': existing.to_dict(), 'movement': mv.to_dict()}), 201

    product = Product(
        name             = name,
        category         = data.get('category') or None,
        barcode          = data.get('barcode') or None,
        price            = price,
        stock            = qty,
        supplier_id      = int(data['supplier_id']) if data.get('supplier_id') else None,
        expiry_date      = data.get('expiry_date') or None,
        min_stock        = int(data.get('min_stock', 5)),
        is_active        = True,
        gramaje_cantidad = float(data['gramaje_cantidad']) if data.get('gramaje_cantidad') else None,
        gramaje_unidad   = data.get('gramaje_unidad') or None,
        iva_type         = int(data.get('iva_type', 19)),
    )
    db.session.add(product)
    db.session.flush()

    mv = InventoryMovement(
        product_id  = product.id,
        type        = 'entrada',
        quantity    = qty,
        unit_cost   = float(data['unit_cost']) if data.get('unit_cost') else None,
        expiry_date = data.get('expiry_date') or None,
        reason      = data.get('reason', 'Producto nuevo — primera entrada'),
        supplier_id = int(data['supplier_id']) if data.get('supplier_id') else None,
    )
    db.session.add(mv)
    db.session.commit()

    return jsonify({
        'message':  f'Producto "{name}" creado',
        'product':  product.to_dict(),
        'movement': mv.to_dict(),
    }), 201


@jwt_required()
def create_entry_batch():
    """
    Pedido completo: encabezado (proveedor, factura, razón) + lista de productos.
    Acepta mezcla de productos existentes y nuevos en el mismo pedido.
    Si un producto 'nuevo' ya existe por nombre, actualiza su stock en vez de fallar.
    """
    claims = get_jwt()
    if not _can_inventory(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    body    = request.get_json()
    header  = body.get('header', {})
    items   = body.get('items', [])

    if not items:
        return jsonify({'message': 'El pedido no tiene productos'}), 400

    supplier_id  = int(header['supplier_id']) if header.get('supplier_id') else None
    invoice_num  = header.get('invoice_num') or None
    reason       = header.get('reason') or 'Llegada de mercancía'

    saved        = []
    errors       = []
    total_egreso = 0

    for i, item in enumerate(items):
        try:
            qty = int(item.get('quantity') or 0)
            if qty <= 0:
                errors.append(f'Fila {i+1}: cantidad inválida')
                continue

            # ── Producto EXISTENTE ──────────────────────────────────────────
            if item.get('product_id'):
                product = Product.query.get(int(item['product_id']))
                if not product:
                    errors.append(f'Fila {i+1}: producto no encontrado')
                    continue
                product.stock += qty
                if item.get('expiry_date'):
                    product.expiry_date = item['expiry_date']
                if item.get('price'):
                    product.price = float(item['price'])
                if item.get('min_stock') is not None:
                    product.min_stock = int(item['min_stock'])

            # ── Producto NUEVO ──────────────────────────────────────────────
            else:
                name = (item.get('name') or '').strip()
                if not name:
                    errors.append(f'Fila {i+1}: nombre requerido para producto nuevo')
                    continue
                pv = float(item.get('price') or 0)
                if not pv:
                    errors.append(f'Fila {i+1}: precio de venta requerido para "{name}"')
                    continue

                # Si ya existe con ese nombre → suma stock en vez de fallar
                product = Product.query.filter_by(name=name).first()
                if product:
                    product.stock += qty
                    if pv:
                        product.price = pv
                    if item.get('expiry_date'):
                        product.expiry_date = item['expiry_date']
                    if item.get('min_stock') is not None:
                        product.min_stock = int(item['min_stock'])
                else:
                    product = Product(
                        name             = name,
                        category         = item.get('category') or None,
                        barcode          = item.get('barcode') or None,
                        price            = pv,
                        stock            = qty,
                        supplier_id      = supplier_id,
                        expiry_date      = item.get('expiry_date') or None,
                        min_stock        = int(item.get('min_stock', 5)),
                        is_active        = True,
                        gramaje_cantidad = float(item['gramaje_cantidad']) if item.get('gramaje_cantidad') else None,
                        gramaje_unidad   = item.get('gramaje_unidad') or None,
                        iva_type         = int(item.get('iva_type', 19)),
                    )
                    db.session.add(product)
                    db.session.flush()

            unit_cost = float(item['unit_cost']) if item.get('unit_cost') else None
            if unit_cost and qty:
                total_egreso += unit_cost * qty

            item_reason = reason
            if invoice_num:
                item_reason = f'{reason} — Factura {invoice_num}'

            mv = InventoryMovement(
                product_id  = product.id,
                type        = 'entrada',
                quantity    = qty,
                unit_cost   = unit_cost,
                expiry_date = item.get('expiry_date') or None,
                reason      = item_reason,
                supplier_id = supplier_id,
            )
            db.session.add(mv)
            # Crear lote FIFO
            _create_batch(product.id, qty, unit_cost, item.get('expiry_date'), supplier_id, item.get('numero_lote'))
            saved.append(product.name)

        except Exception as e:
            errors.append(f'Fila {i+1}: {str(e)}')

    if errors and not saved:
        db.session.rollback()
        return jsonify({'message': 'Errores: ' + '; '.join(errors)}), 400

    db.session.commit()
    return jsonify({
        'message':      f'{len(saved)} producto(s) registrados',
        'saved':        saved,
        'errors':       errors,
        'total_egreso': total_egreso,
    }), 201


@jwt_required()
def create_exit():
    claims = get_jwt()
    if not _can_inventory(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    data    = request.get_json()
    product = Product.query.get_or_404(data['product_id'])
    qty     = int(data['quantity'])
    if product.stock < qty:
        return jsonify({'message': f'Stock insuficiente — hay {product.stock} unidades'}), 400
    product.stock -= qty
    mv = InventoryMovement(
        product_id = product.id,
        type       = 'salida',
        quantity   = qty,
        reason     = data.get('reason', 'Ajuste de inventario'),
    )
    db.session.add(mv)
    db.session.commit()
    return jsonify(mv.to_dict()), 201

@jwt_required()
def get_batches():
    """Retorna lotes activos, opcionalmente filtrados por producto."""
    product_id = request.args.get('product_id', type=int)
    q = InventoryBatch.query.filter_by(status='activo')
    if product_id:
        q = q.filter_by(product_id=product_id)
    batches = q.order_by(InventoryBatch.fecha_vencimiento.asc().nullslast(), InventoryBatch.fecha_entrada.asc()).all()
    return jsonify([b.to_dict() for b in batches]), 200


@jwt_required()
def conteo_rapido():
    """Conteo rápido desde app bodeguero — crea un InventoryCount y registra diferencias."""
    claims  = get_jwt()
    if not _can_inventory(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user_id     = int(get_jwt_identity())
    data        = request.get_json()
    items       = data.get('items', [])
    notas       = data.get('notas', 'Conteo rápido desde app bodeguero')
    location_id = data.get('location_id')
    location_name = data.get('location_name', 'Sin bodega')
    from models.inventory_count import InventoryCount, InventoryCountItem
    from models.user import User
    user = User.query.get(user_id)
    # Crear registro de conteo
    count = InventoryCount(
        nombre        = f'Conteo {location_name} — {user.name if user else "Bodeguero"}',
        location_id   = location_id,
        location_name = location_name,
        origen        = 'bodeguero',
        status        = 'conteo_terminado',
        iniciado_por  = user_id,
    )
    db.session.add(count)
    db.session.flush()

    ajustados = 0
    for item in items:
        product = Product.query.get(item.get('product_id'))
        if not product: continue
        contado    = float(item.get('cantidad_contada', 0))
        diferencia = contado - float(product.stock)
        ci = InventoryCountItem(
            inventory_count_id = count.id,
            product_id         = product.id,
            stock_sistema      = float(product.stock),
            cantidad_contada   = contado,
            diferencia         = diferencia,
            status_ajuste      = 'aprobado' if diferencia == 0 else 'pendiente',
        )
        db.session.add(ci)
        # Aplicar ajuste al stock
        if diferencia != 0:
            mv = InventoryMovement(
                product_id = product.id,
                type       = 'entrada' if diferencia > 0 else 'salida',
                quantity   = abs(diferencia),
                reason     = f'Ajuste conteo {location_name}',
            )
            product.stock = contado
            db.session.add(mv)
            ajustados += 1

    db.session.commit()
    log_action("editar", f"Conteo rápido {location_name}: {len(items)} productos, {ajustados} ajustados")
    return jsonify({
        'message':   f'Conteo aplicado — {ajustados} producto(s) ajustado(s)',
        'ajustados': ajustados,
        'count_id':  count.id,
    }), 200


@jwt_required()
def notificar_faltante():
    """Bodeguero notifica al admin que hay un producto sin registrar."""
    from models.notificacion import Notificacion
    user_id   = int(get_jwt_identity())
    data      = request.get_json()
    producto  = data.get('producto', 'Desconocido')
    notas     = data.get('notas', '')
    tipo      = data.get('tipo', 'producto_faltante')
    titulos   = {
        'producto_faltante': f'📦 Producto sin registrar: {producto}',
        'producto_danado':   f'⚠️ Producto dañado: {producto}',
        'otro':              f'📋 Reporte: {producto}',
    }
    n = Notificacion(
        tipo       = tipo,
        titulo     = titulos.get(tipo, f'📋 {producto}'),
        mensaje    = notas,
        creado_por = user_id,
    )
    db.session.add(n)
    db.session.commit()
    log_action("alerta", f"Notificación creada: {n.titulo}")
    return jsonify({'message': 'Notificación enviada al administrador', 'id': n.id}), 201