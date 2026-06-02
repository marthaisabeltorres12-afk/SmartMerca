from flask import Blueprint
from controllers.category_controller import (
    get_categories,
    create_category,
    update_category,
    delete_category
)

categories_bp = Blueprint('categories', __name__)

categories_bp.route('/', methods=['GET'])(get_categories)
categories_bp.route('/', methods=['POST'])(create_category)
categories_bp.route('/<int:id>', methods=['PUT'])(update_category)
categories_bp.route('/<int:id>', methods=['DELETE'])(delete_category)