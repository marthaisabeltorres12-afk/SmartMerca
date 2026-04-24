"""
Sistema de permisos por rol para SmartMerca.
"""

ROLE_PERMISSIONS = {
    'admin_tecnico': ['*'],
    'admin': [
        'ventas.*', 'inventario.*', 'clientes.*', 'reportes.*',
        'usuarios.cajero', 'usuarios.bodeguero', 'usuarios.supervisor',
        'turnos.*', 'devoluciones.*', 'proveedores.*', 'promociones.*',
        'nomina.ver', 'finanzas.ver', 'auditoria.ver', 'ordenes.*',
        'merma.*', 'conteo.*', 'bodegas.*', 'sucursales.ver',
    ],
    'cajero': [
        'ventas.crear', 'clientes.ver', 'clientes.crear',
        'devoluciones.crear', 'turnos.ver_propio', 'productos.ver',
    ],
    'bodeguero': [
        'inventario.entradas', 'inventario.traslados', 'inventario.conteo',
        'inventario.ver', 'proveedores.ver', 'productos.ver', 'bodegas.*',
        'ordenes.ver', 'ordenes.recibir',
    ],
    'supervisor': [
        'ventas.ver', 'reportes.ver', 'inventario.ver', 'productos.ver',
        'clientes.ver', 'devoluciones.ver', 'descuentos.aprobar',
        'turnos.ver',
    ],
    'contador': [
        'reportes.*', 'finanzas.*', 'nomina.*', 'auditoria.ver',
        'proveedores.ver', 'inventario.ver', 'productos.ver',
    ],
    'auditor': [
        'auditoria.ver', 'reportes.ver', 'ventas.ver', 'inventario.ver',
    ],
}


def has_permission(role: str, permission: str) -> bool:
    """
    Verifica si un rol tiene un permiso.
    Soporta wildcard '*' y 'modulo.*'.
    """
    perms = ROLE_PERMISSIONS.get(role, [])

    # Admin técnico tiene todo
    if '*' in perms:
        return True

    # Permiso exacto
    if permission in perms:
        return True

    # Wildcard de módulo: 'ventas.*' cubre 'ventas.crear'
    module = permission.split('.')[0]
    if f'{module}.*' in perms:
        return True

    return False


def require_roles(*roles):
    """
    Decorador para verificar que el usuario tiene uno de los roles indicados.
    Uso: @require_roles('admin', 'admin_tecnico', 'contador')
    """
    from functools import wraps
    from flask import jsonify
    from flask_jwt_extended import jwt_required, get_jwt

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            if claims.get('role') not in roles:
                return jsonify({'message': 'Acceso denegado — no tienes permisos para esta acción'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# Roles que pueden hacer cada acción
ADMIN_ROLES        = ('admin', 'admin_tecnico')
FINANCE_ROLES      = ('admin', 'admin_tecnico', 'contador')
INVENTORY_ROLES    = ('admin', 'admin_tecnico', 'bodeguero')
READ_ONLY_ROLES    = ('admin', 'admin_tecnico', 'supervisor', 'contador', 'auditor')
CASHIER_ROLES      = ('admin', 'admin_tecnico', 'cajero')
ALL_STAFF_ROLES    = ('admin_tecnico', 'admin', 'cajero', 'bodeguero', 'supervisor', 'contador', 'auditor')