from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.customer import Customer, CreditTransaction
from models.sale import Sale
from extensions import db
from datetime import datetime

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_todas_facturas(customer_id):
    """Todas las facturas a crédito del cliente con su estado actual."""
    ventas = Sale.query.filter_by(customer_id=customer_id).filter(
        Sale.payment_method.like('%credito%')
    ).order_by(Sale.created_at.asc()).all()  # ASC para FIFO

    result = []
    for v in ventas:
        abonado = db.session.query(db.func.sum(CreditTransaction.amount))\
            .filter_by(sale_id=v.id, type='abono').scalar() or 0
        abonado   = float(abonado)
        total     = float(v.total)
        pendiente = round(total - abonado, 2)

        if pendiente < 0:
            pendiente = 0

        if pendiente == 0:
            estado = 'pagada'
        elif abonado > 0:
            estado = 'parcial'
        else:
            estado = 'pendiente'

        result.append({
            'sale_id':   v.id,
            'date':      str(v.created_at)[:10],
            'total':     total,
            'abonado':   abonado,
            'pendiente': pendiente,
            'estado':    estado,
            'items':     [i.to_dict() for i in v.items],
        })
    return result

def _get_facturas_pendientes(customer_id):
    """Solo facturas con saldo > 0."""
    return [f for f in _get_todas_facturas(customer_id) if f['pendiente'] > 0.01]

# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@jwt_required()
def get_cartera():
    customers = Customer.query.filter(Customer.credit_balance > 0).all()
    result = []
    for c in customers:
        txs      = CreditTransaction.query.filter_by(customer_id=c.id)\
            .order_by(CreditTransaction.created_at.desc()).all()
        facturas = _get_todas_facturas(c.id)
        result.append({
            **c.to_dict(),
            'transactions': [t.to_dict() for t in txs],
            'facturas':     facturas,
        })
    return jsonify(result), 200

@jwt_required()
def get_customer_credit(customer_id):
    c   = Customer.query.get_or_404(customer_id)
    txs = CreditTransaction.query.filter_by(customer_id=c.id)\
        .order_by(CreditTransaction.created_at.desc()).all()
    facturas = _get_todas_facturas(customer_id)
    return jsonify({
        **c.to_dict(),
        'transactions': [t.to_dict() for t in txs],
        'facturas':     facturas,
    }), 200

@jwt_required()
def get_transactions(customer_id):
    txs = CreditTransaction.query.filter_by(customer_id=customer_id)\
        .order_by(CreditTransaction.created_at.desc()).all()
    return jsonify([t.to_dict() for t in txs]), 200

@jwt_required()
def get_facturas(customer_id):
    Customer.query.get_or_404(customer_id)
    return jsonify(_get_todas_facturas(customer_id)), 200

@jwt_required()
def set_limit(customer_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Solo admins'}), 403
    c = Customer.query.get_or_404(customer_id)
    c.credit_limit = float(request.get_json().get('credit_limit', 0))
    db.session.commit()
    return jsonify(c.to_dict()), 200

@jwt_required()
def add_credit(customer_id):
    """Registra una nueva deuda (venta a crédito)."""
    user_id = int(get_jwt_identity())
    c       = Customer.query.get_or_404(customer_id)
    data    = request.get_json()
    amount  = float(data.get('amount', 0))
    sale_id = data.get('sale_id')

    if amount <= 0:
        return jsonify({'message': 'Monto inválido'}), 400

    lim = float(c.credit_limit or 0)
    bal = float(c.credit_balance or 0)
    if lim > 0 and (bal + amount) > lim:
        return jsonify({'message': f'Supera el límite de crédito (${lim:,.0f})'}), 400

    c.credit_balance = bal + amount
    tx = CreditTransaction(
        customer_id = c.id,
        sale_id     = sale_id or None,
        type        = 'credito',
        amount      = amount,
        note        = data.get('note', 'Venta a crédito'),
        created_by  = user_id,
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify({'customer': c.to_dict(), 'transaction': tx.to_dict()}), 201

@jwt_required()
def add_payment(customer_id):
    """
    Pago por factura específica o abono general FIFO.
    Si sale_id está presente → pago por factura.
    Si no → abono general aplicado FIFO (facturas más antiguas primero).
    """
    user_id = int(get_jwt_identity())
    c       = Customer.query.get_or_404(customer_id)
    data    = request.get_json()
    amount  = float(data.get('amount', 0))
    sale_id = data.get('sale_id')

    if amount <= 0:
        return jsonify({'message': 'Monto inválido'}), 400

    bal = float(c.credit_balance or 0)
    if amount > bal + 0.01:
        return jsonify({'message': f'El abono (${amount:,.0f}) supera la deuda total (${bal:,.0f})'}), 400

    afectadas = []  # para el comprobante

    # ── PAGO POR FACTURA ESPECÍFICA ──────────────────────────────────────
    if sale_id:
        venta = Sale.query.get(sale_id)
        if not venta:
            return jsonify({'message': 'Factura no encontrada'}), 404

        # Calcular pendiente de esa factura
        abonado_prev = db.session.query(db.func.sum(CreditTransaction.amount))\
            .filter_by(sale_id=sale_id, type='abono').scalar() or 0
        pendiente = float(venta.total) - float(abonado_prev)

        if pendiente <= 0:
            return jsonify({'message': 'Esta factura ya está pagada'}), 400
        if amount > pendiente + 0.01:
            return jsonify({'message': f'El monto (${amount:,.0f}) supera lo pendiente de esta factura (${pendiente:,.0f})'}), 400

        tx = CreditTransaction(
            customer_id = c.id,
            sale_id     = sale_id,
            type        = 'abono',
            amount      = amount,
            note        = data.get('note', f'Pago factura #{sale_id}'),
            created_by  = user_id,
        )
        db.session.add(tx)
        afectadas.append({'sale_id': sale_id, 'monto': amount})

        c.credit_balance = max(0, bal - amount)

    # ── ABONO GENERAL FIFO ───────────────────────────────────────────────
    else:
        facturas = _get_facturas_pendientes(customer_id)  # ya ordenadas ASC
        restante = amount

        for f in facturas:
            if restante <= 0.01:
                break
            pagar = min(restante, f['pendiente'])
            tx = CreditTransaction(
                customer_id = c.id,
                sale_id     = f['sale_id'],
                type        = 'abono',
                amount      = round(pagar, 2),
                note        = data.get('note', f'Abono general — factura #{f["sale_id"]}'),
                created_by  = user_id,
            )
            db.session.add(tx)
            afectadas.append({'sale_id': f['sale_id'], 'monto': round(pagar, 2)})
            restante -= pagar

        c.credit_balance = max(0, bal - amount)

    db.session.commit()

    # Comprobante
    facturas_actualizadas = _get_todas_facturas(customer_id)
    comprobante = {
        'tipo':        'factura' if sale_id else 'general',
        'cliente':     c.full_name,
        'monto':       amount,
        'fecha':       str(datetime.now())[:10],
        'afectadas':   afectadas,
        'saldo_total': float(c.credit_balance),
        'facturas':    facturas_actualizadas,
    }

    return jsonify({
        'message':     '✅ Pago registrado',
        'customer':    c.to_dict(),
        'comprobante': comprobante,
    }), 201