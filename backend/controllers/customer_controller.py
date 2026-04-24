from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.customer import Customer
from extensions import db
import random, string

def _gen_nid():
    while True:
        nid = 'SM' + ''.join(random.choices(string.digits, k=6))
        if not Customer.query.filter_by(nid=nid).first():
            return nid

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_customers():
    customers = Customer.query.order_by(Customer.full_name).all()
    return jsonify([c.to_dict() for c in customers]), 200

@jwt_required()
def get_customer(id):
    c = Customer.query.get_or_404(id)
    return jsonify(c.to_dict()), 200

@jwt_required()
def search_customer():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([]), 200
    results = Customer.query.filter(
        (Customer.doc_number.like(f'%{q}%')) |
        (Customer.full_name.like(f'%{q}%')) |
        (Customer.nid.like(f'%{q}%'))
    ).filter_by(is_active=True).limit(10).all()
    return jsonify([c.to_dict() for c in results]), 200

@jwt_required()
def create_customer():
    data = request.get_json()
    if Customer.query.filter_by(doc_number=data.get('doc_number')).first():
        return jsonify({'message': 'Ya existe un cliente con ese número de documento'}), 400
    customer = Customer(
        nid        = _gen_nid(),
        doc_type   = data.get('doc_type', 'CC'),
        doc_number = data['doc_number'],
        full_name  = data['full_name'],
        email      = data.get('email'),
        phone      = data.get('phone'),
        address    = data.get('address'),
        points     = 0,
        is_active  = True
    )
    db.session.add(customer)
    db.session.commit()
    return jsonify(customer.to_dict()), 201

@jwt_required()
def update_customer(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    customer = Customer.query.get_or_404(id)
    data = request.get_json()
    for key in ['doc_type','doc_number','full_name','email','phone','address','is_active']:
        if key in data:
            setattr(customer, key, data[key])
    db.session.commit()
    return jsonify(customer.to_dict()), 200

@jwt_required()
def add_points(id):
    customer = Customer.query.get_or_404(id)
    data     = request.get_json()
    customer.points += int(data.get('points', 0))
    db.session.commit()
    return jsonify(customer.to_dict()), 200

@jwt_required()
def redeem_points(id):
    customer = Customer.query.get_or_404(id)
    data     = request.get_json()
    pts      = int(data.get('points', 0))
    if customer.points < pts:
        return jsonify({'message': 'Puntos insuficientes'}), 400
    customer.points -= pts
    db.session.commit()
    discount = (pts // 100) * 1000
    return jsonify({'customer': customer.to_dict(), 'discount': discount}), 200

@jwt_required()
def delete_customer(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    customer = Customer.query.get_or_404(id)

    # Verificar si tiene ventas asociadas
    from models.sale import Sale
    ventas = Sale.query.filter_by(customer_id=id).count()
    if ventas > 0:
        return jsonify({
            'message': f'Este cliente tiene {ventas} venta(s) registrada(s) y no puede eliminarse. Puede desactivarlo para que no aparezca en búsquedas.',
            'has_sales': True,
            'sales_count': ventas
        }), 409

    db.session.delete(customer)
    db.session.commit()
    return jsonify({'message': 'Cliente eliminado'}), 200