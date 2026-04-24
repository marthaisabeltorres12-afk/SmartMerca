from extensions import db
from datetime import datetime

class PriceList(db.Model):
    __tablename__ = 'price_lists'

    id             = db.Column(db.Integer, primary_key=True)
    nombre         = db.Column(db.String(100), nullable=False)
    descripcion    = db.Column(db.Text, nullable=True)
    tipo           = db.Column(db.Enum('porcentaje', 'precio_manual'), nullable=False, default='porcentaje')
    descuento_pct  = db.Column(db.Numeric(5, 2), nullable=True)  # solo si tipo=porcentaje
    is_active      = db.Column(db.Boolean, default=True)
    created_at     = db.Column(db.DateTime, default=datetime.now)

    items    = db.relationship('PriceListItem', backref='price_list', cascade='all, delete-orphan')
    customers = db.relationship('Customer', backref='price_list', foreign_keys='Customer.price_list_id')

    def to_dict(self):
        return {
            'id':            self.id,
            'nombre':        self.nombre,
            'descripcion':   self.descripcion,
            'tipo':          self.tipo,
            'descuento_pct': float(self.descuento_pct) if self.descuento_pct else None,
            'is_active':     self.is_active,
            'created_at':    str(self.created_at),
        }


class PriceListItem(db.Model):
    __tablename__ = 'price_list_items'

    id             = db.Column(db.Integer, primary_key=True)
    price_list_id  = db.Column(db.Integer, db.ForeignKey('price_lists.id'), nullable=False)
    product_id     = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    precio_especial = db.Column(db.Numeric(10, 2), nullable=False)

    product = db.relationship('Product')

    __table_args__ = (db.UniqueConstraint('price_list_id', 'product_id'),)

    def to_dict(self):
        return {
            'id':              self.id,
            'price_list_id':   self.price_list_id,
            'product_id':      self.product_id,
            'product_name':    self.product.name if self.product else None,
            'precio_especial': float(self.precio_especial),
        }