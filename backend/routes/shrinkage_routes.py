from flask import Blueprint
from controllers.shrinkage_controller import get_shrinkage, create_shrinkage, get_shrinkage_report

shrinkage_bp = Blueprint('shrinkage', __name__)

shrinkage_bp.route('/',         methods=['GET'])(get_shrinkage)
shrinkage_bp.route('/',         methods=['POST'])(create_shrinkage)
shrinkage_bp.route('/report',   methods=['GET'])(get_shrinkage_report)