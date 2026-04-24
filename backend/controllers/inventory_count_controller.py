from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.inventory_count import InventoryCount, InventoryCountItem
from models.product import Product
from models.inventory import InventoryMovement
from extensions import db
from utils.audit import log_action

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── Listar conteos ────────────────────────────────────────────────────────────
@jwt_required()
def get_counts():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403
    counts = InventoryCount.query.order_by(InventoryCount.created_at.desc()).all()
    return jsonify([c.to_dict() for c in counts]), 200


# ── Iniciar conteo ────────────────────────────────────────────────────────────
@jwt_required()
def create_count():
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    user_id = int(get_jwt_identity())
    data    = request.get_json()

    nombre  = data.get('nombre', '').strip()
    seccion = data.get('seccion') or None

    if not nombre:
        return jsonify({'message': 'El nombre del conteo es obligatorio'}), 400

    count = InventoryCount(
        nombre       = nombre,
        seccion      = seccion,
        status       = 'en_progreso',
        iniciado_por = user_id,
    )
    db.session.add(count)
    db.session.flush()

    # Snapshot del stock actual
    q = Product.query.filter_by(is_active=True)
    if seccion:
        q = q.filter_by(category=seccion)

    for product in q.all():
        db.session.add(InventoryCountItem(
            inventory_count_id = count.id,
            product_id         = product.id,
            stock_sistema      = product.stock,
            cantidad_contada   = None,
            diferencia         = None,
            status_ajuste      = 'pendiente',
        ))

    db.session.commit()
    log_action('crear', f'Conteo físico "{nombre}" iniciado — {q.count()} productos')
    return jsonify(count.to_dict()), 201


# ── Obtener items de un conteo ────────────────────────────────────────────────
@jwt_required()
def get_count_items(count_id):
    InventoryCount.query.get_or_404(count_id)
    items = InventoryCountItem.query.filter_by(inventory_count_id=count_id).all()
    return jsonify([i.to_dict() for i in items]), 200


# ── Registrar conteo (bodeguero ingresa cantidades) ───────────────────────────
@jwt_required()
def register_count(count_id):
    count = InventoryCount.query.get_or_404(count_id)
    if count.status == 'ajustes_aprobados':
        return jsonify({'message': 'Este conteo ya fue aprobado'}), 400

    data  = request.get_json()
    items = data.get('items', [])  # [{item_id, cantidad_contada}]

    for entry in items:
        item = InventoryCountItem.query.filter_by(
            id=entry['item_id'], inventory_count_id=count_id
        ).first()
        if not item:
            continue
        cant = float(entry['cantidad_contada'])
        item.cantidad_contada = cant
        item.diferencia       = cant - float(item.stock_sistema)

    count.status = 'conteo_terminado'
    db.session.commit()
    return jsonify(count.to_dict()), 200


# ── Aprobar ajustes ───────────────────────────────────────────────────────────
@jwt_required()
def approve_adjustments(count_id):
    claims  = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    user_id = int(get_jwt_identity())
    count   = InventoryCount.query.get_or_404(count_id)

    if count.status != 'conteo_terminado':
        return jsonify({'message': 'El conteo debe estar terminado para aprobar ajustes'}), 400

    data         = request.get_json()
    aprobaciones = data.get('items', [])  # [{item_id, status_ajuste, justificacion}]

    ajustados = 0
    for ap in aprobaciones:
        item = InventoryCountItem.query.filter_by(
            id=ap['item_id'], inventory_count_id=count_id
        ).first()
        if not item or item.cantidad_contada is None:
            continue

        item.status_ajuste = ap.get('status_ajuste', 'aprobado')
        item.justificacion = ap.get('justificacion') or None

        if item.status_ajuste == 'aprobado' and float(item.diferencia or 0) != 0:
            product = Product.query.get(item.product_id)
            if product:
                diferencia = float(item.diferencia)
                product.stock = float(item.cantidad_contada)

                tipo   = 'entrada' if diferencia > 0 else 'salida'
                db.session.add(InventoryMovement(
                    product_id = product.id,
                    type       = tipo,
                    quantity   = abs(diferencia),
                    reason     = f'Ajuste toma inventario #{count_id} — {count.nombre}',
                ))
                ajustados += 1

    count.status      = 'ajustes_aprobados'
    count.aprobado_por = user_id
    db.session.commit()

    log_action('editar', f'Conteo #{count_id} "{count.nombre}" — {ajustados} ajustes aprobados')
    return jsonify(count.to_dict()), 200