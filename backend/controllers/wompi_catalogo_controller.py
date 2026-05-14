"""
Endpoint de pago Wompi para clientes del catálogo público.
Agrega estas rutas al wompi_routes.py existente.
"""
from flask import request, jsonify
from services.wompi_service import crear_link_pago
from extensions import db
from datetime import datetime
import uuid


class PedidoCatalogo(db.Model):
    """Pedidos recibidos desde el catálogo público."""
    __tablename__ = 'pedidos_catalogo'
    id          = db.Column(db.Integer, primary_key=True)
    referencia  = db.Column(db.String(100), unique=True, nullable=False)
    nombre      = db.Column(db.String(150), nullable=False)
    email       = db.Column(db.String(150), nullable=False)
    telefono    = db.Column(db.String(20),  nullable=True)
    direccion   = db.Column(db.Text,        nullable=True)
    tipo_envio  = db.Column(db.String(20),  default='tienda')
    items       = db.Column(db.Text,        nullable=False)  # JSON
    total       = db.Column(db.Numeric(12,2), default=0)
    estado      = db.Column(db.String(20),  default='pendiente')  # pendiente, pagado, cancelado
    wompi_tx_id = db.Column(db.String(100), nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        import json
        return {
            'id':         self.id,
            'referencia': self.referencia,
            'nombre':     self.nombre,
            'email':      self.email,
            'telefono':   self.telefono,
            'direccion':  self.direccion,
            'tipo_envio': self.tipo_envio,
            'items':      json.loads(self.items or '[]'),
            'total':      float(self.total or 0),
            'estado':     self.estado,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── AGREGAR en wompi_routes.py ─────────────────────────────────────────────
# from controllers.wompi_catalogo_controller import pago_catalogo, get_pedidos_catalogo, webhook_pago_catalogo
# wompi_bp.route('/pago-catalogo',    methods=['POST'])(pago_catalogo)
# wompi_bp.route('/pedidos-catalogo', methods=['GET'])(get_pedidos_catalogo)


def pago_catalogo():
    """
    POST /api/wompi/pago-catalogo
    Recibe pedido del catálogo y crea link de pago Wompi.
    Endpoint público — sin autenticación.
    """
    import json
    data = request.get_json() or {}

    if not data.get('nombre') or not data.get('email'):
        return jsonify({'message': 'Nombre y email son obligatorios'}), 400
    if not data.get('items'):
        return jsonify({'message': 'El pedido está vacío'}), 400

    total      = float(data.get('total', 0))
    referencia = f'PED-{uuid.uuid4().hex[:8].upper()}'

    # Guardar pedido
    pedido = PedidoCatalogo(
        referencia = referencia,
        nombre     = data['nombre'],
        email      = data['email'],
        telefono   = data.get('telefono', ''),
        direccion  = data.get('direccion', ''),
        tipo_envio = data.get('tipo_envio', 'tienda'),
        items      = json.dumps(data['items']),
        total      = total,
        estado     = 'pendiente',
    )
    db.session.add(pedido)
    db.session.commit()

    # Notificar al negocio por WhatsApp
    try:
        from services.whatsapp_service import enviar_alerta_stock
        from models.user import User
        admin = User.query.filter(
            User.role.in_(['admin', 'admin_tecnico']),
            User.is_active == True,
        ).first()
        if admin and admin.phone:
            import os, requests as req
            token    = os.environ.get('WHATSAPP_TOKEN', '')
            phone_id = os.environ.get('WHATSAPP_PHONE_ID', '')
            if token and phone_id:
                from services.whatsapp_service import _limpiar_telefono
                tel = _limpiar_telefono(admin.phone)
                items_txt = '\n'.join([f"• {i['nombre']} x{i['cantidad']} = ${i['subtotal']:,.0f}" for i in data['items']])
                msg = (f'🛒 *Nuevo pedido del catálogo*\n'
                       f'Ref: {referencia}\n'
                       f'Cliente: {data["nombre"]}\n'
                       f'📱 {data.get("telefono","")}\n'
                       f'📍 {data.get("direccion","Recoger en tienda")}\n\n'
                       f'{items_txt}\n\n'
                       f'*Total: ${total:,.0f}*')
                req.post(f'https://graph.facebook.com/v19.0/{phone_id}/messages',
                    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                    json={'messaging_product':'whatsapp','to':tel,'type':'text','text':{'body':msg}},
                    timeout=5)
    except Exception as e:
        print(f'[WhatsApp pedido catalogo] {e}')

    # Crear link de pago Wompi
    # ══════════════════════════════════════════════════════════════
    # WOMPI: cuando el cliente tenga las llaves, esto funciona solo
    # Variables necesarias en el servidor del cliente:
    #   WOMPI_PUBLIC_KEY  = pub_prod_xxxxxxxx  (del cliente)
    #   WOMPI_PRIVATE_KEY = prv_prod_xxxxxxxx  (del cliente)
    #   WOMPI_ENABLED     = true
    # ══════════════════════════════════════════════════════════════
    resultado = crear_link_pago(
        plan_nombre   = f'Pedido {referencia}',
        monto_cop     = int(total),
        referencia    = referencia,
        email_cliente = data['email'],
    )

    if resultado.get('ok') and resultado.get('link_pago'):
        return jsonify({
            'link_pago':  resultado['link_pago'],
            'referencia': referencia,
        }), 200

    # Sin Wompi configurado — modo manual
    return jsonify({
        'manual':     True,
        'referencia': referencia,
        'message':    'Pedido registrado. Te contactaremos para coordinar el pago.',
    }), 200


def get_pedidos_catalogo():
    """GET /api/wompi/pedidos-catalogo — Ver pedidos del catálogo (admin)."""
    from flask_jwt_extended import jwt_required, get_jwt
    pedidos = PedidoCatalogo.query.order_by(PedidoCatalogo.created_at.desc()).limit(100).all()
    return jsonify([p.to_dict() for p in pedidos]), 200