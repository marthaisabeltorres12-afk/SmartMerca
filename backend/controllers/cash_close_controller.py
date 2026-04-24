from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.cash_close import CashClose
from models.sale import Sale
from extensions import db
from datetime import date

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_closes():
    claims = get_jwt()
    user_id = int(get_jwt_identity())
    if _is_admin(claims):
        closes = CashClose.query.order_by(CashClose.created_at.desc()).all()
    else:
        closes = CashClose.query.filter_by(cashier_id=user_id).order_by(CashClose.created_at.desc()).all()
    return jsonify([c.to_dict() for c in closes]), 200

@jwt_required()
def create_close():
    user_id = int(get_jwt_identity())
    data    = request.get_json()
    today   = date.today()

    # Verificar que no haya cierre ya para hoy
    existing = CashClose.query.filter_by(cashier_id=user_id, date=today).first()
    if existing:
        return jsonify({'message': 'Ya registraste un cierre de caja hoy'}), 400

    # Calcular ventas del sistema del cajero hoy
    sales = Sale.query.filter(
        Sale.cashier_id == user_id,
        db.func.date(Sale.created_at) == today
    ).all()
    system_total = sum(float(s.total) for s in sales)

    cash_counted = float(data.get('cash_counted', 0))
    difference   = cash_counted - system_total

    close = CashClose(
        cashier_id   = user_id,
        date         = today,
        system_total = system_total,
        cash_counted = cash_counted,
        difference   = difference,
        observations = data.get('observations', ''),
        status       = 'pendiente'
    )
    db.session.add(close)
    db.session.commit()
    return jsonify(close.to_dict()), 201

@jwt_required()
def review_close(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    close = CashClose.query.get_or_404(id)
    data  = request.get_json()
    close.status        = data.get('status', close.status)
    close.admin_comment = data.get('admin_comment', '')
    close.reviewed_by   = int(get_jwt_identity())
    db.session.commit()
    return jsonify(close.to_dict()), 200