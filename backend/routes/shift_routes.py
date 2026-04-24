from flask import Blueprint
from controllers.shift_controller import (
    get_active_shift, get_all_shifts, open_shift,
    request_count, submit_cashier_count, close_shift,
    add_withdrawal, get_shift,
    cashier_request_close, approve_close, reject_close
)

shifts_bp = Blueprint('shifts', __name__)
shifts_bp.route('/active',                          methods=['GET'])(get_active_shift)
shifts_bp.route('/',                                methods=['GET'])(get_all_shifts)
shifts_bp.route('/open',                            methods=['POST'])(open_shift)
shifts_bp.route('/<int:shift_id>/request-count',    methods=['POST'])(request_count)
shifts_bp.route('/<int:shift_id>/cashier-count',    methods=['POST'])(submit_cashier_count)
shifts_bp.route('/close',                           methods=['POST'])(close_shift)
shifts_bp.route('/withdrawal',                      methods=['POST'])(add_withdrawal)
shifts_bp.route('/<int:id>',                        methods=['GET'])(get_shift)
shifts_bp.route('/<int:shift_id>/request-close',    methods=['POST'])(cashier_request_close)
shifts_bp.route('/<int:shift_id>/approve-close',    methods=['POST'])(approve_close)
shifts_bp.route('/<int:shift_id>/reject-close',     methods=['POST'])(reject_close)