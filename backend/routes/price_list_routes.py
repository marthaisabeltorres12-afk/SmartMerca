from flask import Blueprint
from controllers.price_list_controller import (
    get_price_lists, create_price_list, update_price_list,
    get_price_list_items, upsert_price_list_item, delete_price_list_item,
    get_customer_price
)

price_lists_bp = Blueprint('price_lists', __name__)

price_lists_bp.route('/',                               methods=['GET'])(get_price_lists)
price_lists_bp.route('/',                               methods=['POST'])(create_price_list)
price_lists_bp.route('/<int:id>',                       methods=['PUT'])(update_price_list)
price_lists_bp.route('/<int:id>/items',                 methods=['GET'])(get_price_list_items)
price_lists_bp.route('/<int:id>/items',                 methods=['POST'])(upsert_price_list_item)
price_lists_bp.route('/<int:id>/items/<int:item_id>',   methods=['DELETE'])(delete_price_list_item)
price_lists_bp.route('/customer/<int:customer_id>/product/<int:product_id>', methods=['GET'])(get_customer_price)