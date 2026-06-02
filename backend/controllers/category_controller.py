from flask import request, jsonify
from flask_jwt_extended import jwt_required
from models.category import Category
from extensions import db

@jwt_required()
def get_categories():
    categories = Category.query.all()
    return jsonify([c.to_dict() for c in categories]), 200


@jwt_required()
def create_category():
    data = request.get_json()

    category = Category(
     name=data['name'],
    is_active=data.get('is_active', True))

    db.session.add(category)
    db.session.commit()

    return jsonify(category.to_dict()), 201


@jwt_required()
def update_category(id):
    category = Category.query.get_or_404(id)

    data = request.get_json()

    category.name = data['name']
    category.is_active = data.get('is_active', category.is_active)

    db.session.commit()

    return jsonify(category.to_dict()), 200

# ✅ DESPUÉS — eliminar si no tiene productos, desactivar si sí tiene
@jwt_required()
def delete_category(id):
    from models.product import Product  # ajusta el import según tu estructura
    
    category = Category.query.get_or_404(id)
    
    tiene_productos = Product.query.filter_by(category=category.name).first()
    
    if tiene_productos:
        category.is_active = False
        db.session.commit()
        return jsonify({
            'message': f'La categoría "{category.name}" tiene productos asociados y fue desactivada.',
            'detail': 'Para eliminarla permanentemente, reasigna o elimina sus productos primero.',
            'action': 'deactivated'
        }), 200
    else:
        db.session.delete(category)
        db.session.commit()
        return jsonify({'message': 'Categoría eliminada', 'action': 'deleted'}), 200