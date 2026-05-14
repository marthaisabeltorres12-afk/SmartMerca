from flask import Blueprint
from controllers.ia_controller import identificar_producto, estado_ollama

ia_bp = Blueprint('ia', __name__)

ia_bp.route('/identificar', methods=['POST'])(identificar_producto)
ia_bp.route('/estado',      methods=['GET'])(estado_ollama)