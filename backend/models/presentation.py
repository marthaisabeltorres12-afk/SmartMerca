from extensions import db

class ProductPresentation(db.Model):
    """
    Presentaciones de venta de un producto base.
    Ejemplo: Producto base = Huevo (unidad)
      - Presentación "Media cubeta" = 15 huevos → precio $X
      - Presentación "Cubeta x30"   = 30 huevos → precio $Y
    Al vender 1 cubeta, se descuenta 30 del stock de Huevo.
    """
    __tablename__ = 'product_presentations'

    id              = db.Column(db.Integer, primary_key=True)
    base_product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    name            = db.Column(db.String(150), nullable=False)
    units_per_pack  = db.Column(db.Integer, nullable=False, default=1)
    price           = db.Column(db.Numeric(10,2), nullable=False)
    barcode         = db.Column(db.String(50), unique=True, nullable=True)
    is_active       = db.Column(db.Boolean, default=True)
    created_at      = db.Column(db.DateTime, server_default=db.func.now())

    base_product = db.relationship('Product', backref='presentations')

    def to_dict(self):
        return {
            'id':              self.id,
            'base_product_id': self.base_product_id,
            'product_id':      self.base_product_id,  # alias para el frontend
            'base_product':    self.base_product.name if self.base_product else None,
            'base_stock':      self.base_product.stock if self.base_product else 0,
            'name':            self.name,
            'units_per_pack':  self.units_per_pack,
            'price':           float(self.price),
            'barcode':         self.barcode,
            'is_active':       self.is_active,
            # Stock disponible en "packs" = stock_base // units_per_pack
            'stock_packs':     (self.base_product.stock // self.units_per_pack) if self.base_product else 0,
            'created_at':      str(self.created_at),
        }