"""
Servicio de reabastecimiento automático.
Calcula qué productos necesitan reposición basado en stock actual y rotación semanal.
"""
from models.product import Product
from models.sale import SaleItem
from models.inventory import InventoryMovement
from extensions import db
from sqlalchemy import func
from datetime import datetime, timedelta


def calculate_replenishment_needs(weeks_ahead=3):
    hoy        = datetime.now()
    hace_4_sem = hoy - timedelta(weeks=4)

    productos_bajos = Product.query.filter(
        Product.is_active == True,
        Product.stock <= Product.min_stock,
    ).all()

    if not productos_bajos:
        return []

    ids = [p.id for p in productos_bajos]
    rotacion_map = {}

    from models.sale import Sale

    rotacion_q = db.session.query(
        SaleItem.product_id,
        func.sum(SaleItem.quantity).label('total_vendido')
    ).join(Sale, Sale.id == SaleItem.sale_id).filter(
        SaleItem.product_id.in_(ids),
        Sale.created_at >= hace_4_sem,
    ).group_by(SaleItem.product_id).all()

    for row in rotacion_q:
        rotacion_map[row.product_id] = float(row.total_vendido) / 4

    costo_map = {}
    costos_q = db.session.query(
        InventoryMovement.product_id,
        InventoryMovement.unit_cost
    ).filter(
        InventoryMovement.product_id.in_(ids),
        InventoryMovement.type == 'entrada',
        InventoryMovement.unit_cost != None,
    ).order_by(
        InventoryMovement.product_id,
        InventoryMovement.created_at.desc()
    ).all()

    seen = set()
    for row in costos_q:
        if row.product_id not in seen:
            costo_map[row.product_id] = float(row.unit_cost)
            seen.add(row.product_id)

    por_proveedor = {}
    for p in productos_bajos:
        rotacion  = rotacion_map.get(p.id, 0)
        min_stock = p.min_stock or 5
        stock     = p.stock or 0

        cantidad_sugerida = max(
            min_stock * 2,
            round(rotacion * weeks_ahead - stock, 0)
        )
        if cantidad_sugerida <= 0:
            cantidad_sugerida = min_stock * 2

        costo          = costo_map.get(p.id, 0)
        valor_estimado = cantidad_sugerida * costo

        proveedor_id     = p.supplier_id or 0
        proveedor_nombre = p.supplier.company_name or p.supplier.name if p.supplier else 'Sin proveedor'

        if proveedor_id not in por_proveedor:
            por_proveedor[proveedor_id] = {
                'proveedor_id':           proveedor_id,
                'proveedor_nombre':        proveedor_nombre,
                'productos':              [],
                'valor_total_estimado':   0,
            }

        por_proveedor[proveedor_id]['productos'].append({
            'product_id':        p.id,
            'product_name':      p.name,
            'stock_actual':      stock,
            'min_stock':         min_stock,
            'rotacion_semanal':  round(rotacion, 1),
            'cantidad_sugerida': int(cantidad_sugerida),
            'ultimo_costo':      costo,
            'valor_estimado':    round(valor_estimado, 0),
        })
        por_proveedor[proveedor_id]['valor_total_estimado'] += valor_estimado

    return list(por_proveedor.values())


def check_and_alert_replenishment(product_ids):
    """
    Verifica si alguno de los productos vendidos quedó bajo el mínimo,
    crea notificaciones en el sistema y envía alerta por WhatsApp al admin.
    """
    try:
        from extensions import db
        with db.engine.connect() as conn:
            pass
    except Exception:
        pass

    # Buscar admin con teléfono para alertas WhatsApp
    admin_telefono = None
    try:
        from models.user import User
        admin = User.query.filter(
            User.role.in_(['admin', 'admin_tecnico']),
            User.is_active == True,
            User.phone != None
        ).first()
        if admin:
            admin_telefono = admin.phone
    except Exception:
        pass

    try:
        for pid in product_ids:
            product = Product.query.get(pid)
            if not product or not product.is_active:
                continue
            min_stock = product.min_stock or 5
            if product.stock <= min_stock:
                rotacion  = 0
                hace_4_sem = datetime.now() - timedelta(weeks=4)
                rot_q = db.session.query(func.sum(SaleItem.quantity)).filter(
                    SaleItem.product_id == pid,
                    SaleItem.created_at >= hace_4_sem,
                ).scalar()
                rotacion          = round(float(rot_q or 0) / 4, 1)
                cantidad_sugerida = max(min_stock * 2, round(rotacion * 3 - product.stock, 0))
                proveedor         = product.supplier.company_name or product.supplier.name if product.supplier else 'sin proveedor'

                # ── Notificación interna ──────────────────────────────────
                try:
                    from models.notification_log import NotificationLog
                    db.session.add(NotificationLog(
                        tipo    = 'warning',
                        titulo  = 'Reabastecimiento sugerido',
                        mensaje = f'{product.name} tiene {product.stock} uds. Rotación: {rotacion} uds/sem. Sugerido pedir {int(cantidad_sugerida)} al proveedor {proveedor}.',
                        link    = '/admin/reabastecimiento',
                    ))
                    db.session.commit()
                except Exception:
                    pass

                # ── Alerta WhatsApp al admin ───────────────────────────────
                # Solo enviar si stock llegó exactamente al mínimo (no en cada venta)
                if product.stock == min_stock and admin_telefono:
                    try:
                        from services.whatsapp_service import enviar_alerta_stock
                        enviar_alerta_stock(
                            producto_nombre = product.name,
                            stock_actual    = product.stock,
                            stock_minimo    = min_stock,
                            admin_telefono  = admin_telefono,
                        )
                    except Exception as e:
                        import logging
                        logging.error(f'[WhatsApp alerta stock] {e}')

    except Exception as e:
        import logging
        logging.error(f'check_and_alert_replenishment error: {e}')