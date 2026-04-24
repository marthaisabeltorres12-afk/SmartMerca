from extensions import db
from datetime import datetime, date

class LoyaltyCoupon(db.Model):
    __tablename__ = 'loyalty_coupons'

    id              = db.Column(db.Integer, primary_key=True)
    customer_id     = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)  # null = para todos
    codigo          = db.Column(db.String(20), unique=True, nullable=False)
    tipo            = db.Column(db.Enum('descuento_pct','descuento_fijo','puntos_extra'), nullable=False)
    valor           = db.Column(db.Numeric(10, 2), nullable=False)
    fecha_inicio    = db.Column(db.Date, nullable=False)
    fecha_fin       = db.Column(db.Date, nullable=False)
    min_purchase    = db.Column(db.Numeric(10, 2), default=0)
    usado           = db.Column(db.Boolean, default=False)
    sale_id         = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=True)
    created_by      = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at      = db.Column(db.DateTime, default=datetime.now)

    customer    = db.relationship('Customer', foreign_keys=[customer_id])
    creator     = db.relationship('User', foreign_keys=[created_by])

    @property
    def is_vigente(self):
        hoy = date.today()
        return not self.usado and self.fecha_inicio <= hoy <= self.fecha_fin

    def to_dict(self):
        return {
            'id':           self.id,
            'customer_id':  self.customer_id,
            'customer_name': self.customer.full_name if self.customer else 'Todos los clientes',
            'codigo':       self.codigo,
            'tipo':         self.tipo,
            'valor':        float(self.valor),
            'fecha_inicio': str(self.fecha_inicio),
            'fecha_fin':    str(self.fecha_fin),
            'min_purchase': float(self.min_purchase),
            'usado':        self.usado,
            'is_vigente':   self.is_vigente,
            'sale_id':      self.sale_id,
            'created_by':   self.created_by,
            'created_at':   str(self.created_at),
        }