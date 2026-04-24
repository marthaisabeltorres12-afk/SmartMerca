from flask import Blueprint
from controllers.supplier_invoice_controller import (
    get_invoices, create_invoice, register_payment, get_cartera
)

supplier_invoices_bp = Blueprint('supplier_invoices', __name__)

supplier_invoices_bp.route('/',                         methods=['GET'])(get_invoices)
supplier_invoices_bp.route('/',                         methods=['POST'])(create_invoice)
supplier_invoices_bp.route('/<int:invoice_id>/payment', methods=['POST'])(register_payment)
supplier_invoices_bp.route('/cartera',                  methods=['GET'])(get_cartera)