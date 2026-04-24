from flask import Blueprint
from controllers.supplier_controller import (
    get_suppliers, get_supplier, create_supplier, update_supplier, delete_supplier
)

suppliers_bp = Blueprint('suppliers', __name__)

suppliers_bp.route('/', methods=['GET'])(get_suppliers)
suppliers_bp.route('/<int:id>', methods=['GET'])(get_supplier)
suppliers_bp.route('/', methods=['POST'])(create_supplier)
suppliers_bp.route('/<int:id>', methods=['PUT'])(update_supplier)
suppliers_bp.route('/<int:id>', methods=['DELETE'])(delete_supplier)
