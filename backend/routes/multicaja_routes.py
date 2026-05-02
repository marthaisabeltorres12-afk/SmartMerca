from flask import Blueprint
from controllers.multicaja_controller import (
    get_cajas, get_caja, crear_caja, editar_caja,
    eliminar_caja, dashboard_cajas, historial_caja,
    cajeros_disponibles, agregar_cajero, quitar_cajero,
)

multicaja_bp = Blueprint('multicaja', __name__)

multicaja_bp.route('/',                              methods=['GET'])(get_cajas)
multicaja_bp.route('/dashboard',                     methods=['GET'])(dashboard_cajas)
multicaja_bp.route('/cajeros',                       methods=['GET'])(cajeros_disponibles)
multicaja_bp.route('/<int:caja_id>',                 methods=['GET'])(get_caja)
multicaja_bp.route('/',                              methods=['POST'])(crear_caja)
multicaja_bp.route('/<int:caja_id>',                 methods=['PUT'])(editar_caja)
multicaja_bp.route('/<int:caja_id>',                 methods=['DELETE'])(eliminar_caja)
multicaja_bp.route('/<int:caja_id>/historial',       methods=['GET'])(historial_caja)
multicaja_bp.route('/<int:caja_id>/cajero',          methods=['POST'])(agregar_cajero)
multicaja_bp.route('/<int:caja_id>/cajero/<int:cajero_id>', methods=['DELETE'])(quitar_cajero)