from extensions import db
from datetime import date

class Promotion(db.Model):
    __tablename__ = 'promotions'

    id              = db.Column(db.Integer, primary_key=True)
    name            = db.Column(db.String(200), nullable=False)
    type            = db.Column(db.Enum('descuento_pct', 'descuento_fijo', 'lleva_gratis'), nullable=False)
    is_active       = db.Column(db.Boolean, default=True)

    # Producto al que aplica la promo
    product_id      = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)

    # Descuento porcentaje o fijo
    discount_value  = db.Column(db.Numeric(10, 2), default=0)

    # "Compra X lleva Y gratis"
    buy_quantity    = db.Column(db.Integer, default=1)   # cantidad que debe comprar
    free_quantity   = db.Column(db.Integer, default=0)   # cantidad que lleva gratis
    free_product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=True)

    # Vigencia
    date_from       = db.Column(db.Date, nullable=True)
    date_to         = db.Column(db.Date, nullable=True)

    created_at      = db.Column(db.DateTime, server_default=db.func.now())

    product      = db.relationship('Product', foreign_keys=[product_id],      backref='promotions')
    free_product = db.relationship('Product', foreign_keys=[free_product_id])

    @property
    def is_valid_today(self):
        if not self.is_active:
            return False
        today = date.today()
        if self.date_from and today < self.date_from:
            return False
        if self.date_to and today > self.date_to:
            return False
        return True

    def to_dict(self):
        return {
            'id':              self.id,
            'name':            self.name,
            'type':            self.type,
            'is_active':       self.is_active,
            'is_valid_today':  self.is_valid_today,
            'product_id':      self.product_id,
            'product_name':    self.product.name if self.product else None,
            'discount_value':  float(self.discount_value) if self.discount_value else 0,
            'buy_quantity':    self.buy_quantity,
            'free_quantity':   self.free_quantity,
            'free_product_id': self.free_product_id,
            'free_product_name': self.free_product.name if self.free_product else None,
            'date_from':       str(self.date_from) if self.date_from else None,
            'date_to':         str(self.date_to)   if self.date_to   else None,
            'created_at':      str(self.created_at),
        }