from flask import Blueprint
from controllers.system_config_controller import get_config, save_config

system_config_bp = Blueprint('system_config', __name__)
system_config_bp.route('/', methods=['GET'])(get_config)
system_config_bp.route('/', methods=['PUT'])(save_config)