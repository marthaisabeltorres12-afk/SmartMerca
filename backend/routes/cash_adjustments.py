from flask import Blueprint
from controllers.cash_adjustment_controller import get_adjustments, create_adjustment

cash_adjustments_bp = Blueprint('cash_adjustments', __name__)

cash_adjustments_bp.route('/', methods=['GET'])(get_adjustments)
cash_adjustments_bp.route('/', methods=['POST'])(create_adjustment)