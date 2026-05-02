from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.shift import Shift, ShiftWithdrawal
from models.sale import Sale
from models.sale_payment import SalePayment
from models.user import User
from extensions import db
from datetime import datetime

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

def _calc_totals(shift):
    q = Sale.query.filter(
        Sale.cashier_id == shift.cashier_id,
        Sale.created_at >= shift.opened_at
    )
    if shift.closed_at:
        q = q.filter(Sale.created_at <= shift.closed_at)
    sales    = q.all()
    sale_ids = [s.id for s in sales]

    total_sales = sum(float(s.total) for s in sales)
    total_wd    = sum(float(w.amount) for w in shift.withdrawals)

    total_cash = total_card = total_nequi = total_transfer = total_credit = 0.0
    if sale_ids:
        payments = SalePayment.query.filter(SalePayment.sale_id.in_(sale_ids)).all()
        for p in payments:
            m = (p.metodo or '').lower()
            if m == 'efectivo':        total_cash     += float(p.monto)
            elif m == 'tarjeta':       total_card     += float(p.monto)
            elif m == 'nequi':         total_nequi    += float(p.monto)
            elif m == 'transferencia': total_transfer += float(p.monto)
            elif m == 'credito':       total_credit   += float(p.monto)

    if not sale_ids or total_cash + total_card + total_nequi + total_transfer + total_credit == 0:
        def pm(s, kw): return kw in (s.payment_method or '')
        total_cash     = sum(float(s.total) for s in sales if pm(s,'efectivo') or pm(s,'mixto'))
        total_card     = sum(float(s.total) for s in sales if pm(s,'tarjeta'))
        total_nequi    = sum(float(s.total) for s in sales if pm(s,'nequi'))
        total_transfer = sum(float(s.total) for s in sales if pm(s,'transferencia'))
        total_credit   = sum(float(s.total) for s in sales if pm(s,'credito'))

    return {
        'total_sales':      total_sales,
        'total_cash':       total_cash,
        'total_card':       total_card,
        'total_nequi':      total_nequi,
        'total_transfer':   total_transfer,
        'total_credit':     total_credit,
        'total_withdrawals':total_wd,
        'sales_count':      len(sales),
    }

def _shift_dict(shift):
    d = shift.to_dict()
    if shift.status == 'abierto':
        t = _calc_totals(shift)
        d.update(t)
    return d

# ── AUTO-ABRIR TURNO al iniciar sesión ───────────────────────────────────
def auto_open_shift(user_id):
    """
    Llamar desde auth_controller.login() después de autenticar.
    Busca la caja donde el cajero está autorizado y no hay turno activo.
    """
    try:
        from models.cash_register import CashRegister
        from models.user import User

        # Verificar si ya tiene turno abierto
        turno_existente = Shift.query.filter_by(
            cashier_id=user_id, status='abierto'
        ).first()
        if turno_existente:
            return _shift_dict(turno_existente)

        # Buscar cajas donde este cajero está autorizado
        cajero = User.query.get(user_id)
        if not cajero:
            return None

        cajas_autorizadas = [c for c in cajero.cajas_autorizadas if c.is_active]
        if not cajas_autorizadas:
            return None  # Sin caja asignada

        # Buscar la primera caja disponible (sin turno activo)
        for caja in cajas_autorizadas:
            turno_caja = Shift.query.filter_by(
                cash_register_id=caja.id, status='abierto'
            ).first()
            if not turno_caja:
                # Abrir turno en esta caja
                shift = Shift(
                    cashier_id       = user_id,
                    cash_register_id = caja.id,
                    base_amount      = float(caja.base_amount or 0),
                    branch_id        = caja.branch_id,
                    status           = 'abierto',
                )
                db.session.add(shift)
                db.session.commit()
                return _shift_dict(shift)

        # Todas las cajas ocupadas — abrir en la primera sin importar
        # (caso: mismo cajero en doble turno, no debería pasar normalmente)
        return None

    except Exception as e:
        print(f'[auto_open_shift] Error: {e}')
        return None

# ── Turno activo del cajero ───────────────────────────────────────────────
@jwt_required()
def get_active_shift():
    user_id = int(get_jwt_identity())
    shift   = Shift.query.filter_by(cashier_id=user_id, status='abierto').first()
    return jsonify(_shift_dict(shift) if shift else None), 200

# ── Todos los turnos ──────────────────────────────────────────────────────
@jwt_required()
def get_all_shifts():
    claims  = get_jwt()
    user_id = int(get_jwt_identity())
    if _admin(claims):
        shifts = Shift.query.order_by(Shift.opened_at.desc()).all()
    else:
        shifts = Shift.query.filter_by(cashier_id=user_id).order_by(Shift.opened_at.desc()).all()
    return jsonify([_shift_dict(s) for s in shifts]), 200

# ── Abrir turno manual (admin — por si acaso) ─────────────────────────────
@jwt_required()
def open_shift():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins pueden abrir turnos manualmente'}), 403

    data       = request.get_json()
    cashier_id = data.get('cashier_id')
    if not cashier_id:
        return jsonify({'message': 'Selecciona un cajero'}), 400

    existing = Shift.query.filter_by(cashier_id=cashier_id, status='abierto').first()
    if existing:
        return jsonify({'message': 'Este cajero ya tiene un turno abierto', 'shift': _shift_dict(existing)}), 400

    shift = Shift(
        cashier_id       = int(cashier_id),
        base_amount      = float(data.get('base_amount', 0)),
        branch_id        = int(data['branch_id']) if data.get('branch_id') else None,
        cash_register_id = int(data['cash_register_id']) if data.get('cash_register_id') else None,
        status           = 'abierto',
    )
    db.session.add(shift)
    db.session.commit()
    return jsonify(_shift_dict(shift)), 201

# ── Admin solicita conteo ─────────────────────────────────────────────────
@jwt_required()
def request_count(shift_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403
    shift = Shift.query.get_or_404(shift_id)
    shift.cashier_count_requested = True
    db.session.commit()
    return jsonify(_shift_dict(shift)), 200

# ── Cajero envía conteo ───────────────────────────────────────────────────
@jwt_required()
def submit_cashier_count(shift_id):
    user_id = int(get_jwt_identity())
    shift   = Shift.query.get_or_404(shift_id)
    if shift.cashier_id != user_id:
        return jsonify({'message': 'No es tu turno'}), 403
    data = request.get_json()
    shift.cash_counted_by_cashier = float(data.get('cash_counted', 0))
    db.session.commit()
    return jsonify(_shift_dict(shift)), 200

# ── Cerrar turno (admin) ──────────────────────────────────────────────────
@jwt_required()
def close_shift():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins pueden cerrar turnos'}), 403

    data     = request.get_json()
    shift_id = data.get('shift_id')
    shift    = Shift.query.get(shift_id) if shift_id else None
    if not shift or shift.status != 'abierto':
        return jsonify({'message': 'Turno no encontrado o ya cerrado'}), 404

    t = _calc_totals(shift)
    cash_expected = float(shift.base_amount) + t['total_cash'] - t['total_withdrawals']
    cashier_count = float(shift.cash_counted_by_cashier or 0)
    difference    = cashier_count - cash_expected

    shift.closed_at         = datetime.utcnow()
    shift.cash_counted      = cashier_count
    shift.total_sales       = t['total_sales']
    shift.total_cash        = t['total_cash']
    shift.total_card        = t['total_card']
    shift.total_nequi       = t['total_nequi']
    shift.total_transfer    = t['total_transfer']
    shift.total_credit      = t['total_credit']
    shift.total_withdrawals = t['total_withdrawals']
    shift.difference        = difference
    shift.notes             = data.get('notes', '')
    shift.status            = 'cerrado'

    try:
        from controllers.branch_controller import calcular_puntos_turno
        calcular_puntos_turno(shift)
    except Exception:
        pass

    db.session.commit()
    return jsonify({'shift': _shift_dict(shift), 'cash_expected': cash_expected}), 200

# ── Cajero solicita cerrar turno ──────────────────────────────────────────
@jwt_required()
def cashier_request_close(shift_id):
    user_id = int(get_jwt_identity())
    shift   = Shift.query.get_or_404(shift_id)
    if shift.cashier_id != user_id:
        return jsonify({'message': 'No es tu turno'}), 403
    if shift.status != 'abierto':
        return jsonify({'message': 'Este turno no está abierto'}), 400

    data         = request.get_json()
    cash_counted = float(data.get('cash_counted', 0))
    t            = _calc_totals(shift)
    cash_expected = float(shift.base_amount) + t['total_cash'] - t['total_withdrawals']
    difference    = cash_counted - cash_expected

    shift.cash_counted_by_cashier = cash_counted
    shift.cashier_count_requested = True
    shift.status                  = 'pendiente_cierre'
    db.session.commit()

    return jsonify({
        'shift':        _shift_dict(shift),
        'cash_expected':cash_expected,
        'difference':   difference,
        'message':      'Solicitud de cierre enviada. El administrador aprobará el cierre.',
    }), 200

# ── Admin aprueba cierre ──────────────────────────────────────────────────
@jwt_required()
def approve_close(shift_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    shift = Shift.query.get_or_404(shift_id)
    if shift.status != 'pendiente_cierre':
        return jsonify({'message': 'No hay solicitud pendiente'}), 400

    data = request.get_json()
    t    = _calc_totals(shift)

    cash_expected = float(shift.base_amount) + t['total_cash'] - t['total_withdrawals']
    cashier_count = float(shift.cash_counted_by_cashier or 0)
    difference    = cashier_count - cash_expected

    shift.closed_at         = datetime.utcnow()
    shift.cash_counted      = cashier_count
    shift.total_sales       = t['total_sales']
    shift.total_cash        = t['total_cash']
    shift.total_card        = t['total_card']
    shift.total_nequi       = t['total_nequi']
    shift.total_transfer    = t['total_transfer']
    shift.total_credit      = t['total_credit']
    shift.total_withdrawals = t['total_withdrawals']
    shift.difference        = difference
    shift.notes             = data.get('notes', '')
    shift.status            = 'cerrado'

    try:
        from controllers.branch_controller import calcular_puntos_turno
        calcular_puntos_turno(shift)
    except Exception:
        pass

    db.session.commit()
    return jsonify({'shift': _shift_dict(shift), 'cash_expected': cash_expected, 'difference': difference}), 200

# ── Admin rechaza cierre ──────────────────────────────────────────────────
@jwt_required()
def reject_close(shift_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403

    shift = Shift.query.get_or_404(shift_id)
    if shift.status != 'pendiente_cierre':
        return jsonify({'message': 'No hay solicitud pendiente'}), 400

    data = request.get_json()
    shift.status                  = 'abierto'
    shift.cashier_count_requested = False
    shift.cash_counted_by_cashier = None
    shift.notes                   = data.get('motivo', '')
    db.session.commit()
    return jsonify({'message': 'Cierre rechazado — el cajero debe recontar', 'shift': _shift_dict(shift)}), 200

# ── Retiro ────────────────────────────────────────────────────────────────
@jwt_required()
def add_withdrawal():
    data     = request.get_json()
    shift_id = data.get('shift_id')
    shift    = Shift.query.get(shift_id)
    if not shift or shift.status != 'abierto':
        return jsonify({'message': 'Turno no encontrado'}), 404

    amount = float(data.get('amount', 0))
    reason = (data.get('reason') or '').strip()
    if amount <= 0: return jsonify({'message': 'Monto inválido'}), 400
    if not reason:  return jsonify({'message': 'Ingresa el motivo'}), 400

    w = ShiftWithdrawal(
        shift_id      = shift.id,
        amount        = amount,
        reason        = reason,
        authorized_by = data.get('authorized_by') or None,
    )
    db.session.add(w)
    db.session.commit()
    return jsonify(w.to_dict()), 201

# ── Detalle turno ─────────────────────────────────────────────────────────
@jwt_required()
def get_shift(id):
    shift = Shift.query.get_or_404(id)
    return jsonify(_shift_dict(shift)), 200