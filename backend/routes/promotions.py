from flask import Blueprint
from controllers.promotion_controller import (
    get_promotions, get_active_promotions,
    create_promotion, update_promotion,
    delete_promotion, toggle_promotion
)

promotions_bp = Blueprint('promotions', __name__)

promotions_bp.route('/',           methods=['GET'])(get_promotions)
promotions_bp.route('/active',     methods=['GET'])(get_active_promotions)
promotions_bp.route('/',           methods=['POST'])(create_promotion)
promotions_bp.route('/<int:id>',   methods=['PUT'])(update_promotion)
promotions_bp.route('/<int:id>',   methods=['DELETE'])(delete_promotion)
promotions_bp.route('/<int:id>/toggle', methods=['PATCH'])(toggle_promotion)