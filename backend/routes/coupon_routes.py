from flask import Blueprint
from controllers.coupon_controller import get_cupones, create_cupon, delete_cupon, validate_cupon

coupons_bp = Blueprint('coupons', __name__)

coupons_bp.route('/',          methods=['GET'])(get_cupones)
coupons_bp.route('/',          methods=['POST'])(create_cupon)
coupons_bp.route('/<int:id>',  methods=['DELETE'])(delete_cupon)
coupons_bp.route('/validate',  methods=['POST'])(validate_cupon)