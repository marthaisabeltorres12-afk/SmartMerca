from extensions import db
from datetime import datetime

class CashAdjustment(db.Model):
    __tablename__ = 'cash_adjustments'

    id                    = db.Column(db.Integer, primary_key=True)
    tipo                  = db.Column(db.Enum('ingreso', 'egreso'), nullable=False)
    monto                 = db.Column(db.Numeric(10, 2), nullable=False)
    motivo                = db.Column(db.Text, nullable=False)
    registrado_por        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    relacionado_a_cierre_id = db.Column(db.Integer, db.ForeignKey('cash_closes.id'), nullable=True)
    relacionado_a_turno_id  = db.Column(db.Integer, db.ForeignKey('shifts.id'), nullable=True)
    created_at            = db.Column(db.DateTime, default=datetime.now)

    usuario   = db.relationship('User', foreign_keys=[registrado_por])
    cierre    = db.relationship('CashClose', foreign_keys=[relacionado_a_cierre_id])

    def to_dict(self):
        return {
            'id':                       self.id,
            'tipo':                     self.tipo,
            'monto':                    float(self.monto),
            'motivo':                   self.motivo,
            'registrado_por':           self.registrado_por,
            'registrado_por_nombre':    self.usuario.name if self.usuario else None,
            'relacionado_a_cierre_id':  self.relacionado_a_cierre_id,
            'relacionado_a_turno_id':   self.relacionado_a_turno_id,
            'created_at':               str(self.created_at),
        }