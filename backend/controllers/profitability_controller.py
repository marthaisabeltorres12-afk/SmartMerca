from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.profitability import OperatingExpense, BranchMonthlySummary
from models.branch import Branch
from models.sale import Sale, SaleItem
from models.return_order import ReturnOrder
from models.inventory import InventoryMovement
from models.shrinkage import ShrinkageRecord
from models.user import User
from extensions import db
from sqlalchemy import func
from datetime import datetime, date
import calendar

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── Gastos operativos ─────────────────────────────────────────────────────────
@jwt_required()
def get_expenses():
    claims    = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    branch_id = request.args.get('branch_id', type=int)
    period    = request.args.get('period')
    q = OperatingExpense.query
    if branch_id: q = q.filter_by(branch_id=branch_id)
    if period:    q = q.filter_by(period=period)
    return jsonify([e.to_dict() for e in q.order_by(OperatingExpense.created_at.desc()).all()]), 200


@jwt_required()
def create_expense():
    claims  = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    user_id = int(get_jwt_identity())
    data    = request.get_json()
    if not data.get('branch_id') or not data.get('period') or not data.get('valor'):
        return jsonify({'message': 'branch_id, period y valor son obligatorios'}), 400
    exp = OperatingExpense(
        branch_id      = data['branch_id'],
        period         = data['period'],
        tipo           = data.get('tipo', 'otros'),
        descripcion    = data.get('descripcion') or None,
        valor          = float(data['valor']),
        registrado_por = user_id,
    )
    db.session.add(exp)
    db.session.commit()
    return jsonify(exp.to_dict()), 201


# ── Calcular rentabilidad de una sucursal ─────────────────────────────────────
@jwt_required()
def get_branch_profit(branch_id):
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403

    branch = Branch.query.get_or_404(branch_id)
    period = request.args.get('period', datetime.now().strftime('%Y-%m'))

    year, month = int(period.split('-')[0]), int(period.split('-')[1])
    last_day    = calendar.monthrange(year, month)[1]
    date_from   = f'{year}-{month:02d}-01'
    date_to     = f'{year}-{month:02d}-{last_day}'

    # Cajeros de esta sucursal
    cajeros_ids = [u.id for u in User.query.filter_by(branch_id=branch_id, is_active=True).all()]

    # Ventas brutas
    ventas_q = db.session.query(
        func.sum(Sale.total).label('total'),
        func.count(Sale.id).label('count')
    ).filter(
        Sale.cashier_id.in_(cajeros_ids) if cajeros_ids else Sale.id == 0,
        Sale.created_at >= date_from,
        Sale.created_at <= date_to + ' 23:59:59',
    ).first() if cajeros_ids else None

    ventas_brutas    = float(ventas_q.total or 0) if ventas_q else 0
    num_transacciones = int(ventas_q.count or 0) if ventas_q else 0
    ticket_promedio  = round(ventas_brutas / num_transacciones, 0) if num_transacciones > 0 else 0

    # Devoluciones
    devs_q = db.session.query(func.sum(ReturnOrder.total)).filter(
        ReturnOrder.cashier_id.in_(cajeros_ids) if cajeros_ids else ReturnOrder.id == 0,
        ReturnOrder.created_at >= date_from,
        ReturnOrder.created_at <= date_to + ' 23:59:59',
    ).scalar() if cajeros_ids else 0
    devoluciones = float(devs_q or 0)

    ingresos_netos = ventas_brutas - devoluciones

    # CMV (costo de lo vendido) — usando movimientos de salida de venta
    cmv_q = db.session.query(
        func.sum(InventoryMovement.quantity * InventoryMovement.unit_cost)
    ).filter(
        InventoryMovement.type == 'salida',
        InventoryMovement.reason == 'Venta',
        InventoryMovement.unit_cost != None,
        InventoryMovement.created_at >= date_from,
        InventoryMovement.created_at <= date_to + ' 23:59:59',
    ).scalar()
    cmv = float(cmv_q or 0)

    ganancia_bruta  = ingresos_netos - cmv
    margen_bruto    = round((ganancia_bruta / ingresos_netos * 100), 2) if ingresos_netos > 0 else 0

    # Nómina del período
    try:
        from models.payroll import PayrollRecord, PayrollPeriod
        period_obj = PayrollPeriod.query.filter_by(period=period).first()
        if period_obj:
            emp_ids = [e.id for e in db.session.query(db.text('id')).select_entity_from(
                __import__('models.payroll', fromlist=['Employee']).Employee.__table__
            ).filter_by() if True]
            # Simplificado: suma todos los registros del período
            nomina_q = db.session.query(func.sum(PayrollRecord.neto_a_pagar)).filter_by(period_id=period_obj.id).scalar()
            total_nomina = float(nomina_q or 0)
        else:
            total_nomina = 0
    except Exception:
        total_nomina = 0

    # Merma del período
    merma_q = db.session.query(func.sum(ShrinkageRecord.costo_total)).filter(
        ShrinkageRecord.created_at >= date_from,
        ShrinkageRecord.created_at <= date_to + ' 23:59:59',
    ).scalar()
    total_merma = float(merma_q or 0)

    # Gastos operativos registrados
    gastos_q = db.session.query(func.sum(OperatingExpense.valor)).filter_by(
        branch_id=branch_id, period=period
    ).scalar()
    gastos_op = float(gastos_q or 0)

    total_gastos = total_nomina + total_merma + gastos_op
    ganancia_operativa = ganancia_bruta - total_gastos
    margen_operativo   = round((ganancia_operativa / ingresos_netos * 100), 2) if ingresos_netos > 0 else 0

    # Desglose de gastos operativos por tipo
    gastos_desglose = db.session.query(
        OperatingExpense.tipo,
        func.sum(OperatingExpense.valor).label('total')
    ).filter_by(branch_id=branch_id, period=period).group_by(OperatingExpense.tipo).all()

    # Proyección (si es el mes en curso)
    es_proyeccion = False
    proyeccion = None
    hoy = date.today()
    if year == hoy.year and month == hoy.month and hoy.day < last_day:
        avance_pct = hoy.day / last_day
        proyeccion_ventas = ventas_brutas / avance_pct if avance_pct > 0 else 0
        proyeccion_ganancia = ganancia_operativa / avance_pct if avance_pct > 0 else 0
        es_proyeccion = True
        proyeccion = {
            'ventas_proyectadas': round(proyeccion_ventas, 0),
            'ganancia_proyectada': round(proyeccion_ganancia, 0),
            'avance_pct': round(avance_pct * 100, 1),
        }

    result = {
        'branch':               branch.to_dict(),
        'period':               period,
        'ventas_brutas':        ventas_brutas,
        'devoluciones':         devoluciones,
        'ingresos_netos':       ingresos_netos,
        'cmv':                  cmv,
        'ganancia_bruta':       ganancia_bruta,
        'margen_bruto_pct':     margen_bruto,
        'total_nomina':         total_nomina,
        'total_merma':          total_merma,
        'gastos_operativos':    gastos_op,
        'gastos_desglose':      {r.tipo: float(r.total) for r in gastos_desglose},
        'total_gastos':         total_gastos,
        'ganancia_operativa':   ganancia_operativa,
        'margen_operativo_pct': margen_operativo,
        'ticket_promedio':      ticket_promedio,
        'num_transacciones':    num_transacciones,
        'es_proyeccion':        es_proyeccion,
        'proyeccion':           proyeccion,
    }
    return jsonify(result), 200


# ── Comparativo todas las sucursales ──────────────────────────────────────────
@jwt_required()
def get_comparison():
    claims = get_jwt()
    if not _admin(claims): return jsonify({'message': 'Acceso denegado'}), 403
    period    = request.args.get('period', datetime.now().strftime('%Y-%m'))
    branches  = Branch.query.filter_by(is_active=True).all()

    results = []
    for b in branches:
        year, month = int(period.split('-')[0]), int(period.split('-')[1])
        last_day    = calendar.monthrange(year, month)[1]
        date_from   = f'{year}-{month:02d}-01'
        date_to     = f'{year}-{month:02d}-{last_day} 23:59:59'

        cajeros_ids = [u.id for u in User.query.filter_by(branch_id=b.id, is_active=True).all()]
        ventas = 0
        if cajeros_ids:
            v = db.session.query(func.sum(Sale.total)).filter(
                Sale.cashier_id.in_(cajeros_ids),
                Sale.created_at >= date_from,
                Sale.created_at <= date_to,
            ).scalar()
            ventas = float(v or 0)

        results.append({
            'branch_id':   b.id,
            'branch_name': b.nombre,
            'ventas':      ventas,
            'meta':        float(b.meta_ventas_mensual or 0),
            'pct_meta':    round(ventas / float(b.meta_ventas_mensual) * 100, 1) if b.meta_ventas_mensual else None,
        })

    results.sort(key=lambda x: x['ventas'], reverse=True)
    return jsonify(results), 200