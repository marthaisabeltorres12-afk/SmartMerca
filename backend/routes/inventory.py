from flask import Blueprint
from controllers.inventory_controller import (
    get_movements, create_entry, create_entry_new_product,
    create_entry_batch, create_exit, get_batches, conteo_rapido, notificar_faltante
)

inventory_bp = Blueprint('inventory', __name__)
inventory_bp.route('/',              methods=['GET'])(get_movements)
inventory_bp.route('/entrada',       methods=['POST'])(create_entry)
inventory_bp.route('/entrada-nuevo', methods=['POST'])(create_entry_new_product)
inventory_bp.route('/entrada-pedido',methods=['POST'])(create_entry_batch)
inventory_bp.route('/salida',        methods=['POST'])(create_exit)
inventory_bp.route('/batches',       methods=['GET'])(get_batches)
inventory_bp.route('/conteo-rapido',     methods=['POST'])(conteo_rapido)
inventory_bp.route('/notificar-faltante',methods=['POST'])(notificar_faltante)