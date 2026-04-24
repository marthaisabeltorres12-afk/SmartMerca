from flask import Blueprint
from controllers.notificacion_controller import (
    get_notificaciones, crear_notificacion, resolver_notificacion,
    resolver_todas, generar_alertas_automaticas
)

notificaciones_bp = Blueprint('notificaciones', __name__)
notificaciones_bp.route('/',                    methods=['GET'])(get_notificaciones)
notificaciones_bp.route('/',                    methods=['POST'])(crear_notificacion)
notificaciones_bp.route('/<int:id>/resolver',   methods=['POST'])(resolver_notificacion)
notificaciones_bp.route('/resolver-todas',      methods=['POST'])(resolver_todas)
notificaciones_bp.route('/generar-alertas',     methods=['POST'])(generar_alertas_automaticas)