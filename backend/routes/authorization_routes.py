from flask import Blueprint
from controllers.authorization_controller import (
    autorizar, reset_by_admin_seguro,
    crear_tarjeta, get_mi_tarjeta, revocar_tarjeta
)

auth_admin_bp = Blueprint('auth_admin', __name__)

auth_admin_bp.route('/autorizar',       methods=['POST'])(autorizar)
auth_admin_bp.route('/reset-seguro',    methods=['POST'])(reset_by_admin_seguro)
auth_admin_bp.route('/tarjeta',         methods=['POST'])(crear_tarjeta)
auth_admin_bp.route('/tarjeta',         methods=['GET'])(get_mi_tarjeta)
auth_admin_bp.route('/tarjeta/revocar', methods=['POST'])(revocar_tarjeta)