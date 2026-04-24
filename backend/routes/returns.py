from flask import Blueprint
from controllers.return_controller import get_returns, get_sale_for_return, create_return

returns_bp = Blueprint('returns', __name__)

returns_bp.route('/',                    methods=['GET'])(get_returns)
returns_bp.route('/sale/<int:sale_id>',  methods=['GET'])(get_sale_for_return)
returns_bp.route('/',                    methods=['POST'])(create_return)