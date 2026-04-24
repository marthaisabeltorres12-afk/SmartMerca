from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.coupon import LoyaltyCoupon
from models.customer import Customer
from extensions import db
from datetime import date
import secrets
import string

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

def _gen_codigo():
    chars = string.ascii_uppercase + string.digits
    while True:
        codigo = ''.join(secrets.choice(chars) for _ in range(8))
        if not LoyaltyCoupon.query.filter_by(codigo=codigo).first():
            return codigo


@jwt_required()
def get_cupones():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    customer_id = request.args.get('customer_id', type=int)
    q = LoyaltyCoupon.query
    if customer_id:
        q = q.filter_by(customer_id=customer_id)
    cupones = q.order_by(LoyaltyCoupon.created_at.desc()).all()
    return jsonify([c.to_dict() for c in cupones]), 200


@jwt_required()
def create_cupon():
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    user_id = int(get_jwt_identity())
    data    = request.get_json()

    if not data.get('tipo') or not data.get('valor'):
        return jsonify({'message': 'tipo y valor son obligatorios'}), 400
    if not data.get('fecha_inicio') or not data.get('fecha_fin'):
        return jsonify({'message': 'Las fechas de vigencia son obligatorias'}), 400

    codigo = data.get('codigo') or _gen_codigo()
    if LoyaltyCoupon.query.filter_by(codigo=codigo).first():
        return jsonify({'message': f'El código {codigo} ya existe'}), 400

    cupon = LoyaltyCoupon(
        customer_id  = int(data['customer_id']) if data.get('customer_id') else None,
        codigo       = codigo.upper(),
        tipo         = data['tipo'],
        valor        = float(data['valor']),
        fecha_inicio = data['fecha_inicio'],
        fecha_fin    = data['fecha_fin'],
        min_purchase = float(data.get('min_purchase', 0)),
        created_by   = user_id,
    )
    db.session.add(cupon)
    db.session.commit()
    return jsonify(cupon.to_dict()), 201


@jwt_required()
def delete_cupon(id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    cupon = LoyaltyCoupon.query.get_or_404(id)
    if cupon.usado:
        return jsonify({'message': 'No se puede eliminar un cupón ya usado'}), 400
    db.session.delete(cupon)
    db.session.commit()
    return jsonify({'message': 'Cupón eliminado'}), 200


@jwt_required()
def validate_cupon():
    """Valida un cupón y retorna el descuento aplicable."""
    data        = request.get_json()
    codigo      = data.get('codigo', '').upper()
    customer_id = data.get('customer_id')
    total       = float(data.get('total', 0))

    cupon = LoyaltyCoupon.query.filter_by(codigo=codigo).first()
    if not cupon:
        return jsonify({'valid': False, 'message': 'Cupón no encontrado'}), 200
    if cupon.usado:
        return jsonify({'valid': False, 'message': 'Este cupón ya fue utilizado'}), 200
    if not cupon.is_vigente:
        return jsonify({'valid': False, 'message': 'Cupón vencido o no vigente'}), 200
    if cupon.customer_id and cupon.customer_id != customer_id:
        return jsonify({'valid': False, 'message': 'Este cupón es para otro cliente'}), 200
    if total < float(cupon.min_purchase):
        return jsonify({'valid': False, 'message': f'Compra mínima requerida: ${float(cupon.min_purchase):,.0f}'}), 200

    # Calcular descuento
    if cupon.tipo == 'descuento_pct':
        descuento = round(total * float(cupon.valor) / 100, 0)
    elif cupon.tipo == 'descuento_fijo':
        descuento = min(float(cupon.valor), total)
    else:
        descuento = 0

    return jsonify({
        'valid':     True,
        'cupon_id':  cupon.id,
        'codigo':    cupon.codigo,
        'tipo':      cupon.tipo,
        'valor':     float(cupon.valor),
        'descuento': descuento,
        'message':   f'Cupón válido — Descuento: ${descuento:,.0f}',
    }), 200