import io
from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from models.product import Product
from models.inventory import InventoryMovement
from extensions import db

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')

@jwt_required()
def preview_import():
    """Lee el Excel y devuelve preview de lo que se va a importar sin guardar nada."""
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    if 'file' not in request.files:
        return jsonify({'message': 'No se envió archivo'}), 400

    file = request.files['file']
    if not file.filename.endswith(('.xlsx', '.xls')):
        return jsonify({'message': 'Solo se aceptan archivos .xlsx o .xls'}), 400

    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file.read()), data_only=True)
        ws = wb.active

        rows = []
        for row in ws.iter_rows(min_row=3, values_only=True):
            # Skip empty and separator rows
            if not row[0] or str(row[0]).startswith('←'):
                continue
            nombre = str(row[0]).strip() if row[0] else ''
            if not nombre:
                continue

            precio_llegada = float(row[5]) if row[5] else None
            precio_venta   = float(row[7]) if row[7] else None
            if not nombre or not precio_venta:
                rows.append({'nombre': nombre or '(sin nombre)', 'error': 'Faltan campos obligatorios', 'status': 'error'})
                continue

            # Check duplicates
            existing_by_name    = Product.query.filter_by(name=nombre).first()
            barcode = str(row[2]).strip() if row[2] else None
            existing_by_barcode = Product.query.filter_by(barcode=barcode).first() if barcode else None
            existing = existing_by_barcode or existing_by_name

            cantidad = float(row[12]) if len(row) > 12 and row[12] else None

            rows.append({
                'nombre':         nombre,
                'categoria':      str(row[1]).strip() if row[1] else None,
                'barcode':        barcode,
                'gramaje_cantidad': float(row[3]) if row[3] else None,
                'gramaje_unidad': str(row[4]).strip() if row[4] else None,
                'precio_llegada': precio_llegada,
                'ganancia_pct':   float(row[6]) if row[6] else None,
                'precio_venta':   precio_venta,
                'iva_type':       int(row[8]) if row[8] is not None else 19,
                'min_stock':      int(row[9]) if row[9] else 5,
                'expiry_date':    str(row[10]).strip() if row[10] else None,
                'proveedor':      str(row[11]).strip() if row[11] else None,
                'cantidad':       cantidad,
                'existing_id':    existing.id if existing else None,
                'existing_name':  existing.name if existing else None,
                'status':         'update' if existing else 'new',
                'aviso':          'Se actualizará el costo pero no se registrará movimiento de inventario (sin cantidad)' if precio_llegada and not cantidad else None,
            })

        return jsonify(rows), 200

    except Exception as e:
        return jsonify({'message': f'Error leyendo el archivo: {str(e)}'}), 400


@jwt_required()
def execute_import():
    """Ejecuta la importación con las instrucciones del cliente (new/update/skip por fila)."""
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Acceso denegado'}), 403

    items = request.get_json()
    if not items:
        return jsonify({'message': 'No hay datos para importar'}), 400

    from models.supplier import Supplier

    created = 0
    updated = 0
    skipped = 0
    errors  = []

    for item in items:
        action = item.get('action')  # 'new' | 'update' | 'skip'
        if action == 'skip':
            skipped += 1
            continue

        try:
            nombre       = item.get('nombre', '').strip()
            precio_venta = float(item.get('precio_venta') or 0)
            if not nombre or not precio_venta:
                errors.append(f'"{nombre}": faltan campos obligatorios')
                continue

            # Buscar proveedor por nombre si viene
            supplier_id = None
            if item.get('proveedor'):
                sup = Supplier.query.filter(
                    db.func.lower(Supplier.company_name) == item['proveedor'].lower()
                ).first()
                supplier_id = sup.id if sup else None

            exp_date = item.get('expiry_date') or None
            if exp_date == 'None': exp_date = None

            if action == 'update' and item.get('existing_id'):
                p = Product.query.get(item['existing_id'])
                if p:
                    p.name     = nombre
                    p.price    = precio_venta
                    if item.get('categoria'):   p.category         = item['categoria']
                    if item.get('barcode'):     p.barcode          = item['barcode']
                    if item.get('gramaje_cantidad'): p.gramaje_cantidad = float(item['gramaje_cantidad'])
                    if item.get('gramaje_unidad'):   p.gramaje_unidad   = item['gramaje_unidad']
                    if item.get('iva_type') is not None: p.iva_type    = int(item['iva_type'])
                    if item.get('min_stock'):   p.min_stock        = int(item['min_stock'])
                    if exp_date:                p.expiry_date      = exp_date
                    if supplier_id:             p.supplier_id      = supplier_id
                    # Registrar entrada solo si tiene precio de llegada Y cantidad > 0
                    cantidad_import = float(item.get('cantidad') or 0)
                    if item.get('precio_llegada') and cantidad_import > 0:
                        mv = InventoryMovement(
                            product_id = p.id,
                            type       = 'entrada',
                            quantity   = cantidad_import,
                            unit_cost  = float(item['precio_llegada']),
                            reason     = 'Importación Excel',
                        )
                        db.session.add(mv)
                        p.stock += cantidad_import
                    updated += 1

            elif action == 'new':
                if Product.query.filter_by(name=nombre).first():
                    errors.append(f'"{nombre}": ya existe, omitido')
                    continue
                p = Product(
                    name             = nombre,
                    category         = item.get('categoria') or None,
                    barcode          = item.get('barcode') or None,
                    price            = precio_venta,
                    stock            = 0,
                    gramaje_cantidad = float(item['gramaje_cantidad']) if item.get('gramaje_cantidad') else None,
                    gramaje_unidad   = item.get('gramaje_unidad') or None,
                    iva_type         = int(item.get('iva_type') or 19),
                    min_stock        = int(item.get('min_stock') or 5),
                    expiry_date      = exp_date,
                    supplier_id      = supplier_id,
                    is_active        = True,
                )
                db.session.add(p)
                db.session.flush()
                cantidad_import = float(item.get('cantidad') or 0)
                if item.get('precio_llegada') and cantidad_import > 0:
                    mv = InventoryMovement(
                        product_id = p.id,
                        type       = 'entrada',
                        quantity   = cantidad_import,
                        unit_cost  = float(item['precio_llegada']),
                        reason     = 'Importación Excel',
                    )
                    db.session.add(mv)
                    p.stock += cantidad_import
                created += 1

        except Exception as e:
            errors.append(f'"{item.get("nombre","?")}": {str(e)}')

    db.session.commit()
    return jsonify({
        'message': f'Importación completa: {created} creados, {updated} actualizados, {skipped} omitidos',
        'created': created, 'updated': updated, 'skipped': skipped, 'errors': errors,
    }), 200