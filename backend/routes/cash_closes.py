from flask import Blueprint
from controllers.cash_close_controller import get_closes, create_close, review_close

cash_closes_bp = Blueprint('cash_closes', __name__)

cash_closes_bp.route('/', methods=['GET'])(get_closes)
cash_closes_bp.route('/', methods=['POST'])(create_close)
cash_closes_bp.route('/<int:id>/review', methods=['PATCH'])(review_close)