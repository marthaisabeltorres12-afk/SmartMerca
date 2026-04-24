from flask import Blueprint
from controllers.backup_controller import download_backup

backup_bp = Blueprint('backup', __name__)
backup_bp.route('/download', methods=['GET'])(download_backup)