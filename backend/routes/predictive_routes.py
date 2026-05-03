from flask import Blueprint
from controllers.predictive_controller import get_predicciones, get_tendencias_ventas

predictive_bp = Blueprint('predictive', __name__)

predictive_bp.route('/predicciones', methods=['GET'])(get_predicciones)
predictive_bp.route('/tendencias',   methods=['GET'])(get_tendencias_ventas)