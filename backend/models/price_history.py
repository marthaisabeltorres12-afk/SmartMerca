from extensions import db
from datetime import datetime

class PriceHistory(db.Model):
    __tablename__ = 'price_history'

    id               = db.Column(db.Integer, primary_key=True)
    product_id       = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    tipo             = db.Column(db.Enum('precio_venta','costo'), nullable=False, default='precio_venta')
    precio_anterior  = db.Column(db.Numeric(10, 2), nullable=False)
    precio_nuevo     = db.Column(db.Numeric(10, 2), nullable=False)
    variacion_pct    = db.Column(db.Numeric(6, 2), nullable=True)
    cambiado_por     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at       = db.Column(db.DateTime, default=datetime.now)

    product  = db.relationship('Product', backref='price_history')
    usuario  = db.relationship('User', foreign_keys=[cambiado_por])

    def to_dict(self):
        return {
            'id':              self.id,
            'product_id':      self.product_id,
            'product_name':    self.product.name if self.product else None,
            'tipo':            self.tipo,
            'precio_anterior': float(self.precio_anterior),
            'precio_nuevo':    float(self.precio_nuevo),
            'variacion_pct':   float(self.variacion_pct) if self.variacion_pct else None,
            'cambiado_por':    self.cambiado_por,
            'cambiado_por_nombre': self.usuario.name if self.usuario else None,
            'created_at':      str(self.created_at),
        }