from extensions import db
from datetime import datetime

class ShrinkageRecord(db.Model):
    __tablename__ = 'shrinkage_records'

    id               = db.Column(db.Integer, primary_key=True)
    product_id       = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    cantidad         = db.Column(db.Numeric(10, 3), nullable=False)
    costo_unitario   = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    costo_total      = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    causa            = db.Column(db.Enum('vencimiento','daño_fisico','robo','error_conteo','deterioro'), nullable=False)
    observaciones    = db.Column(db.Text, nullable=True)
    registrado_por   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at       = db.Column(db.DateTime, default=datetime.now)

    product      = db.relationship('Product')
    registrador  = db.relationship('User', foreign_keys=[registrado_por])

    def to_dict(self):
        return {
            'id':             self.id,
            'product_id':     self.product_id,
            'product_name':   self.product.name if self.product else None,
            'cantidad':       float(self.cantidad),
            'costo_unitario': float(self.costo_unitario),
            'costo_total':    float(self.costo_total),
            'causa':          self.causa,
            'observaciones':  self.observaciones,
            'registrado_por': self.registrado_por,
            'registrado_por_nombre': self.registrador.name if self.registrador else None,
            'created_at':     str(self.created_at),
        }