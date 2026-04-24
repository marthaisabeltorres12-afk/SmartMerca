from extensions import db
from datetime import datetime

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id              = db.Column(db.Integer, primary_key=True)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    usuario_nombre  = db.Column(db.String(150))
    rol             = db.Column(db.String(50))
    accion          = db.Column(db.String(50))
    descripcion     = db.Column(db.Text)
    fecha_hora      = db.Column(db.DateTime, default=datetime.now)

    usuario = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id':             self.id,
            'user_id':        self.user_id,
            'usuario_nombre': self.usuario_nombre,
            'rol':            self.rol,
            'accion':         self.accion,
            'descripcion':    self.descripcion,
            'fecha_hora':     str(self.fecha_hora),
        }