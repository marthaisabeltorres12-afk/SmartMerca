from flask import Blueprint
from controllers.user_controller import (
    get_users, get_user, create_user, update_user, delete_user,
    approve_user, reject_user
)

users_bp = Blueprint('users', __name__)

users_bp.route('/', methods=['GET'])(get_users)
users_bp.route('/<int:id>', methods=['GET'])(get_user)
users_bp.route('/', methods=['POST'])(create_user)
users_bp.route('/<int:id>', methods=['PUT'])(update_user)
users_bp.route('/<int:id>', methods=['DELETE'])(delete_user)
users_bp.route('/<int:id>/approve', methods=['PATCH'])(approve_user)
users_bp.route('/<int:id>/reject',  methods=['DELETE'])(reject_user)