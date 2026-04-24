from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.branch import Branch, CashierPoints
from models.shift import Shift
from models.sale import Sale
from models.user import User
from extensions import db
from sqlalchemy import func
from datetime import datetime

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

def _tecnico(claims):
    return claims.get('role') == 'admin_tecnico'

# ── CRUD sucursales ───────────────────────────────────────────────────────────
@jwt_required()
def get_branches():
    branches = Branch.query.filter_by(is_active=True).order_by(Branch.nombre).all()
    return jsonify([b.to_dict() for b in branches]), 200


@jwt_required()
def create_branch():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    if not data.get('nombre'):
        return jsonify({'message': 'El nombre es obligatorio'}), 400
    b = Branch(
        nombre              = data['nombre'],
        direccion           = data.get('direccion') or None,
        ciudad              = data.get('ciudad') or None,
        telefono            = data.get('telefono') or None,
        meta_ventas_mensual = float(data['meta_ventas_mensual']) if data.get('meta_ventas_mensual') else None,
    )
    db.session.add(b)
    db.session.commit()
    return jsonify(b.to_dict()), 201


@jwt_required()
def update_branch(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    b    = Branch.query.get_or_404(id)
    data = request.get_json()
    for k in ('nombre', 'direccion', 'ciudad', 'telefono', 'is_active'):
        if k in data: setattr(b, k, data[k])
    if 'meta_ventas_mensual' in data:
        b.meta_ventas_mensual = float(data['meta_ventas_mensual']) if data['meta_ventas_mensual'] else None
    db.session.commit()
    return jsonify(b.to_dict()), 200


# ── Stats de una sucursal ─────────────────────────────────────────────────────
@jwt_required()
def get_branch_stats(branch_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    branch = Branch.query.get_or_404(branch_id)
    now    = datetime.now()
    period = f'{now.year}-{now.month:02d}'
    date_from = f'{now.year}-{now.month:02d}-01'

    # Ventas del mes en esta sucursal (por cajeros de esta sucursal)
    cajeros_ids = [u.id for u in User.query.filter_by(branch_id=branch_id, is_active=True).all()]

    ventas = db.session.query(func.sum(Sale.total), func.count(Sale.id)).filter(
        Sale.cashier_id.in_(cajeros_ids),
        Sale.created_at >= date_from,
    ).first() if cajeros_ids else (0, 0)

    total_ventas = float(ventas[0] or 0)
    num_ventas   = int(ventas[1] or 0)
    meta         = float(branch.meta_ventas_mensual or 0)
    pct_meta     = round((total_ventas / meta * 100), 1) if meta > 0 else None

    return jsonify({
        'branch':       branch.to_dict(),
        'period':       period,
        'ventas_mes':   total_ventas,
        'num_ventas':   num_ventas,
        'meta':         meta,
        'pct_meta':     pct_meta,
        'cajeros':      len(cajeros_ids),
    }), 200


# ── Ranking de cajeros ────────────────────────────────────────────────────────
@jwt_required()
def get_ranking():
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    now     = datetime.now()
    period  = request.args.get('period', f'{now.year}-{now.month:02d}')
    branch_id = request.args.get('branch_id', type=int)

    q = CashierPoints.query.filter_by(period=period)
    if branch_id:
        q = q.filter_by(branch_id=branch_id)

    ranking = q.order_by(CashierPoints.points_earned.desc()).all()
    return jsonify([r.to_dict() for r in ranking]), 200


@jwt_required()
def get_my_stats():
    user_id = int(get_jwt_identity())
    now     = datetime.now()
    period  = request.args.get('period', f'{now.year}-{now.month:02d}')

    record = CashierPoints.query.filter_by(user_id=user_id, period=period).first()
    # Historial últimos 6 meses
    historial = CashierPoints.query.filter_by(user_id=user_id)\
        .order_by(CashierPoints.period.desc()).limit(6).all()

    return jsonify({
        'current': record.to_dict() if record else None,
        'historial': [r.to_dict() for r in historial],
    }), 200


# ── Calcular puntos al cerrar turno ───────────────────────────────────────────
def calcular_puntos_turno(shift):
    """
    Calcula y acumula puntos del cajero al cerrar un turno.
    Llamar desde shift_controller después de cerrar.
    """
    try:
        now    = datetime.now()
        period = f'{now.year}-{now.month:02d}'

        total  = float(shift.total_sales or 0)
        count  = shift.withdrawals  # se usa sales_count del shift

        # Puntos base: 1 punto por cada $10.000 vendidos
        puntos = int(total / 10000)
        # Bonus: +5 si hizo 50 o más ventas en el turno
        # (sales_count se calcula en _calc_totals, guardado en total_sales)

        if puntos <= 0:
            return

        record = CashierPoints.query.filter_by(
            user_id=shift.cashier_id, period=period
        ).first()

        if record:
            record.total_sales  += 1
            record.total_amount  = float(record.total_amount) + total
            record.points_earned += puntos
            record.avg_ticket    = float(record.total_amount) / record.total_sales if record.total_sales > 0 else 0
        else:
            user = User.query.get(shift.cashier_id)
            record = CashierPoints(
                user_id       = shift.cashier_id,
                branch_id     = shift.branch_id or (user.branch_id if user else None),
                period        = period,
                total_sales   = 1,
                total_amount  = total,
                avg_ticket    = total,
                points_earned = puntos,
            )
            db.session.add(record)

        shift.points_earned = puntos

        # Recalcular ranks
        _recalcular_ranks(period, record.branch_id)
        db.session.commit()

    except Exception as e:
        import logging
        logging.error(f'Error calculando puntos turno: {e}')


def _recalcular_ranks(period, branch_id):
    """Recalcula posiciones en el ranking."""
    # Global
    todos = CashierPoints.query.filter_by(period=period)\
        .order_by(CashierPoints.points_earned.desc()).all()
    for i, r in enumerate(todos):
        r.rank_global = i + 1

    # Por sucursal
    if branch_id:
        sucursal = CashierPoints.query.filter_by(period=period, branch_id=branch_id)\
            .order_by(CashierPoints.points_earned.desc()).all()
        for i, r in enumerate(sucursal):
            r.rank_in_branch = i + 1