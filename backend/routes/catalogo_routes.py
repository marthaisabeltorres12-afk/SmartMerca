from flask import Blueprint
from controllers.catalogo_controller import get_catalogo_productos

catalogo_bp = Blueprint('catalogo', __name__)
catalogo_bp.route('/productos', methods=['GET'])(get_catalogo_productos)