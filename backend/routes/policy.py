from flask import Blueprint
from controllers.policy_controller import get_policy, update_policy

policy_bp = Blueprint('policy', __name__)

policy_bp.route('/', methods=['GET'])(get_policy)
policy_bp.route('/', methods=['PUT'])(update_policy)