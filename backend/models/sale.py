from extensions import db

class Sale(db.Model):
    __tablename__ = 'sales'

    id             = db.Column(db.Integer, primary_key=True)
    cashier_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    cashier_name   = db.Column(db.String(150), nullable=True)
    customer_id    = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    payment_method = db.Column(db.String(50), default='efectivo')
    total          = db.Column(db.Numeric(10,2), nullable=False, default=0)
    line_id        = db.Column(db.Integer, db.ForeignKey('business_lines.id'), nullable=True)
    created_at     = db.Column(db.DateTime, server_default=db.func.now())

    cashier  = db.relationship('User', backref='sales')
    customer = db.relationship('Customer', backref='sales')
    items    = db.relationship('SaleItem', backref='sale', cascade='all, delete-orphan')
    line     = db.relationship('BusinessLine', foreign_keys=[line_id])

    def to_dict(self):
        return {
            'id':             self.id,
            'cashier_id':     self.cashier_id,
            'cashier':        self.cashier.name if self.cashier else None,
            'customer_id':    self.customer_id,
            'customer':       self.customer.to_dict() if self.customer else None,
            'payment_method': self.payment_method,
            'total':          float(self.total),
            'line_id':        self.line_id,
            'line_name':      self.line.name  if self.line else None,
            'line_color':     self.line.color if self.line else None,
            'items':          [i.to_dict() for i in self.items],
            'created_at':     str(self.created_at),
        }


class SaleItem(db.Model):
    __tablename__ = 'sale_items'

    id              = db.Column(db.Integer, primary_key=True)
    sale_id         = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    product_id      = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    product_name    = db.Column(db.String(150), nullable=True)
    # presentation_id — columna opcional, se agrega con ALTER TABLE en add_audit.sql
    # No ponemos FK aquí para evitar crash si la columna no existe aún en la BD
    quantity        = db.Column(db.Numeric(10,3), nullable=False)
    price           = db.Column(db.Numeric(10,2), nullable=False)

    product = db.relationship('Product')

    def to_dict(self):
        # units_per_pack — se infiere del product_name si tiene el patrón "(N uds)"
        units_per_pack = None
        try:
            import re
            if self.product_name:
                m = re.search(r'\((\d+)\s+\w', self.product_name)
                if m:
                    units_per_pack = int(m.group(1))
        except Exception:
            pass

        return {
            'id':            self.id,
            'product_id':    self.product_id,
            'product':       self.product_name or (self.product.name if self.product else None),
            'quantity':      float(self.quantity),
            'price':         float(self.price),
            'subtotal':      float(self.price * self.quantity),
            'units_per_pack': units_per_pack,
        }