from flask import Blueprint
from controllers.replenishment_controller import get_suggestions, create_order_from_suggestion

replenishment_bp = Blueprint('replenishment', __name__)

replenishment_bp.route('/suggestions',    methods=['GET'])(get_suggestions)
replenishment_bp.route('/create-order',   methods=['POST'])(create_order_from_suggestion)