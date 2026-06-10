from flask import Blueprint
from controllers.catalogo_controller import (
    get_catalogo_productos,
    get_catalogo_sucursales,
    get_catalogo_promociones,
)

catalogo_bp = Blueprint('catalogo', __name__)
catalogo_bp.route('/productos',   methods=['GET'])(get_catalogo_productos)
catalogo_bp.route('/sucursales',  methods=['GET'])(get_catalogo_sucursales)
catalogo_bp.route('/promociones', methods=['GET'])(get_catalogo_promociones)