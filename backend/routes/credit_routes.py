from flask import Blueprint
from controllers.credit_controller import (
    get_cartera, get_customer_credit, get_transactions, get_facturas,
    set_limit, add_credit, add_payment
)

credit_bp = Blueprint('credit', __name__)
credit_bp.route('/',                                    methods=['GET'])(get_cartera)
credit_bp.route('/<int:customer_id>',                   methods=['GET'])(get_customer_credit)
credit_bp.route('/<int:customer_id>/transactions',      methods=['GET'])(get_transactions)
credit_bp.route('/<int:customer_id>/facturas',          methods=['GET'])(get_facturas)
credit_bp.route('/<int:customer_id>/limit',             methods=['POST'])(set_limit)
credit_bp.route('/<int:customer_id>/credito',           methods=['POST'])(add_credit)
credit_bp.route('/<int:customer_id>/abono',             methods=['POST'])(add_payment)