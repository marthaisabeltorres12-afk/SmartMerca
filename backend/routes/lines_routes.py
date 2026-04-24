from flask import Blueprint
from controllers.lines_controller import (
    get_lines, create_line, update_line, delete_line, line_dashboard
)

lines_bp = Blueprint('lines', __name__)
lines_bp.route('/',              methods=['GET'])(get_lines)
lines_bp.route('/',              methods=['POST'])(create_line)
lines_bp.route('/<int:id>',      methods=['PUT'])(update_line)
lines_bp.route('/<int:id>',      methods=['DELETE'])(delete_line)
lines_bp.route('/<int:id>/dashboard', methods=['GET'])(line_dashboard)