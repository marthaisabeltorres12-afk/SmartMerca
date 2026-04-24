from extensions import db
from datetime import datetime

class SalePayment(db.Model):
    __tablename__ = 'sale_payments'

    id         = db.Column(db.Integer, primary_key=True)
    sale_id    = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    metodo     = db.Column(db.String(50), nullable=False)   # efectivo | tarjeta | nequi | transferencia | credito
    monto      = db.Column(db.Numeric(10, 2), nullable=False)
    cambio     = db.Column(db.Numeric(10, 2), default=0)
    referencia = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)

    sale = db.relationship('Sale', backref='payments')

    def to_dict(self):
        return {
            'id':         self.id,
            'sale_id':    self.sale_id,
            'metodo':     self.metodo,
            'monto':      float(self.monto),
            'cambio':     float(self.cambio),
            'referencia': self.referencia,
            'created_at': str(self.created_at),
        }