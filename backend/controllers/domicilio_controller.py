from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from extensions import db
from datetime import datetime
import random, string

# ── Modelos inline ────────────────────────────────────────────────────────
class Domiciliario(db.Model):
    __tablename__ = 'domiciliarios'
    id        = db.Column(db.Integer, primary_key=True)
    user_id   = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    nombre    = db.Column(db.String(100), nullable=False)
    telefono  = db.Column(db.String(20),  nullable=False)
    documento = db.Column(db.String(20),  nullable=True)
    vehiculo  = db.Column(db.String(50),  nullable=True)
    placa     = db.Column(db.String(15),  nullable=True)
    activo    = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id':        self.id,
            'nombre':    self.nombre,
            'telefono':  self.telefono,
            'documento': self.documento,
            'vehiculo':  self.vehiculo,
            'placa':     self.placa,
            'activo':    self.activo,
        }


class Domicilio(db.Model):
    __tablename__ = 'domicilios'
    id                 = db.Column(db.Integer, primary_key=True)
    numero_pedido      = db.Column(db.String(20), unique=True, nullable=False)
    cliente_nombre     = db.Column(db.String(100), nullable=False)
    cliente_telefono   = db.Column(db.String(20),  nullable=False)
    cliente_direccion  = db.Column(db.Text, nullable=False)
    cliente_referencia = db.Column(db.Text, nullable=True)
    domiciliario_id    = db.Column(db.Integer, db.ForeignKey('domiciliarios.id', ondelete='SET NULL'), nullable=True)
    cashier_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    sale_id            = db.Column(db.Integer, db.ForeignKey('sales.id',  ondelete='SET NULL'), nullable=True)
    estado             = db.Column(db.String(20), default='pendiente')
    metodo_pago        = db.Column(db.String(30), default='efectivo')
    total              = db.Column(db.Numeric(12,2), default=0)
    valor_domicilio    = db.Column(db.Numeric(10,2), default=0)
    notas              = db.Column(db.Text, nullable=True)
    lat                = db.Column(db.Numeric(10,7), nullable=True)
    lng                = db.Column(db.Numeric(10,7), nullable=True)
    domiciliario_nombre  = db.Column(db.String(100), nullable=True)
    domiciliario_celular = db.Column(db.String(20),  nullable=True)
    domiciliario_moto    = db.Column(db.String(50),  nullable=True)
    domiciliario_placa   = db.Column(db.String(15),  nullable=True)
    codigo_confirmacion  = db.Column(db.String(10),  nullable=True)
    assigned_at          = db.Column(db.DateTime, nullable=True)
    picked_up_at       = db.Column(db.DateTime, nullable=True)
    delivered_at       = db.Column(db.DateTime, nullable=True)
    created_at         = db.Column(db.DateTime, default=datetime.now)
    updated_at         = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    domiciliario = db.relationship('Domiciliario', foreign_keys=[domiciliario_id])
    items        = db.relationship('DomicilioItem', backref='domicilio', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':                 self.id,
            'numero_pedido':      self.numero_pedido,
            'cliente_nombre':     self.cliente_nombre,
            'cliente_telefono':   self.cliente_telefono,
            'cliente_direccion':  self.cliente_direccion,
            'cliente_referencia': self.cliente_referencia,
            'domiciliario':       self.domiciliario.to_dict() if self.domiciliario else None,
            'estado':             self.estado,
            'metodo_pago':        self.metodo_pago,
            'total':              float(self.total or 0),
            'valor_domicilio':    float(self.valor_domicilio or 0),
            'notas':              self.notas,
            'lat':                float(self.lat) if self.lat else None,
            'lng':                float(self.lng) if self.lng else None,
            'items':              [i.to_dict() for i in self.items],
            'created_at':         self.created_at.isoformat() if self.created_at else None,
            'assigned_at':        self.assigned_at.isoformat() if self.assigned_at else None,
            'delivered_at':       self.delivered_at.isoformat() if self.delivered_at else None,
            'cashier_id':         self.cashier_id,
            'cajero':             {'id': self.cashier_id, 'nombre': self._get_cajero_nombre()} if self.cashier_id else None,
            'domiciliario_nombre':  self.domiciliario_nombre,
            'domiciliario_celular': self.domiciliario_celular,
            'domiciliario_moto':    self.domiciliario_moto,
            'domiciliario_placa':   self.domiciliario_placa,
            'codigo_confirmacion':  self.codigo_confirmacion,
        }

    def _get_cajero_nombre(self):
        try:
            from models.user import User
            u = User.query.get(self.cashier_id)
            return u.name if u else 'Sin asignar'
        except:
            return 'Sin asignar'


class DomicilioItem(db.Model):
    __tablename__ = 'domicilio_items'
    id           = db.Column(db.Integer, primary_key=True)
    domicilio_id = db.Column(db.Integer, db.ForeignKey('domicilios.id', ondelete='CASCADE'), nullable=False)
    product_id   = db.Column(db.Integer, db.ForeignKey('products.id'),  nullable=False)
    product_name = db.Column(db.String(150), nullable=False)
    quantity     = db.Column(db.Numeric(10,3), nullable=False)
    price        = db.Column(db.Numeric(10,2),  nullable=False)
    subtotal     = db.Column(db.Numeric(12,2),  nullable=False)

    def to_dict(self):
        return {
            'product_id':   self.product_id,
            'product_name': self.product_name,
            'quantity':     float(self.quantity),
            'price':        float(self.price),
            'subtotal':     float(self.subtotal),
        }


def _gen_numero():
    suffix = ''.join(random.choices(string.digits, k=4))
    return f'DOM-{datetime.now().strftime("%Y%m%d")}-{suffix}'

def _is_admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico', 'supervisor')


# ── DOMICILIARIOS ─────────────────────────────────────────────────────────
@jwt_required()
def get_domiciliarios():
    doms = Domiciliario.query.filter_by(activo=True).order_by(Domiciliario.nombre).all()
    return jsonify([d.to_dict() for d in doms]), 200

@jwt_required()
def create_domiciliario():
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403
    data = request.get_json() or {}
    if not data.get('nombre') or not data.get('telefono'):
        return jsonify({'message': 'Nombre y teléfono son obligatorios'}), 400
    d = Domiciliario(
        nombre=data['nombre'], telefono=data['telefono'],
        documento=data.get('documento'), vehiculo=data.get('vehiculo'),
        placa=data.get('placa'),
    )
    db.session.add(d); db.session.commit()
    return jsonify(d.to_dict()), 201

@jwt_required()
def update_domiciliario(id):
    claims = get_jwt()
    if not _is_admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403
    d = Domiciliario.query.get_or_404(id)
    data = request.get_json() or {}
    for field in ['nombre','telefono','documento','vehiculo','placa','activo']:
        if field in data:
            setattr(d, field, data[field])
    db.session.commit()
    return jsonify(d.to_dict()), 200


# ── DOMICILIOS ────────────────────────────────────────────────────────────
@jwt_required()
def get_domicilios():
    claims  = get_jwt()
    user_id = int(get_jwt_identity())
    query   = Domicilio.query

    if not _is_admin(claims):
        query = query.filter_by(cashier_id=user_id)

    estado = request.args.get('estado')
    if estado:
        query = query.filter_by(estado=estado)

    cajero_id = request.args.get('cajero_id')
    if cajero_id:
        query = query.filter_by(cashier_id=int(cajero_id))

    domicilios = query.order_by(Domicilio.created_at.desc()).limit(100).all()
    return jsonify([d.to_dict() for d in domicilios]), 200

@jwt_required()
def create_domicilio():
    user_id = int(get_jwt_identity())
    data    = request.get_json() or {}

    if not data.get('cliente_nombre') or not data.get('cliente_telefono') or not data.get('cliente_direccion'):
        return jsonify({'message': 'Nombre, teléfono y dirección son obligatorios'}), 400
    if not data.get('items'):
        return jsonify({'message': 'El pedido debe tener al menos un producto'}), 400

    from models.product import Product

    # Calcular total
    total = 0
    items_data = []
    for item in data['items']:
        product = Product.query.get(item.get('product_id'))
        if not product:
            return jsonify({'message': f'Producto {item.get("product_id")} no encontrado'}), 404
        qty      = float(item.get('quantity', 1))
        price    = float(item.get('price', product.final_price))
        subtotal = qty * price
        total   += subtotal
        items_data.append({ 'product': product, 'qty': qty, 'price': price, 'subtotal': subtotal })

    domicilio = Domicilio(
        numero_pedido      = _gen_numero(),
        cliente_nombre     = data['cliente_nombre'],
        cliente_telefono   = data['cliente_telefono'],
        cliente_direccion  = data['cliente_direccion'],
        cliente_referencia = data.get('cliente_referencia'),
        cashier_id         = user_id,
        metodo_pago        = data.get('metodo_pago', 'efectivo'),
        total              = total,
        valor_domicilio    = float(data.get('valor_domicilio', 0)),
        notas              = data.get('notas'),
        lat                = data.get('lat'),
        lng                = data.get('lng'),
    )
    db.session.add(domicilio)
    db.session.flush()

    for item in items_data:
        db.session.add(DomicilioItem(
            domicilio_id = domicilio.id,
            product_id   = item['product'].id,
            product_name = item['product'].name,
            quantity     = item['qty'],
            price        = item['price'],
            subtotal     = item['subtotal'],
        ))

    db.session.commit()

    # ══════════════════════════════════════════════════════════════
    # INTEGRACIÓN RAPPI / PEDIDOSYA (cuando el cliente lo tenga)
    # Descomentar y agregar las credenciales del cliente:
    #
    # try:
    #     import requests
    #     # RAPPI:
    #     # requests.post('https://microservices.rappi.com/api/3/orders',
    #     #     headers={'Authorization': 'Bearer TU_TOKEN_RAPPI_AQUI'},
    #     #     json={ 'order_id': domicilio.numero_pedido, 'items': [...] })
    #
    #     # PEDIDOSYA:
    #     # requests.post('https://api.pedidosya.com/v3/orders',
    #     #     headers={'Authorization': 'Bearer TU_TOKEN_PEDIDOSYA_AQUI'},
    #     #     json={ 'reference': domicilio.numero_pedido })
    # except Exception as e:
    #     print(f'[Rappi/PedidosYa] Error: {e}')
    # ══════════════════════════════════════════════════════════════

    # Enviar WhatsApp al domiciliario si está configurado
    try:
        if data.get('domiciliario_id'):
            dom = Domiciliario.query.get(data['domiciliario_id'])
            if dom and dom.telefono:
                from services.whatsapp_service import enviar_ticket_whatsapp
                # Notificación simple al domiciliario
    except Exception:
        pass

    return jsonify(domicilio.to_dict()), 201

@jwt_required()
def update_estado_domicilio(id):
    claims  = get_jwt()
    user_id = int(get_jwt_identity())
    dom     = Domicilio.query.get_or_404(id)
    data    = request.get_json() or {}
    estado  = data.get('estado')

    ESTADOS_VALIDOS = ['pendiente','asignado','en_camino','entregado','cancelado']
    if estado not in ESTADOS_VALIDOS:
        return jsonify({'message': 'Estado inválido'}), 400

    dom.estado = estado
    if estado in ('asignado', 'en_camino'):
        dom.assigned_at = datetime.now()
        if data.get('domiciliario_id'):
            dom.domiciliario_id = data['domiciliario_id']
        if data.get('domiciliario_nombre'):
            dom.domiciliario_nombre  = data.get('domiciliario_nombre', '')
            dom.domiciliario_celular = data.get('domiciliario_celular', '')
            dom.domiciliario_moto    = data.get('domiciliario_moto', '')
            dom.domiciliario_placa   = data.get('domiciliario_placa', '')
            dom.codigo_confirmacion  = data.get('codigo_confirmacion', '')
    elif estado == 'en_camino':
        dom.picked_up_at = datetime.now()
    elif estado == 'entregado':
        dom.delivered_at = datetime.now()

    db.session.commit()

    # ══════════════════════════════════════════════════════════════
    # NOTIFICACIÓN WhatsApp al cliente cuando está "en_camino"
    # Requiere WhatsApp API configurada (WHATSAPP_TOKEN en .env)
    # ══════════════════════════════════════════════════════════════
    if estado == 'en_camino':
        try:
            from services.whatsapp_service import _limpiar_telefono
            import os, requests as req
            token    = os.environ.get('WHATSAPP_TOKEN', '')
            phone_id = os.environ.get('WHATSAPP_PHONE_ID', '')
            if token and phone_id and dom.cliente_telefono:
                tel = _limpiar_telefono(dom.cliente_telefono)
                msg = (f'🛵 *SmartMerca — Tu pedido está en camino*\n'
                       f'Pedido: {dom.numero_pedido}\n'
                       f'Domiciliario: {dom.domiciliario.nombre if dom.domiciliario else "En camino"}\n'
                       f'¡Prepárate para recibirlo! 📦')
                req.post(f'https://graph.facebook.com/v19.0/{phone_id}/messages',
                    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                    json={'messaging_product':'whatsapp','to':tel,'type':'text','text':{'body':msg}},
                    timeout=5)
        except Exception as e:
            print(f'[WhatsApp domicilio] {e}')

    return jsonify(dom.to_dict()), 200

@jwt_required()
def get_domicilio(id):
    dom = Domicilio.query.get_or_404(id)
    return jsonify(dom.to_dict()), 200

@jwt_required()
def get_stats_domicilios():
    from sqlalchemy import func
    hoy    = datetime.now().date()
    total  = Domicilio.query.filter(db.func.date(Domicilio.created_at) == hoy).count()
    entregados = Domicilio.query.filter(
        db.func.date(Domicilio.created_at) == hoy,
        Domicilio.estado == 'entregado'
    ).count()
    pendientes = Domicilio.query.filter(
        Domicilio.estado.in_(['pendiente', 'asignado', 'en_camino'])
    ).count()
    ingresos = db.session.query(func.sum(Domicilio.total)).filter(
        db.func.date(Domicilio.created_at) == hoy,
        Domicilio.estado == 'entregado'
    ).scalar() or 0

    return jsonify({
        'hoy_total':      total,
        'hoy_entregados': entregados,
        'pendientes':     pendientes,
        'ingresos_hoy':   float(ingresos),
    }), 200

# ── Índice para asignación circular ─────────────────────────────────────────
_cajero_idx = 0

@jwt_required(optional=True)
def crear_desde_catalogo():
    """Crea un pedido desde el catálogo público y lo asigna a un cajero en turno (circular)."""
    global _cajero_idx
    data = request.get_json() or {}

    # Obtener cajeros con turno abierto
    from models.shift import Shift
    from models.user  import User
    turnos_activos = Shift.query.filter_by(status='abierto').all()
    cajeros_ids = [t.cashier_id for t in turnos_activos]

    # Si no hay cajeros en turno, usar el primer admin disponible
    if not cajeros_ids:
        admin = User.query.filter(User.role.in_(['admin','cajero']), User.is_active==True).first()
        cajeros_ids = [admin.id] if admin else []

    # Asignación circular
    cajero_asignado_id = None
    if cajeros_ids:
        _cajero_idx = _cajero_idx % len(cajeros_ids)
        cajero_asignado_id = cajeros_ids[_cajero_idx]
        _cajero_idx += 1

    import random, string
    suffix = ''.join(random.choices(string.digits, k=4))
    numero = f'CAT-{datetime.now().strftime("%Y%m%d")}-{suffix}'

    total = sum(float(i.get('subtotal',0)) for i in data.get('items',[]))

    dom = Domicilio(
        numero_pedido      = numero,
        cliente_nombre     = data.get('cliente_nombre','Cliente'),
        cliente_telefono   = data.get('cliente_telefono',''),
        cliente_direccion  = data.get('cliente_direccion',''),
        metodo_pago        = data.get('metodo_pago','por_definir'),
        total              = total,
        valor_domicilio    = float(data.get('valor_domicilio',0)),
        notas              = data.get('notas',''),
        cashier_id         = cajero_asignado_id,
        estado             = 'asignado' if cajero_asignado_id else 'pendiente',
    )
    db.session.add(dom)
    db.session.flush()

    for item in data.get('items',[]):
        db.session.add(DomicilioItem(
            domicilio_id = dom.id,
            product_id   = item.get('product_id'),
            product_name = item.get('product_name',''),
            quantity     = float(item.get('quantity',1)),
            price        = float(item.get('price',0)),
            subtotal     = float(item.get('subtotal',0)),
        ))
    db.session.commit()

    # Notificar al cajero asignado vía notificación interna
    try:
        from models.notificacion import Notificacion
        cajero = User.query.get(cajero_asignado_id) if cajero_asignado_id else None
        n = Notificacion(
            tipo    = 'pedido_catalogo',
            titulo  = f'🛵 Nuevo pedido del catálogo: {numero}',
            mensaje = f'Cliente: {dom.cliente_nombre} | Total: ${total:,.0f} | Cajero: {cajero.name if cajero else "Sin asignar"}',
        )
        db.session.add(n)
        db.session.commit()
    except Exception: pass

    cajero_info = None
    if cajero_asignado_id:
        cajero_obj = User.query.get(cajero_asignado_id)
        if cajero_obj:
            cajero_info = {'id': cajero_obj.id, 'nombre': cajero_obj.name}

    return jsonify({
        'message':        'Pedido creado',
        'numero_pedido':  numero,
        'cajero_asignado': cajero_info,
        'total':          total,
    }), 201@jwt_required()
def confirmar_entrega_codigo(id):
    """Confirma entrega del domicilio con código de 4 dígitos del cliente."""
    dom  = Domicilio.query.get_or_404(id)
    data = request.get_json() or {}
    codigo_ingresado = str(data.get('codigo', '')).strip()

    if not dom.codigo_confirmacion:
        return jsonify({'message': 'Este pedido no tiene código de confirmación'}), 400

    if codigo_ingresado != str(dom.codigo_confirmacion).strip():
        return jsonify({'message': 'Código incorrecto. Verifique con el cliente.'}), 400

    dom.estado       = 'entregado'
    dom.delivered_at = datetime.now()
    db.session.commit()

    return jsonify({
        'message':  '✅ Entrega confirmada exitosamente',
        'domicilio': dom.to_dict(),
    }), 200