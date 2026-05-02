from flask import Blueprint
from controllers.cart_reservation_controller import reservar, liberar, stock_disponible_bulk

reservas_bp = Blueprint('reservas', __name__)

reservas_bp.route('/reservar', methods=['POST'])(reservar)
reservas_bp.route('/liberar',  methods=['POST'])(liberar)
reservas_bp.route('/stock',    methods=['GET'])(stock_disponible_bulk)