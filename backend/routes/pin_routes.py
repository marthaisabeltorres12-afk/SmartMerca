from flask import Blueprint
from controllers.pin_controller import verify_pin, set_pin

pin_bp = Blueprint('pin', __name__)
pin_bp.route('/verify', methods=['POST'])(verify_pin)
pin_bp.route('/set',    methods=['POST'])(set_pin)