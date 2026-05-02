from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.cash_register import CashRegister, cash_register_cajeros
from models.shift import Shift
from models.sale import Sale
from models.user import User
from extensions import db
from datetime import datetime, date

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── CRUD Cajas ────────────────────────────────────────────────────────────

@jwt_required()
def get_cajas():
    cajas = CashRegister.query.filter_by(is_active=True).order_by(CashRegister.nombre).all()
    return jsonify([c.to_dict() for c in cajas]), 200


@jwt_required()
def get_caja(caja_id):
    caja = CashRegister.query.get_or_404(caja_id)
    return jsonify(caja.to_dict()), 200


@jwt_required()
def crear_caja():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    data   = request.get_json() or {}
    nombre = data.get('nombre', '').strip()
    if not nombre:
        return jsonify({'message': 'El nombre es requerido'}), 400

    if CashRegister.query.filter_by(nombre=nombre, is_active=True).first():
        return jsonify({'message': f'Ya existe una caja con el nombre "{nombre}"'}), 400

    caja = CashRegister(
        nombre      = nombre,
        descripcion = data.get('descripcion', ''),
        base_amount = float(data.get('base_amount', 0)),
        branch_id   = int(data['branch_id']) if data.get('branch_id') else None,
        is_active   = True,
    )
    db.session.add(caja)
    db.session.flush()  # para obtener caja.id

    # Agregar cajeros autorizados
    cajero_ids = data.get('cajero_ids', [])
    for cid in cajero_ids:
        cajero = User.query.get(int(cid))
        if cajero and cajero.role == 'cajero':
            caja.cajeros.append(cajero)

    db.session.commit()
    return jsonify({'message': 'Caja creada', 'caja': caja.to_dict()}), 201


@jwt_required()
def editar_caja(caja_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    caja = CashRegister.query.get_or_404(caja_id)
    data = request.get_json() or {}

    if 'nombre'      in data: caja.nombre      = data['nombre']
    if 'descripcion' in data: caja.descripcion = data['descripcion']
    if 'base_amount' in data: caja.base_amount = float(data['base_amount'])
    if 'is_active'   in data: caja.is_active   = data['is_active']

    # Actualizar cajeros autorizados
    if 'cajero_ids' in data:
        caja.cajeros.clear()
        for cid in data['cajero_ids']:
            cajero = User.query.get(int(cid))
            if cajero and cajero.role == 'cajero':
                caja.cajeros.append(cajero)

    db.session.commit()
    return jsonify({'message': 'Caja actualizada', 'caja': caja.to_dict()}), 200


@jwt_required()
def agregar_cajero(caja_id):
    """Agrega un cajero autorizado a la caja."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    caja      = CashRegister.query.get_or_404(caja_id)
    cajero_id = (request.get_json() or {}).get('cajero_id')
    cajero    = User.query.get_or_404(int(cajero_id))

    if cajero in caja.cajeros:
        return jsonify({'message': 'El cajero ya está autorizado en esta caja'}), 400

    caja.cajeros.append(cajero)
    db.session.commit()
    return jsonify({'message': f'{cajero.name} agregado a {caja.nombre}', 'caja': caja.to_dict()}), 200


@jwt_required()
def quitar_cajero(caja_id, cajero_id):
    """Quita un cajero autorizado de la caja."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    caja   = CashRegister.query.get_or_404(caja_id)
    cajero = User.query.get_or_404(int(cajero_id))

    # No quitar si tiene turno activo en esa caja
    turno = Shift.query.filter_by(
        cashier_id=cajero_id, cash_register_id=caja_id, status='abierto'
    ).first()
    if turno:
        return jsonify({'message': 'No se puede quitar: el cajero tiene turno activo en esta caja'}), 400

    caja.cajeros.remove(cajero)
    db.session.commit()
    return jsonify({'message': f'{cajero.name} removido de {caja.nombre}', 'caja': caja.to_dict()}), 200


@jwt_required()
def eliminar_caja(caja_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    caja = CashRegister.query.get_or_404(caja_id)
    if caja.shifts.filter_by(status='abierto').first():
        return jsonify({'message': 'No se puede desactivar con turno activo'}), 400

    caja.is_active = False
    db.session.commit()
    return jsonify({'message': 'Caja desactivada'}), 200


# ── Dashboard ─────────────────────────────────────────────────────────────

@jwt_required()
def dashboard_cajas():
    claims = get_jwt()
    if claims.get('role') not in ('admin', 'admin_tecnico', 'supervisor', 'contador'):
        return jsonify({'message': 'Sin permiso'}), 403

    hoy   = date.today()
    cajas = CashRegister.query.filter_by(is_active=True).order_by(CashRegister.nombre).all()

    resultado = []
    total_dia = 0

    for caja in cajas:
        turno = caja.shifts.filter_by(status='abierto').first()

        # Ventas del día
        ventas_hoy = []
        turnos_hoy = Shift.query.filter(
            Shift.cash_register_id == caja.id,
            db.func.date(Shift.opened_at) == hoy
        ).all()
        for t in turnos_hoy:
            ventas_hoy += Sale.query.filter(
                Sale.cashier_id == t.cashier_id,
                Sale.created_at >= t.opened_at,
                Sale.created_at <= (t.closed_at or datetime.now())
            ).all()

        total_caja = sum(float(v.total) for v in ventas_hoy)
        total_dia += total_caja

        resultado.append({
            'caja':          caja.to_dict(),
            'turno_activo':  turno.to_dict() if turno else None,
            'cajero_actual': turno.cashier.name if turno else None,
            'cajeros_auth':  [{'id': c.id, 'name': c.name} for c in caja.cajeros],
            'abierta_desde': str(turno.opened_at) if turno else None,
            'ventas_hoy':    len(ventas_hoy),
            'total_hoy':     total_caja,
            'status':        'ocupada' if turno else ('asignada' if caja.cajeros else 'disponible'),
        })

    return jsonify({
        'cajas':          resultado,
        'total_dia':      total_dia,
        'cajas_abiertas': sum(1 for c in resultado if c['status'] == 'ocupada'),
        'cajas_libres':   sum(1 for c in resultado if c['status'] != 'ocupada'),
    }), 200


@jwt_required()
def historial_caja(caja_id):
    caja   = CashRegister.query.get_or_404(caja_id)
    turnos = caja.shifts.order_by(Shift.opened_at.desc()).limit(30).all()
    return jsonify({'caja': caja.to_dict(), 'turnos': [t.to_dict() for t in turnos]}), 200


@jwt_required()
def cajeros_disponibles():
    """Lista todos los cajeros para asignar a cajas."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403

    cajeros = User.query.filter_by(role='cajero', is_active=True).all()

    # Para cada cajero, en qué cajas está autorizado
    result = []
    for u in cajeros:
        cajas_auth = [{'id': c.id, 'nombre': c.nombre} for c in u.cajas_autorizadas if c.is_active]
        result.append({**u.to_dict(), 'cajas_autorizadas': cajas_auth})

    return jsonify(result), 200