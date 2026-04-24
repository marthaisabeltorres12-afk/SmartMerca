from flask import Blueprint
from controllers.sale_controller import get_sales, get_sales_by_cashier, get_sales_by_cashier_detail, create_sale

sales_bp = Blueprint('sales', __name__)
sales_bp.route('/', methods=['GET'])(get_sales)
sales_bp.route('/by-cashier', methods=['GET'])(get_sales_by_cashier)
sales_bp.route('/by-cashier-detail', methods=['GET'])(get_sales_by_cashier_detail)   # ← NUEVO
sales_bp.route('/', methods=['POST'])(create_sale)