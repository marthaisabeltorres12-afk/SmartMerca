from flask import Blueprint
from controllers.branch_controller import (
    get_branches, create_branch, update_branch,
    get_branch_stats, get_ranking, get_my_stats
)

branches_bp = Blueprint('branches', __name__)

branches_bp.route('/',                      methods=['GET'])(get_branches)
branches_bp.route('/',                      methods=['POST'])(create_branch)
branches_bp.route('/<int:id>',              methods=['PUT'])(update_branch)
branches_bp.route('/<int:branch_id>/stats', methods=['GET'])(get_branch_stats)
branches_bp.route('/ranking',               methods=['GET'])(get_ranking)
branches_bp.route('/my-stats',              methods=['GET'])(get_my_stats)