from extensions import db
from datetime import datetime

class Notificacion(db.Model):
    __tablename__ = 'notificaciones'

    id           = db.Column(db.Integer, primary_key=True)
    tipo         = db.Column(db.Enum(
        'producto_faltante','producto_danado','stock_bajo','vencimiento',
        'cierre_turno','conteo_diferencia','otro'
    ), nullable=False, default='otro')
    titulo       = db.Column(db.String(200), nullable=False)
    mensaje      = db.Column(db.Text, nullable=True)
    resuelta     = db.Column(db.Boolean, default=False)
    creado_por   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    resuelto_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at   = db.Column(db.DateTime, default=datetime.now)
    resuelto_at  = db.Column(db.DateTime, nullable=True)

    creador   = db.relationship('User', foreign_keys=[creado_por])
    resolvedor= db.relationship('User', foreign_keys=[resuelto_por])

    def to_dict(self):
        return {
            'id':           self.id,
            'tipo':         self.tipo,
            'titulo':       self.titulo,
            'mensaje':      self.mensaje,
            'resuelta':     self.resuelta,
            'creado_por':   self.creado_por,
            'creado_por_nombre': self.creador.name if self.creador else None,
            'resuelto_por': self.resuelto_por,
            'created_at':   str(self.created_at),
            'resuelto_at':  str(self.resuelto_at) if self.resuelto_at else None,
        }