from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.product import Product
from models.sale import Sale, SaleItem
from models.inventory import InventoryMovement
from extensions import db
from sqlalchemy import func

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico', 'contador')

@jwt_required()
def get_finance():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    IVA_RATE = 0.19

    products = Product.query.filter_by(is_active=True).all()

    # Costo promedio PONDERADO por cantidad (SUM(costo*qty) / SUM(qty))
    costos = db.session.query(
        InventoryMovement.product_id,
        (func.sum(InventoryMovement.unit_cost * InventoryMovement.quantity) /
         func.sum(InventoryMovement.quantity)).label('costo_prom')
    ).filter(
        InventoryMovement.type == 'entrada',
        InventoryMovement.unit_cost != None,
        InventoryMovement.unit_cost > 0,
        InventoryMovement.quantity > 0
    ).group_by(InventoryMovement.product_id).all()

    costo_map = {r.product_id: float(r.costo_prom) for r in costos}

    # Unidades vendidas e ingresos por producto
    ventas = db.session.query(
        SaleItem.product_id,
        func.sum(SaleItem.quantity).label('qty'),
        func.sum(SaleItem.quantity * SaleItem.price).label('ingresos')
    ).group_by(SaleItem.product_id).all()

    venta_map = {r.product_id: {'qty': float(r.qty), 'ingresos': float(r.ingresos)} for r in ventas}

    result = []
    for p in products:
        precio      = float(p.final_price)
        costo       = costo_map.get(p.id)
        has_cost    = costo is not None and costo > 0
        uds         = venta_map.get(p.id, {}).get('qty', 0)
        ingresos    = venta_map.get(p.id, {}).get('ingresos', 0)

        # IVA DIAN por unidad
        sin_iva     = precio / (1 + IVA_RATE)
        iva_unit    = precio - sin_iva

        # Ganancia bruta y margen
        ganancia    = (sin_iva - costo) if has_cost else 0
        margen      = (ganancia / costo * 100) if (has_cost and costo > 0) else 0

        # Verificación: costo + iva + ganancia ≈ precio
        verif = has_cost and abs((costo + iva_unit + ganancia) - precio) < 1

        # Costo vendido e inventario
        costo_vendido   = (costo * uds) if has_cost else 0
        valor_inventario= (costo * p.stock) if has_cost else (float(p.price) * p.stock)

        # Estado de stock
        min_s = p.min_stock if p.min_stock else 5
        if p.stock == 0:
            estado = 'Agotado'
        elif p.stock <= min_s:
            estado = 'Crítico'
        elif p.stock <= min_s * 2:
            estado = 'Bajo'
        else:
            estado = 'Normal'

        # Display name con gramaje
        display = p.name
        if p.gramaje_cantidad and p.gramaje_unidad:
            q = float(p.gramaje_cantidad)
            qty_str = int(q) if q == int(q) else q
            display = f'{p.name} · {qty_str} {p.gramaje_unidad}'

        result.append({
            'id':               p.id,
            'producto':         display,
            'categoria':        p.category or '—',
            'precio_venta':     precio,
            'costo_promedio':   round(costo, 2) if has_cost else 0,
            'has_cost':         has_cost,
            'iva_dian_unit':    round(iva_unit, 2),
            'ganancia_bruta':   round(ganancia, 2),
            'margen_pct':       round(margen, 2),
            'uds_vendidas':     uds,
            'ingresos':         round(ingresos, 2),
            'costo_vendido':    round(costo_vendido, 2),
            'stock':            p.stock,
            'valor_inventario': round(valor_inventario, 2),
            'estado':           estado,
            'verificacion_ok':  verif,
            'active_discount':  float(p.active_discount) if p.active_discount else 0,
        })

    return jsonify(result), 200