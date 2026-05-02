from flask import Blueprint
from controllers.auth_controller import login, get_me, forgot_password, reset_password, reset_by_admin,set_admin_pin

auth_bp = Blueprint('auth', __name__)

auth_bp.route('/login', methods=['POST'])(login)
auth_bp.route('/me', methods=['GET'])(get_me)
auth_bp.route('/forgot-password', methods=['POST'])(forgot_password)
auth_bp.route('/reset-password', methods=['POST'])(reset_password)
auth_bp.route('/reset-by-admin', methods=['POST'])(reset_by_admin)
auth_bp.route('/set-pin', methods=['POST'])(set_admin_pin)