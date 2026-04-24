from flask import Blueprint
from controllers.product_controller import (
    get_products, get_product, create_product, update_product, delete_product, toggle_product,
    get_price_history
)

products_bp = Blueprint('products', __name__)

products_bp.route('/', methods=['GET'])(get_products)
products_bp.route('/<int:id>', methods=['GET'])(get_product)
products_bp.route('/', methods=['POST'])(create_product)
products_bp.route('/<int:id>', methods=['PUT'])(update_product)
products_bp.route('/<int:id>', methods=['DELETE'])(delete_product)
products_bp.route('/<int:id>/toggle', methods=['PATCH'])(toggle_product)
products_bp.route('/<int:id>/price-history', methods=['GET'])(get_price_history)