from flask import Blueprint
from controllers.customer_controller import (
    get_customers, get_customer, search_customer,
    create_customer, update_customer, add_points,
    redeem_points, delete_customer
)

customers_bp = Blueprint('customers', __name__)

customers_bp.route('/',           methods=['GET'])(get_customers)
customers_bp.route('/search',     methods=['GET'])(search_customer)
customers_bp.route('/<int:id>',   methods=['GET'])(get_customer)
customers_bp.route('/',           methods=['POST'])(create_customer)
customers_bp.route('/<int:id>',   methods=['PUT'])(update_customer)
customers_bp.route('/<int:id>/points', methods=['POST'])(add_points)
customers_bp.route('/<int:id>/redeem', methods=['POST'])(redeem_points)
customers_bp.route('/<int:id>',   methods=['DELETE'])(delete_customer)