from flask import Blueprint
from controllers.import_controller import preview_import, execute_import

import_bp = Blueprint('import', __name__)
import_bp.route('/preview', methods=['POST'])(preview_import)
import_bp.route('/execute', methods=['POST'])(execute_import)