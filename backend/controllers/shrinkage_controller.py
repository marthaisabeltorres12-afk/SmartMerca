from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.shrinkage import ShrinkageRecord
from models.product import Product
from models.inventory import InventoryMovement
from models.sale import Sale
from extensions import db
from sqlalchemy import func
from datetime import datetime
from utils.audit import log_action

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── Listar mermas ────────────────────────────────────────────────────────────
@jwt_required()
def get_shrinkage():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    date_from = request.args.get('from')
    date_to   = request.args.get('to')
    causa     = request.args.get('causa')

    q = ShrinkageRecord.query
    if date_from: q = q.filter(ShrinkageRecord.created_at >= date_from)
    if date_to:   q = q.filter(ShrinkageRecord.created_at <= date_to + ' 23:59:59')
    if causa:     q = q.filter_by(causa=causa)

    records = q.order_by(ShrinkageRecord.created_at.desc()).all()
    return jsonify([r.to_dict() for r in records]), 200


# ── Registrar merma ──────────────────────────────────────────────────────────
@jwt_required()
def create_shrinkage():
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    user_id = int(get_jwt_identity())
    data    = request.get_json()

    product_id = data.get('product_id')
    cantidad   = float(data.get('cantidad', 0))
    causa      = data.get('causa')
    obs        = data.get('observaciones', '').strip()

    if not product_id:
        return jsonify({'message': 'Producto es obligatorio'}), 400
    if cantidad <= 0:
        return jsonify({'message': 'La cantidad debe ser mayor a 0'}), 400
    if causa not in ('vencimiento','daño_fisico','robo','error_conteo','deterioro'):
        return jsonify({'message': 'Causa inválida'}), 400

    product = Product.query.get_or_404(product_id)

    if product.stock < cantidad:
        return jsonify({'message': f'Stock insuficiente. Hay {product.stock} unidades de {product.name}'}), 400

    # Obtener costo unitario del último movimiento de entrada
    ultimo_costo = db.session.query(InventoryMovement.unit_cost).filter(
        InventoryMovement.product_id == product_id,
        InventoryMovement.type == 'entrada',
        InventoryMovement.unit_cost != None,
        InventoryMovement.unit_cost > 0
    ).order_by(InventoryMovement.created_at.desc()).first()

    costo_unit  = float(ultimo_costo.unit_cost) if ultimo_costo else 0
    costo_total = round(costo_unit * cantidad, 2)

    # Crear registro de merma
    record = ShrinkageRecord(
        product_id     = product_id,
        cantidad       = cantidad,
        costo_unitario = costo_unit,
        costo_total    = costo_total,
        causa          = causa,
        observaciones  = obs or None,
        registrado_por = user_id,
    )
    db.session.add(record)

    # Descontar stock
    product.stock -= cantidad

    # Crear movimiento de inventario tipo salida
    db.session.add(InventoryMovement(
        product_id = product_id,
        type       = 'salida',
        quantity   = cantidad,
        unit_cost  = costo_unit,
        reason     = f'Merma: {causa.replace("_"," ")}',
    ))

    db.session.flush()
    log_action('merma', f'Merma {product.name} — {cantidad} uds — Causa: {causa} — Costo: ${costo_total:,.0f}')
    db.session.commit()

    return jsonify(record.to_dict()), 201


# ── Reporte de merma ─────────────────────────────────────────────────────────
@jwt_required()
def get_shrinkage_report():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    year  = request.args.get('year',  type=int, default=datetime.now().year)
    month = request.args.get('month', type=int, default=datetime.now().month)

    date_from = f'{year}-{month:02d}-01'
    if month == 12:
        date_to = f'{year+1}-01-01'
    else:
        date_to = f'{year}-{month+1:02d}-01'

    # Merma por causa
    por_causa = db.session.query(
        ShrinkageRecord.causa,
        func.sum(ShrinkageRecord.cantidad).label('cantidad'),
        func.sum(ShrinkageRecord.costo_total).label('costo'),
    ).filter(
        ShrinkageRecord.created_at >= date_from,
        ShrinkageRecord.created_at < date_to,
    ).group_by(ShrinkageRecord.causa).all()

    # Total merma del mes
    total_merma = sum(float(r.costo) for r in por_causa)

    # Ventas del mes para calcular porcentaje
    ventas_mes = db.session.query(
        func.sum(Sale.total)
    ).filter(
        Sale.created_at >= date_from,
        Sale.created_at < date_to,
    ).scalar() or 0
    ventas_mes = float(ventas_mes)

    pct_merma = round((total_merma / ventas_mes * 100), 2) if ventas_mes > 0 else 0

    # Historial últimos 6 meses
    historico = []
    for i in range(5, -1, -1):
        m = month - i
        y = year
        while m <= 0:
            m += 12; y -= 1
        df = f'{y}-{m:02d}-01'
        dt = f'{y}-{m:02d}-31 23:59:59'
        total = db.session.query(func.sum(ShrinkageRecord.costo_total)).filter(
            ShrinkageRecord.created_at >= df,
            ShrinkageRecord.created_at <= dt,
        ).scalar() or 0
        historico.append({'mes': f'{y}-{m:02d}', 'costo': float(total)})

    return jsonify({
        'year':        year,
        'month':       month,
        'total_merma': total_merma,
        'ventas_mes':  ventas_mes,
        'pct_merma':   pct_merma,
        'semaforo':    'verde' if pct_merma < 1 else ('amarillo' if pct_merma < 3 else 'rojo'),
        'por_causa':   [{'causa': r.causa, 'cantidad': float(r.cantidad), 'costo': float(r.costo)} for r in por_causa],
        'historico':   historico,
    }), 200