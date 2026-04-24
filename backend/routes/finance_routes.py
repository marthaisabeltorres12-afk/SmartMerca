from flask import Blueprint
from controllers.finance_controller import get_finance

finance_bp = Blueprint('finance', __name__)
finance_bp.route('/', methods=['GET'])(get_finance)