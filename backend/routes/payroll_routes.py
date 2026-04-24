from flask import Blueprint
from controllers.payroll_controller import (
    get_employees, create_employee, update_employee,
    get_periods, create_period, calculate_period,
    get_records, get_my_records, mark_paid,
    get_novedades, create_novedad, delete_novedad,
    calcular_liquidacion, guardar_liquidacion, get_liquidaciones,
)

payroll_bp = Blueprint('payroll', __name__)

# Empleados
payroll_bp.route('/employees',            methods=['GET'])(get_employees)
payroll_bp.route('/employees',            methods=['POST'])(create_employee)
payroll_bp.route('/employees/<int:id>',   methods=['PUT'])(update_employee)

# Períodos
payroll_bp.route('/periods',              methods=['GET'])(get_periods)
payroll_bp.route('/periods',              methods=['POST'])(create_period)
payroll_bp.route('/periods/<int:period_id>/calculate', methods=['POST'])(calculate_period)
payroll_bp.route('/periods/<int:period_id>/records',   methods=['GET'])(get_records)
payroll_bp.route('/periods/<int:period_id>/novedades', methods=['GET'])(get_novedades)

# Records
payroll_bp.route('/my-records',                    methods=['GET'])(get_my_records)
payroll_bp.route('/records/<int:record_id>/pay',   methods=['POST'])(mark_paid)

# Novedades
payroll_bp.route('/novedades',            methods=['POST'])(create_novedad)
payroll_bp.route('/novedades/<int:id>',   methods=['DELETE'])(delete_novedad)

# Liquidación
payroll_bp.route('/liquidacion/<int:employee_id>/calcular', methods=['POST'])(calcular_liquidacion)
payroll_bp.route('/liquidacion',                            methods=['POST'])(guardar_liquidacion)
payroll_bp.route('/liquidaciones',                          methods=['GET'])(get_liquidaciones)