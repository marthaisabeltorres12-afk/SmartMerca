from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from models.supplier_invoice import SupplierInvoice, SupplierPayment
from models.supplier import Supplier
from extensions import db
from datetime import date, datetime
from utils.audit import log_action

def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

# ── Listar facturas ──────────────────────────────────────────────────────────
@jwt_required()
def get_invoices():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    supplier_id = request.args.get('supplier_id', type=int)
    status      = request.args.get('status')

    q = SupplierInvoice.query

    # Actualizar facturas vencidas automáticamente
    hoy = date.today()
    vencidas = SupplierInvoice.query.filter(
        SupplierInvoice.fecha_vencimiento < str(hoy),
        SupplierInvoice.status.in_(['pendiente', 'parcial'])
    ).all()
    for f in vencidas:
        f.status = 'vencido'
    if vencidas:
        db.session.commit()

    if supplier_id: q = q.filter_by(supplier_id=supplier_id)
    if status:      q = q.filter_by(status=status)

    facturas = q.order_by(SupplierInvoice.fecha_vencimiento.asc()).all()
    return jsonify([f.to_dict() for f in facturas]), 200


# ── Crear factura ────────────────────────────────────────────────────────────
@jwt_required()
def create_invoice():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()

    supplier_id = data.get('supplier_id')
    if not supplier_id or not Supplier.query.get(supplier_id):
        return jsonify({'message': 'Proveedor no encontrado'}), 404

    if not data.get('numero_factura_proveedor'):
        return jsonify({'message': 'El número de factura es obligatorio'}), 400
    if not data.get('valor_total') or float(data['valor_total']) <= 0:
        return jsonify({'message': 'El valor total debe ser mayor a 0'}), 400
    if not data.get('fecha_factura') or not data.get('fecha_vencimiento'):
        return jsonify({'message': 'Las fechas son obligatorias'}), 400

    factura = SupplierInvoice(
        supplier_id              = supplier_id,
        numero_factura_proveedor = data['numero_factura_proveedor'],
        valor_total              = float(data['valor_total']),
        valor_pagado             = 0,
        fecha_factura            = data['fecha_factura'],
        fecha_vencimiento        = data['fecha_vencimiento'],
        status                   = 'pendiente',
        notas                    = data.get('notas') or None,
    )
    db.session.add(factura)
    db.session.commit()

    s = Supplier.query.get(supplier_id)
    log_action('crear', f'Factura proveedor #{factura.numero_factura_proveedor} — {s.company_name or s.name} — ${float(data["valor_total"]):,.0f}')

    return jsonify(factura.to_dict()), 201


# ── Registrar pago ───────────────────────────────────────────────────────────
@jwt_required()
def register_payment(invoice_id):
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    factura = SupplierInvoice.query.get_or_404(invoice_id)
    data    = request.get_json()
    user_id = int(get_jwt_identity())

    monto = float(data.get('monto', 0))
    if monto <= 0:
        return jsonify({'message': 'El monto debe ser mayor a 0'}), 400

    saldo = float(factura.valor_total) - float(factura.valor_pagado)
    if monto > saldo + 0.01:
        return jsonify({'message': f'El monto supera el saldo pendiente de ${saldo:,.0f}'}), 400

    if not data.get('metodo_pago'):
        return jsonify({'message': 'El método de pago es obligatorio'}), 400

    pago = SupplierPayment(
        supplier_invoice_id = factura.id,
        monto               = monto,
        fecha_pago          = data.get('fecha_pago') or str(date.today()),
        metodo_pago         = data['metodo_pago'],
        referencia_bancaria = data.get('referencia_bancaria') or None,
        registrado_por      = user_id,
    )
    db.session.add(pago)

    factura.valor_pagado = float(factura.valor_pagado) + monto
    nuevo_saldo = float(factura.valor_total) - float(factura.valor_pagado)
    if nuevo_saldo <= 0.01:
        factura.status = 'pagado'
    else:
        factura.status = 'parcial'

    db.session.commit()

    log_action('crear', f'Pago factura #{factura.numero_factura_proveedor} — ${monto:,.0f} ({data["metodo_pago"]})')

    return jsonify(factura.to_dict()), 200


# ── Resumen cartera por proveedor ────────────────────────────────────────────
@jwt_required()
def get_cartera():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    suppliers = Supplier.query.all()
    resultado = []
    for s in suppliers:
        facturas = SupplierInvoice.query.filter(
            SupplierInvoice.supplier_id == s.id,
            SupplierInvoice.status.in_(['pendiente', 'parcial', 'vencido'])
        ).all()
        if not facturas:
            continue
        total_deuda = sum(float(f.valor_total) - float(f.valor_pagado) for f in facturas)
        resultado.append({
            'supplier_id':   s.id,
            'supplier_name': s.company_name or s.name,
            'total_deuda':   round(total_deuda, 2),
            'facturas':      len(facturas),
            'vencidas':      sum(1 for f in facturas if f.status == 'vencido'),
        })

    resultado.sort(key=lambda x: x['total_deuda'], reverse=True)
    return jsonify(resultado), 200