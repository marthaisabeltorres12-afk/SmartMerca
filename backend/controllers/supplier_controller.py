from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.supplier import Supplier
from extensions import db

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def get_suppliers():
    suppliers = Supplier.query.all()
    return jsonify([s.to_dict() for s in suppliers]), 200

@jwt_required()
def get_supplier(id):
    supplier = Supplier.query.get_or_404(id)
    return jsonify(supplier.to_dict()), 200

@jwt_required()
def create_supplier():
    data = request.get_json()

    supplier = Supplier(
        company_name=data.get('company_name'),
        name=data.get('name'),
        contact_name=data.get('contact_name'),
        email=data.get('email'),
        phone=data.get('phone'),
        address=data.get('address')
    )

    db.session.add(supplier)
    db.session.commit()

    return jsonify({"message": "Proveedor creado"})

@jwt_required()
def update_supplier(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    supplier = Supplier.query.get_or_404(id)
    data = request.get_json()
    for key, value in data.items():
        if hasattr(supplier, key):
            setattr(supplier, key, value)
    db.session.commit()
    return jsonify(supplier.to_dict()), 200

@jwt_required()
def delete_supplier(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    supplier = Supplier.query.get_or_404(id)
    db.session.delete(supplier)
    db.session.commit()
    return jsonify({'message': 'Proveedor eliminado'}), 200