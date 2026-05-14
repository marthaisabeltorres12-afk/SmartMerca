from flask import Blueprint
from controllers.domicilio_controller import (
    get_domiciliarios, create_domiciliario, update_domiciliario,
    get_domicilios, create_domicilio, update_estado_domicilio,
    get_domicilio, get_stats_domicilios,
)

domicilios_bp = Blueprint('domicilios', __name__)

# Domiciliarios
domicilios_bp.route('/domiciliarios',        methods=['GET'])(get_domiciliarios)
domicilios_bp.route('/domiciliarios',        methods=['POST'])(create_domiciliario)
domicilios_bp.route('/domiciliarios/<int:id>', methods=['PUT'])(update_domiciliario)

# Pedidos
domicilios_bp.route('/',              methods=['GET'])(get_domicilios)
domicilios_bp.route('/',              methods=['POST'])(create_domicilio)
domicilios_bp.route('/<int:id>',      methods=['GET'])(get_domicilio)
domicilios_bp.route('/<int:id>/estado', methods=['PUT'])(update_estado_domicilio)
domicilios_bp.route('/stats',         methods=['GET'])(get_stats_domicilios)