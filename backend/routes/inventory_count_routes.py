from flask import Blueprint
from controllers.inventory_count_controller import (
    get_counts, create_count, get_count_items,
    register_count, approve_adjustments
)

inventory_counts_bp = Blueprint('inventory_counts', __name__)

inventory_counts_bp.route('/',                              methods=['GET'])(get_counts)
inventory_counts_bp.route('/',                              methods=['POST'])(create_count)
inventory_counts_bp.route('/<int:count_id>/items',          methods=['GET'])(get_count_items)
inventory_counts_bp.route('/<int:count_id>/register',       methods=['POST'])(register_count)
inventory_counts_bp.route('/<int:count_id>/approve',        methods=['POST'])(approve_adjustments)