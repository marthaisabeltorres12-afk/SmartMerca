from extensions import db

class Product(db.Model):
    __tablename__ = 'products'

    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text)
    price       = db.Column(db.Numeric(10, 2), nullable=False)
    stock       = db.Column(db.Integer, default=0)
    category    = db.Column(db.String(100))
    barcode     = db.Column(db.String(50), unique=True)
    expiry_date = db.Column(db.Date, nullable=True)
    discount       = db.Column(db.Numeric(5,2), default=0)
    discount_start = db.Column(db.Date, nullable=True)
    discount_end   = db.Column(db.Date, nullable=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)
    min_stock        = db.Column(db.Integer, default=5)
    gramaje_cantidad = db.Column(db.Numeric(10,3), nullable=True)
    gramaje_unidad   = db.Column(db.String(20),  nullable=True)
    iva_type         = db.Column(db.Integer, default=19)
    is_active   = db.Column(db.Boolean, default=True)
    updated_at  = db.Column(db.DateTime, onupdate=db.func.now())
    created_at  = db.Column(db.DateTime, server_default=db.func.now())

    supplier = db.relationship('Supplier', backref='products')

    @property
    def active_discount(self):
        from datetime import date
        today = date.today()

        if not self.discount or float(self.discount) == 0:
            return 0

        if self.discount_start and today < self.discount_start:
            return 0

        if self.discount_end and today > self.discount_end:
            return 0

        return float(self.discount)




    @property
    def final_price(self):
        from datetime import date
        from models.promotion import Promotion

        today = date.today()

        promo = Promotion.query.filter(
            Promotion.product_id == self.id,
            Promotion.is_active == True
        ).first()

        if promo:
            if promo.date_from and today < promo.date_from:
                return round(float(self.price))

            if promo.date_to and today > promo.date_to:
                return round(float(self.price))

            if promo.type == 'descuento_pct':
                return round(float(self.price) * (1 - float(promo.discount_value) / 100))

            if promo.type == 'descuento_fijo':
                return max(0, round(float(self.price) - float(promo.discount_value)))

            # lleva_gratis no cambia el precio unitario
            return round(float(self.price))

        # SIN PROMOCIÓN
        return round(float(self.price))
    
    def _display_name(self):
        if self.gramaje_cantidad and self.gramaje_unidad:
            q = float(self.gramaje_cantidad)
            qty = int(q) if q == int(q) else q
            return f'{self.name} · {qty} {self.gramaje_unidad}'
        return self.name
        
    
    def to_dict(self):
        return {
            'id':          self.id,
            'name':        self.name,
            'description': self.description,
            'price':          float(self.price),
            'final_price':    self.final_price,
            'discount':       float(self.discount) if self.discount else 0,
            'active_discount':self.active_discount,
            'discount_start': str(self.discount_start) if self.discount_start else None,
            'discount_end':   str(self.discount_end) if self.discount_end else None,
            'stock':       self.stock,
            'category':    self.category,
            'barcode':     self.barcode,
            'expiry_date': str(self.expiry_date) if self.expiry_date else None,
            'supplier_id': self.supplier_id,
            'supplier':    (self.supplier.company_name or self.supplier.name) if self.supplier else None,
            'min_stock':        self.min_stock if self.min_stock is not None else 5,
            'gramaje_cantidad': float(self.gramaje_cantidad) if self.gramaje_cantidad else None,
            'gramaje_unidad':   self.gramaje_unidad or None,
            'iva_type':         self.iva_type if self.iva_type is not None else 19,
            'display_name':     self._display_name(),
            'is_active':        self.is_active
        }