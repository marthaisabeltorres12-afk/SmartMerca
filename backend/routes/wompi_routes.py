from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from services.wompi_service import crear_link_pago, verificar_pago, validar_webhook
from extensions import db
from datetime import datetime, timedelta
import os, uuid

wompi_bp = Blueprint('wompi', __name__)

# ── Modelos de planes ─────────────────────────────────────────────────────
class Plan(db.Model):
    __tablename__ = 'planes'
    id          = db.Column(db.Integer, primary_key=True)
    nombre      = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    precio_cop  = db.Column(db.Integer, nullable=False)
    activo      = db.Column(db.Boolean, default=True)
    features    = db.Column(db.Text, nullable=True)  # JSON string

    def to_dict(self):
        import json
        return {
            'id':          self.id,
            'nombre':      self.nombre,
            'descripcion': self.descripcion,
            'precio_cop':  self.precio_cop,
            'features':    json.loads(self.features or '[]'),
        }


class Suscripcion(db.Model):
    __tablename__ = 'suscripciones'
    id            = db.Column(db.Integer, primary_key=True)
    plan_id       = db.Column(db.Integer, db.ForeignKey('planes.id'), nullable=False)
    empresa_nombre = db.Column(db.String(150), nullable=False)
    email         = db.Column(db.String(150), nullable=False)
    telefono      = db.Column(db.String(20),  nullable=True)
    referencia    = db.Column(db.String(100), unique=True, nullable=False)
    estado        = db.Column(db.String(20),  default='pendiente')  # pendiente, activa, vencida, cancelada
    wompi_tx_id   = db.Column(db.String(100), nullable=True)
    fecha_inicio  = db.Column(db.DateTime, nullable=True)
    fecha_vence   = db.Column(db.DateTime, nullable=True)
    created_at    = db.Column(db.DateTime, default=datetime.now)

    plan = db.relationship('Plan', foreign_keys=[plan_id])

    def to_dict(self):
        return {
            'id':             self.id,
            'plan':           self.plan.to_dict() if self.plan else None,
            'empresa_nombre': self.empresa_nombre,
            'email':          self.email,
            'estado':         self.estado,
            'referencia':     self.referencia,
            'fecha_inicio':   self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            'fecha_vence':    self.fecha_vence.isoformat()  if self.fecha_vence  else None,
        }


def _admin(claims):
    return claims.get('role') in ('admin', 'admin_tecnico')


# ── PLANES ────────────────────────────────────────────────────────────────
@wompi_bp.route('/planes', methods=['GET'])
def get_planes():
    """Planes disponibles — público para la landing page."""
    planes = Plan.query.filter_by(activo=True).all()
    return jsonify([p.to_dict() for p in planes]), 200


@wompi_bp.route('/planes', methods=['POST'])
@jwt_required()
def create_plan():
    """Crear plan — solo admin."""
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403
    import json
    data = request.get_json() or {}
    plan = Plan(
        nombre      = data['nombre'],
        descripcion = data.get('descripcion', ''),
        precio_cop  = int(data['precio_cop']),
        features    = json.dumps(data.get('features', [])),
    )
    db.session.add(plan); db.session.commit()
    return jsonify(plan.to_dict()), 201


# ── INICIAR PAGO ──────────────────────────────────────────────────────────
@wompi_bp.route('/suscribir', methods=['POST'])
def iniciar_suscripcion():
    """
    Inicia el proceso de pago de un plan.
    Body: { plan_id, empresa_nombre, email, telefono? }
    Retorna: { link_pago, referencia }
    """
    data = request.get_json() or {}

    plan = Plan.query.get(data.get('plan_id'))
    if not plan:
        return jsonify({'message': 'Plan no encontrado'}), 404

    if not data.get('email') or not data.get('empresa_nombre'):
        return jsonify({'message': 'Email y nombre de empresa son obligatorios'}), 400

    # Generar referencia única
    referencia = f'SM-{plan.id}-{uuid.uuid4().hex[:8].upper()}'

    # Crear suscripción pendiente
    sus = Suscripcion(
        plan_id        = plan.id,
        empresa_nombre = data['empresa_nombre'],
        email          = data['email'],
        telefono       = data.get('telefono'),
        referencia     = referencia,
        estado         = 'pendiente',
    )
    db.session.add(sus); db.session.commit()

    # Crear link de pago en Wompi
    resultado = crear_link_pago(
        plan_nombre   = plan.nombre,
        monto_cop     = plan.precio_cop,
        referencia    = referencia,
        email_cliente = data['email'],
    )

    if resultado['ok']:
        return jsonify({
            'link_pago':  resultado['link_pago'],
            'referencia': referencia,
            'plan':       plan.to_dict(),
        }), 200

    # ══════════════════════════════════════════════════════════════
    # Si Wompi no está configurado aún, retornar link de prueba
    # Cuando SmartMerca tenga las llaves reales, esto funciona solo
    # ══════════════════════════════════════════════════════════════
    return jsonify({
        'link_pago':  None,
        'referencia': referencia,
        'message':    resultado['message'],
        'manual':     True,  # Para coordinar el pago manualmente
    }), 200


# ── WEBHOOK WOMPI ────────────────────────────────────────────────────────
@wompi_bp.route('/webhook', methods=['POST'])
def webhook_wompi():
    """
    Wompi llama a este endpoint cuando hay un pago.
    Configura en Wompi Dashboard → Eventos → URL del webhook:
    https://tu-backend.railway.app/api/wompi/webhook
    """
    signature = request.headers.get('x-event-checksum', '')
    timestamp  = request.headers.get('x-event-timestamp', '')
    body       = request.get_data()

    # Validar firma
    if not validar_webhook(signature, timestamp, body):
        return jsonify({'message': 'Firma inválida'}), 401

    evento = request.get_json() or {}
    if evento.get('event') == 'transaction.updated':
        tx         = evento.get('data', {}).get('transaction', {})
        referencia = tx.get('reference', '')
        estado_tx  = tx.get('status', '')

        sus = Suscripcion.query.filter_by(referencia=referencia).first()
        if sus and estado_tx == 'APPROVED':
            sus.estado       = 'activa'
            sus.wompi_tx_id  = tx.get('id')
            sus.fecha_inicio = datetime.now()
            sus.fecha_vence  = datetime.now() + timedelta(days=30)
            db.session.commit()

            # Enviar email de bienvenida (si está configurado)
            try:
                from flask_mail import Message
                from extensions import mail
                msg = Message(
                    subject    = '🎉 ¡Bienvenido a SmartMerca POS!',
                    recipients = [sus.email],
                    body       = f'Hola {sus.empresa_nombre},\n\n'
                                 f'Tu suscripción al plan {sus.plan.nombre} ha sido activada.\n'
                                 f'Tu acceso vence el {sus.fecha_vence.strftime("%d/%m/%Y")}.\n\n'
                                 f'¡Gracias por elegir SmartMerca!'
                )
                mail.send(msg)
            except Exception:
                pass

    return jsonify({'ok': True}), 200


# ── VERIFICAR PAGO ────────────────────────────────────────────────────────
@wompi_bp.route('/verificar/<referencia>', methods=['GET'])
def verificar(referencia):
    """Verificar estado de un pago."""
    sus = Suscripcion.query.filter_by(referencia=referencia).first()
    if not sus:
        return jsonify({'message': 'Referencia no encontrada'}), 404
    resultado = verificar_pago(referencia)
    return jsonify({ **resultado, 'suscripcion': sus.to_dict() }), 200


# ── SUSCRIPCIONES (admin) ─────────────────────────────────────────────────
@wompi_bp.route('/suscripciones', methods=['GET'])
@jwt_required()
def get_suscripciones():
    claims = get_jwt()
    if not _admin(claims):
        return jsonify({'message': 'Sin permiso'}), 403
    sus = Suscripcion.query.order_by(Suscripcion.created_at.desc()).all()
    return jsonify([s.to_dict() for s in sus]), 200

# ── CATÁLOGO PÚBLICO ──────────────────────────────────────────────────────
from controllers.wompi_catalogo_controller import pago_catalogo, get_pedidos_catalogo

wompi_bp.route('/pago-catalogo',    methods=['POST'])(pago_catalogo)
wompi_bp.route('/pedidos-catalogo', methods=['GET'])(get_pedidos_catalogo)