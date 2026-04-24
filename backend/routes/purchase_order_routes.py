from flask import Blueprint
from controllers.purchase_order_controller import (
    get_orders, create_order, approve_order, cancel_order,
    receive_order, get_suggested_products
)

purchase_orders_bp = Blueprint('purchase_orders', __name__)

purchase_orders_bp.route('/',                        methods=['GET'])(get_orders)
purchase_orders_bp.route('/',                        methods=['POST'])(create_order)
purchase_orders_bp.route('/<int:id>/approve',        methods=['PATCH'])(approve_order)
purchase_orders_bp.route('/<int:id>/cancel',         methods=['PATCH'])(cancel_order)
purchase_orders_bp.route('/<int:id>/receive',        methods=['POST'])(receive_order)
purchase_orders_bp.route('/suggested',               methods=['GET'])(get_suggested_products)