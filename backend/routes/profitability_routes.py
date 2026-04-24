from flask import Blueprint
from controllers.profitability_controller import (
    get_expenses, create_expense,
    get_branch_profit, get_comparison
)

profitability_bp = Blueprint('profitability', __name__)

profitability_bp.route('/expenses',                     methods=['GET'])(get_expenses)
profitability_bp.route('/expenses',                     methods=['POST'])(create_expense)
profitability_bp.route('/branches/<int:branch_id>',     methods=['GET'])(get_branch_profit)
profitability_bp.route('/comparison',                   methods=['GET'])(get_comparison)