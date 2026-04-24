from flask import Blueprint
from controllers.presentation_controller import get_all, get_by_product, create, update, delete

presentations_bp = Blueprint('presentations', __name__)
presentations_bp.route('/',                         methods=['GET'])(get_all)
presentations_bp.route('/product/<int:product_id>', methods=['GET'])(get_by_product)
presentations_bp.route('/',                         methods=['POST'])(create)
presentations_bp.route('/<int:id>',                 methods=['PUT'])(update)
presentations_bp.route('/<int:id>',                 methods=['DELETE'])(delete)