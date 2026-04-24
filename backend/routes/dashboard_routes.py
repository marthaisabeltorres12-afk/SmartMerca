from flask import Blueprint
from controllers.dashboard_controller import get_dashboard_today

dashboard_bp = Blueprint('dashboard', __name__)
dashboard_bp.route('/today', methods=['GET'])(get_dashboard_today)